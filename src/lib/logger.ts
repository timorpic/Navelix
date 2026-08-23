import fs from "node:fs";
import path from "node:path";
import { resolveDataDir } from "./data-dir.ts";

/**
 * 轻量结构化日志：JSON 行写入 data/logs/navelix-YYYY-MM-DD.log（按日期轮转），
 * 同时镜像到控制台（Docker: stdout/stderr 由容器日志驱动负责轮转）。
 * 不引入任何第三方依赖，适合自托管零依赖定位。
 */

const LOG_DIR = path.join(resolveDataDir(), "logs");
const RETENTION_DAYS = 14;

function ensureDir(): void {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true, mode: 0o700 });
  } catch {
    // 磁盘不可写时仅保留控制台输出
  }
}

function todayFile(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return path.join(LOG_DIR, `navelix-${y}-${m}-${day}.log`);
}

function append(line: string): void {
  try {
    ensureDir();
    fs.appendFileSync(todayFile(), line + "\n", { flag: "a" });
  } catch {
    // 降级：仅控制台
  }
}

function cleanupOld(): void {
  try {
    const cutoff = Date.now() - RETENTION_DAYS * 86_400_000;
    const files = fs
      .readdirSync(LOG_DIR)
      .filter((f) => f.startsWith("navelix-") && f.endsWith(".log"));
    for (const f of files) {
      try {
        const stat = fs.statSync(path.join(LOG_DIR, f));
        if (stat.mtimeMs < cutoff) fs.unlinkSync(path.join(LOG_DIR, f));
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}

cleanupOld(); // 启动时清理过期日志

export type LogLevel = "info" | "warn" | "error";

export function log(level: LogLevel, message: string, fields?: Record<string, unknown>): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...fields,
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
  append(line);
}

export const logger = {
  info: (msg: string, fields?: Record<string, unknown>) => log("info", msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => log("warn", msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => log("error", msg, fields),
};