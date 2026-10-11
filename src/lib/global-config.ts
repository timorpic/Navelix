import { encryptSecret } from "./secret.ts";
import { db } from "./db.ts";
import { recordAuditLog } from "./audit.ts";
import {
  USER_CONFIG_MAPPED_COLUMNS,
  isGlobalScoped,
  coerceUserConfigValues,
  GLOBAL_SCOPE_CONFIG_KEYS,
  mapUserConfigRow,
} from "./user-config-columns.ts";
import { setSystemSetting } from "./system-settings.ts";

/** 系统配置独立存储于 system_settings，不依赖用户生命周期。 */
const SECRET_CONFIG_KEYS = new Set(["aiApiKey", "weatherApiKey"]);
const SECRET_FLAG: Record<string, string> = {
  aiApiKey: "aiKeyConfigured", weatherApiKey: "weatherKeyConfigured",
};

/** 返回兼容现有服务端消费者的 snake_case 行，仅包含系统字段。 */
export function getGlobalConfigRow(): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const settings = new Map((db.prepare("SELECT key, value FROM system_settings").all() as { key: string; value: string }[]).map(setting => [setting.key, setting.value]));
  for (const col of USER_CONFIG_MAPPED_COLUMNS.filter(isGlobalScoped)) {
    const value = settings.get(col.column) ?? col.configDefault ?? "";
    row[col.column] = col.kind === "bool" ? Number(value === true || value === 1 || value === "1")
      : col.kind === "num" ? Number(value) : String(value);
  }
  return row;
}

export function saveGlobalConfig(cfg: Record<string, unknown>): void {
  const current = getGlobalConfigRow();
  const values = coerceUserConfigValues(cfg, current, true, encryptSecret);
  USER_CONFIG_MAPPED_COLUMNS.forEach((col, index) => {
    if (isGlobalScoped(col) && col.configKey && Object.hasOwn(cfg, col.configKey)) {
      setSystemSetting(col.column, String(values[index]));
    }
  });
}

/**
 * 读取指定用户的**个人偏好**行（原始列），无行时返回 undefined。
 * 注意：个人偏好不写系统设置，每个用户独立一行。
 */
export function getUserConfigRow(userId: string): Record<string, unknown> | undefined {
  return db
    .prepare("SELECT * FROM user_configs WHERE user_id = ?")
    .get(userId) as Record<string, unknown> | undefined;
}

/**
 * 把写入配置按 scope 拆成「全站字段」与「个人字段」两份。
 * secret 的派生标记（aiKeyConfigured 等）随其密钥字段归入全站。
 */
export function splitConfigByScope(
  cfg: Record<string, unknown>,
): { global: Record<string, unknown>; personal: Record<string, unknown> } {
  const global: Record<string, unknown> = {};
  const personal: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(cfg)) {
    if (key === "aiKeyConfigured" || key === "weatherKeyConfigured") {
      global[key] = val;
      continue;
    }
    if (GLOBAL_SCOPE_CONFIG_KEYS.has(key)) global[key] = val;
    else personal[key] = val;
  }
  return { global, personal };
}

export interface ConfigChange {
  field: string;
  from: string;
  to: string;
}

/**
 * 计算配置变更 diff（configKey 粒度）。
 * - 仅比较 cfg 中显式出现的字段；无变化返回空数组。
 * - secret 字段（aiApiKey / weatherApiKey）记「已配置/未配置」，不记明文。
 */
export function diffConfigChanges(
  currentRow: Record<string, unknown> | undefined,
  cfg: Record<string, unknown>,
): ConfigChange[] {
  const current = mapUserConfigRow(currentRow) as Record<string, unknown>;
  const changes: ConfigChange[] = [];

  for (const [key, input] of Object.entries(cfg)) {
    if (key === "aiKeyConfigured" || key === "weatherKeyConfigured") continue; // 派生标记

    if (SECRET_CONFIG_KEYS.has(key)) {
      const val = typeof input === "string" ? input.trim() : "";
      if (input === null) {
        if (current[SECRET_FLAG[key]]) changes.push({ field: key, from: "已配置", to: "已清除" });
        continue;
      }
      if (!val) continue; // 空串 = 未变更
      const flagKey = SECRET_FLAG[key];
      changes.push({
        field: key,
        from: current[flagKey] ? "已配置" : "未配置",
        to: "已配置（明文脱敏）",
      });
      continue;
    }

    const before = current[key];
    const a = before === undefined || before === null ? "" : String(before);
    const b = input === undefined || input === null ? "" : String(input);
    if (a !== b) {
      changes.push({ field: key, from: a, to: b });
    }
  }
  return changes;
}

/** 落审计日志：谁在何时改了哪些配置字段（密钥脱敏）。 */
export function recordConfigAuditLog(
  actorId: string,
  changes: ConfigChange[],
  target: "system_settings" | "user_configs" = "system_settings",
): void {
  if (changes.length === 0) return;
  recordAuditLog({
    userId: actorId,
    action: "config.updated",
    target,
    details: JSON.stringify(changes),
  });
}
