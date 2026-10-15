import fs from "node:fs";
import path from "node:path";
import { resolveDataDir } from "../data-dir.ts";
import { LOG_CATEGORIES, type LogSettings } from "./types.ts";
export const DEFAULT_LOG_SETTINGS: LogSettings = {
  level: "info", debugUntil: 0, auditRetentionDays: 0,
  runtimeRetentionDays: 14, businessRetentionDays: 30,
  maxFileBytes: 20 * 1024 * 1024, maxTotalBytes: 200 * 1024 * 1024,
  frontendEnabled: false, alertsEnabled: false,
  categories: Object.fromEntries(Object.keys(LOG_CATEGORIES).map(key => [key, true])) as LogSettings["categories"],
};
export function logDirectory(): string { return path.join(resolveDataDir(), "logs"); }
export function ensureLogDirectory(): string {
  const dir = logDirectory();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (!fs.lstatSync(dir).isDirectory() || fs.lstatSync(dir).isSymbolicLink()) throw new Error("Unsafe log directory");
  return dir;
}
export function normalizeLogSettings(input: unknown, base = DEFAULT_LOG_SETTINGS): LogSettings {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid log settings");
  const value = input as Record<string, unknown>;
  const allowed = new Set(Object.keys(DEFAULT_LOG_SETTINGS));
  if (Object.keys(value).some(key => !allowed.has(key))) throw new Error("Unknown log setting");
  const result: LogSettings = { ...base, categories: { ...base.categories } };
  for (const key of ["runtimeRetentionDays", "businessRetentionDays", "maxFileBytes", "maxTotalBytes"] as const) {
    if (value[key] === undefined) continue;
    const n = value[key];
    const min = key.endsWith("Days") ? 1 : key === "maxFileBytes" ? 1024 * 1024 : 10 * 1024 * 1024;
    const max = key.endsWith("Days") ? 90 : key === "maxFileBytes" ? 100 * 1024 * 1024 : 1024 * 1024 * 1024;
    if (typeof n !== "number" || !Number.isInteger(n) || n < min || n > max) throw new Error(`Invalid ${key}`);
    result[key] = n;
  }
  if (result.maxFileBytes > result.maxTotalBytes) throw new Error("File limit exceeds total limit");
  if (value.auditRetentionDays !== undefined) {
    if (![0, 90, 180, 365].includes(Number(value.auditRetentionDays)) || typeof value.auditRetentionDays !== "number") throw new Error("Invalid audit retention");
    result.auditRetentionDays = value.auditRetentionDays as LogSettings["auditRetentionDays"];
  }
  for (const key of ["frontendEnabled", "alertsEnabled"] as const) {
    if (value[key] !== undefined) {
      if (typeof value[key] !== "boolean") throw new Error(`Invalid ${key}`);
      result[key] = value[key];
    }
  }
  if (value.categories !== undefined) {
    if (!value.categories || typeof value.categories !== "object" || Array.isArray(value.categories)) throw new Error("Invalid categories");
    for (const [key, enabled] of Object.entries(value.categories)) {
      if (!Object.hasOwn(LOG_CATEGORIES, key) || typeof enabled !== "boolean") throw new Error("Invalid category");
      result.categories[key as keyof typeof LOG_CATEGORIES] = enabled;
    }
  }
  if (value.level !== undefined) {
    if (value.level !== "info" && value.level !== "debug") throw new Error("Invalid level");
    result.level = value.level;
    result.debugUntil = value.level === "debug" ? (base.level === "debug" && base.debugUntil > Date.now() ? base.debugUntil : Date.now() + 86400_000) : 0;
  }
  if (value.debugUntil !== undefined && value.level === undefined) {
    if (typeof value.debugUntil !== "number" || !Number.isFinite(value.debugUntil)) throw new Error("Invalid debug expiry");
    result.debugUntil = Math.min(value.debugUntil, Date.now() + 86400_000);
  }
  return result;
}
let cached: { checked: number; settings: LogSettings } | undefined;
export function readLogSettings(): LogSettings {
  if (cached && Date.now() - cached.checked < 1000) {
    if (cached.settings.debugUntil <= Date.now()) return { ...cached.settings, level: "info", debugUntil: 0 };
    return cached.settings;
  }
  let settings: LogSettings = { ...DEFAULT_LOG_SETTINGS, categories: { ...DEFAULT_LOG_SETTINGS.categories } };
  try {
    const fd = fs.openSync(path.join(ensureLogDirectory(), "settings.json"), fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    try {
      if (!fs.fstatSync(fd).isFile() || fs.fstatSync(fd).size > 16 * 1024) throw new Error("Settings too large");
      const saved: unknown = JSON.parse(fs.readFileSync(fd, "utf8"));
      // Reading a stored debug setting must never extend its expiry.
      settings = normalizeLogSettings(saved);
      if (saved && typeof saved === "object" && "debugUntil" in saved && typeof saved.debugUntil === "number") settings.debugUntil = Math.min(saved.debugUntil, Date.now() + 86400_000);
    } finally { fs.closeSync(fd); }
  } catch { /* Missing or damaged settings fall back to bounded defaults. */ }
  if (settings.debugUntil <= Date.now()) { settings.level = "info"; settings.debugUntil = 0; }
  cached = { checked: Date.now(), settings };
  return settings;
}
export function saveLogSettings(settings: LogSettings): void {
  const dir = ensureLogDirectory();
  const temp = path.join(dir, `settings-${process.pid}-${Date.now()}.tmp`);
  const fd = fs.openSync(temp, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(settings)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(temp, path.join(dir, "settings.json"));
  cached = { checked: Date.now(), settings };
}
