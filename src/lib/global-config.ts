import { db } from "./db.ts";
import { recordAuditLog } from "./audit.ts";
import { createNotification } from "./notification-store.ts";
import {
  GLOBAL_SCOPE_COLUMN_NAMES,
  GLOBAL_SCOPE_CONFIG_KEYS,
  mapUserConfigRow,
} from "./user-config-columns.ts";
import { getSystemSetting, setSystemSetting } from "./system-settings.ts";

/**
 * 全站配置「全局单例」与「个人偏好」的分离读写 + 审计/通知。
 *
 * 背景：user_configs 表历史为「每 user_id 一行」，但只有一部分字段（品牌/AI/天气/
 * 社交/安全策略/代码注入/探针/页脚）是全站级；其余（theme/壁纸/侧边栏/右侧小组件
 * 开关/内容宽度/搜索栏）是**个人偏好**。上一版把整张表折叠成单例行，误把个人偏好
 * 也全局化了。
 *
 * 本模块的正确语义：
 * - 全站级字段 → 存单例行（system_settings['global_config_user_id'] 锚定），
 *   任意 admin 改，全员一致；owner 被删时自动迁行不丢配置。
 * - 个人偏好字段 → 仍存各 user 自己的 user_configs 行。
 * 读路径把两者合并：全站单例行（取全局字段）+ 当前用户行（取个人字段）。
 * 密钥字段沿用 AES-256-GCM 加密不变。
 */

/** 全站配置单例的锚点键（存 system_settings）。 */
export const GLOBAL_CONFIG_OWNER_KEY = "global_config_user_id";

/** secret 类字段（审计/通知时只记「已变更/已清空」，不记明文） */
const SECRET_CONFIG_KEYS = new Set(["aiApiKey", "weatherApiKey"]);
const SECRET_FLAG: Record<string, string> = {
  aiApiKey: "aiKeyConfigured",
  weatherApiKey: "weatherKeyConfigured",
};

/** 确保指定 owner 有一行承载全站字段的配置行；缺失则新建（不搬移他人个人行）。 */
function ensureConfigRowAt(ownerId: string): void {
  const has = db.prepare("SELECT 1 FROM user_configs WHERE user_id = ?").get(ownerId);
  if (has) return;
  db.prepare("INSERT INTO user_configs (user_id) VALUES (?)").run(ownerId);
}

/**
 * 解析全站配置单例行所锚定的 user_id。
 * 优先读 system_settings 锚点（校验该用户仍存在且为 admin），
 * 否则迁到「最早 admin」并写回锚点。无任何 admin 时返回 null（空库首启）。
 */
export function resolveGlobalConfigOwnerId(): string | null {
  const anchored = getSystemSetting(GLOBAL_CONFIG_OWNER_KEY);
  if (anchored) {
    const row = db
      .prepare("SELECT id FROM users WHERE id = ? AND role = 'admin'")
      .get(anchored) as { id: string } | undefined;
    if (row) return row.id;
  }

  const earliest = db
    .prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1")
    .get() as { id: string } | undefined;
  if (!earliest) return null;

  ensureConfigRowAt(earliest.id);
  setSystemSetting(GLOBAL_CONFIG_OWNER_KEY, earliest.id);
  return earliest.id;
}

/**
 * 删除某用户前，若其为配置锚点 owner，把单例行迁到其他 admin。
 * 注意：单例行同时承载 owner 的个人偏好列；迁移时只把**全站级列**复制过去，
 * 个人偏好列不随行迁移（属被删者个人数据，随删除废弃）。
 * 供 admin-users.deleteUserCascade 在事务内调用。
 */
export function rehomeConfigBeforeUserDelete(deletedUserId: string): void {
  const ownerId = getSystemSetting(GLOBAL_CONFIG_OWNER_KEY);
  if (ownerId !== deletedUserId) return;

  const nextAdmin = db
    .prepare(
      "SELECT id FROM users WHERE role = 'admin' AND id != ? ORDER BY created_at ASC LIMIT 1",
    )
    .get(deletedUserId) as { id: string } | undefined;
  if (!nextAdmin) return;

  // 读取被删 owner 行的全站级列值
  const src = db
    .prepare("SELECT * FROM user_configs WHERE user_id = ?")
    .get(deletedUserId) as Record<string, unknown> | undefined;

  if (src) {
    ensureConfigRowAt(nextAdmin.id);
    const cols = GLOBAL_SCOPE_COLUMN_NAMES.filter((c) => c !== "user_id");
    if (cols.length > 0) {
      const sets = cols.map((c) => `${c} = ?`).join(", ");
      const vals: (string | number | bigint | Uint8Array | null)[] = cols.map(
        (c) => (src[c] as string | number | bigint | Uint8Array | null) ?? null,
      );
      db.prepare(`UPDATE user_configs SET ${sets} WHERE user_id = ?`).run(
        ...vals,
        nextAdmin.id,
      );
    }
  }

  setSystemSetting(GLOBAL_CONFIG_OWNER_KEY, nextAdmin.id);
}

/** 读取全站配置单例行（原始列），无行时返回 undefined。 */
export function getGlobalConfigRow(): Record<string, unknown> | undefined {
  const ownerId = resolveGlobalConfigOwnerId();
  if (!ownerId) return undefined;
  return db
    .prepare("SELECT * FROM user_configs WHERE user_id = ?")
    .get(ownerId) as Record<string, unknown> | undefined;
}

/**
 * 读取指定用户的**个人偏好**行（原始列），无行时返回 undefined。
 * 注意：个人偏好不写全站单例行，每个用户独立一行。
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

/** 全部 admin 的 id（通知广播用，含操作者本人）。 */
export function getAllAdminIds(): string[] {
  return (
    db.prepare("SELECT id FROM users WHERE role = 'admin'").all() as Array<{ id: string }>
  ).map((r) => r.id);
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
): void {
  if (changes.length === 0) return;
  recordAuditLog({
    userId: actorId,
    action: "config.updated",
    target: "user_configs",
    details: JSON.stringify(changes),
  });
}

/**
 * 向所有 admin（含操作者）广播「系统配置已更新」通知，内容内嵌完整 from→to 明细。
 * 仅对**全站级**字段变更广播（个人偏好属个人操作，不通知他人）。
 */
export function notifyAdminsConfigChanged(
  actor: { id: string; username: string; displayName?: string },
  changes: ConfigChange[],
): void {
  if (changes.length === 0) return;
  const name = actor.displayName || actor.username || "admin";
  const title = "系统配置已更新";
  const lines = changes.map(
    (c) => `${c.field}: ${c.from || "（空）"} → ${c.to || "（空）"}`,
  );
  const content = `@${actor.username}（${name}）修改了 ${changes.length} 项配置：\n${lines.join("\n")}`;

  for (const adminId of getAllAdminIds()) {
    createNotification(adminId, { title, content, source: "system" });
  }
}
