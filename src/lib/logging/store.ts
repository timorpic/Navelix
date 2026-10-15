import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ensureLogDirectory, logDirectory, readLogSettings } from "./settings.ts";
import type { LogCategory, LogEvent, LogSettings } from "./types.ts";

export const instanceId = `${process.pid}-${randomUUID().slice(0, 8)}`;
const FILE_PATTERN = /^navelix-v1-(debug|frontend|runtime|business)-(\d{4}-\d{2}-\d{2})-\d+-[a-f0-9]{8}-\d+\.jsonl$/;
const LEGACY_PATTERN = /^navelix-\d{4}-\d{2}-\d{2}\.log$/;
const MAX_BUFFER = 2 * 1024 * 1024;
interface Pending { line: string; event: LogEvent; }
let queue: Pending[] = [];
let buffered = 0;
let timer: NodeJS.Timeout | undefined;
let lastErrorAt = 0;
let dropped = 0;
let successfulWriteAt = 0;
const active = new Map<string, { name: string; bytes: number; seq: number; first: number; last: number; count: number; categories: Partial<Record<LogCategory, number>> }>();
let lastCleanup = 0;

export interface LogFile { name: string; bytes: number; modified: number; tier: string; }
export function listLogFiles(): LogFile[] {
  try {
    const dir = ensureLogDirectory();
    return fs.readdirSync(dir).flatMap(name => {
      const match = FILE_PATTERN.exec(name);
      if (!match && !LEGACY_PATTERN.test(name)) return [];
      const stat = fs.lstatSync(path.join(dir, name));
      if (!stat.isFile() || stat.isSymbolicLink()) return [];
      return [{ name, bytes: stat.size, modified: stat.mtimeMs, tier: match?.[1] ?? "legacy" }];
    }).sort((a, b) => b.modified - a.modified || b.name.localeCompare(a.name));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}
export function logStoreHealth() {
  let files: LogFile[] = [];
  let readable = true;
  try { files = listLogFiles(); } catch { readable = false; }
  return { bytes: files.reduce((n, file) => n + file.bytes, 0), files: files.length, bufferedBytes: buffered,
    dropped, lastErrorAt, successfulWriteAt, readable, lastCleanup };
}
function tierOf(event: LogEvent): string {
  return event.level === "debug" ? "debug" : event.source === "frontend" ? "frontend" : event.kind === "business" ? "business" : "runtime";
}
export function enqueueLog(event: LogEvent): void {
  const line = JSON.stringify(event) + "\n";
  const bytes = Buffer.byteLength(line);
  if (bytes > 16 * 1024 || bytes + buffered > MAX_BUFFER) { dropped++; return; }
  queue.push({ line, event }); buffered += bytes;
  if (!timer) {
    timer = setTimeout(() => { timer = undefined; flushLogs(); }, 100);
    timer.unref();
  }
}
export function flushLogs(): void {
  if (timer) { clearTimeout(timer); timer = undefined; }
  const pending = queue; queue = []; buffered = 0;
  if (!pending.length) return;
  try {
    const dir = ensureLogDirectory();
    const settings = readLogSettings();
    let diskBytes = listLogFiles().reduce((n, file) => n + file.bytes, 0);
    for (const item of pending) {
      const date = new Date(item.event.timestamp).toISOString().slice(0, 10);
      const tier = tierOf(item.event);
      const key = `${tier}-${date}`;
      let file = active.get(key);
      const bytes = Buffer.byteLength(item.line);
      if (diskBytes + bytes > settings.maxTotalBytes) { dropped++; continue; }
      if (!file || file.bytes + bytes > settings.maxFileBytes) {
        const seq = (file?.seq ?? -1) + 1;
        file = { name: `navelix-v1-${tier}-${date}-${instanceId}-${seq}.jsonl`, seq, bytes: 0, first: item.event.timestamp, last: item.event.timestamp, count: 0, categories: {} };
        active.set(key, file);
      }
      const fd = fs.openSync(path.join(dir, file.name), fs.constants.O_WRONLY | fs.constants.O_APPEND | fs.constants.O_CREAT | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK, 0o600);
      try { if (!fs.fstatSync(fd).isFile()) throw new Error("Invalid log file"); fs.writeSync(fd, item.line); } finally { fs.closeSync(fd); }
      diskBytes += bytes;
      file.bytes += bytes; file.last = item.event.timestamp; file.count++;
      file.categories[item.event.category] = (file.categories[item.event.category] ?? 0) + 1;
    }
    for (const file of active.values()) {
      const temp = path.join(dir, `${file.name}.index-${process.pid}.tmp`);
      try {
        fs.writeFileSync(temp, JSON.stringify({ bytes: file.bytes, first: file.first, last: file.last, count: file.count, categories: file.categories }), { mode: 0o600, flag: "wx" });
        fs.renameSync(temp, path.join(dir, `${file.name}.index.json`));
      } catch { try { fs.unlinkSync(temp); } catch { /* Rebuildable cache only. */ } }
    }
    successfulWriteAt = Date.now();
    if (Date.now() - lastCleanup > 60_000) {
      try { cleanupLogFiles(settings); } catch { /* Another process may own the cleanup lease; writes succeeded. */ }
    }
    // Drop obsolete daily metadata; this cache does not grow with process uptime.
    for (const [key, file] of active) if (Date.now() - file.last > 86400_000) active.delete(key);
  } catch {
    dropped += pending.length; lastErrorAt = Date.now();
    // Events were already mirrored to stderr/stdout; do not recursively log failures.
  }
}
export function cleanupCandidates(settings: LogSettings, now = Date.now()): LogFile[] {
  const files = listLogFiles();
  const activeNames = new Set([...active.values()].filter(f => now - f.last < 60_000).map(f => f.name));
  let total = files.reduce((n, file) => n + file.bytes, 0);
  return [...files].reverse().filter(file => {
    if (activeNames.has(file.name) || now - file.modified < 60_000) return false;
    const days = file.tier === "debug" ? 3 : file.tier === "frontend" ? 7 : file.tier === "business" ? settings.businessRetentionDays : settings.runtimeRetentionDays;
    if (file.modified < now - days * 86400_000 || total > settings.maxTotalBytes) { total -= file.bytes; return true; }
    return false;
  });
}
/** mkdir is an atomic cross-process lease. No paths are accepted from callers. */
export function withLogLease<T>(task: () => T): T {
  const dir = ensureLogDirectory();
  const lock = path.join(dir, ".maintenance-lock");
  try { fs.mkdirSync(lock, { mode: 0o700 }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const stat = fs.lstatSync(lock);
    if (stat.isSymbolicLink() || !stat.isDirectory() || Date.now() - stat.mtimeMs < 10 * 60_000) throw new Error("Log maintenance is busy");
    fs.rmdirSync(lock); fs.mkdirSync(lock, { mode: 0o700 });
  }
  try { return task(); } finally { fs.rmdirSync(lock); }
}
export function removeLogFiles(files: LogFile[]): { removed: number; releasedBytes: number; failed: number } {
  const dir = ensureLogDirectory();
  let removed = 0; let releasedBytes = 0; let failed = 0;
  for (const file of files) {
    if (!FILE_PATTERN.test(file.name) && !LEGACY_PATTERN.test(file.name)) continue;
    const name = path.join(dir, file.name);
    try {
      const stat = fs.lstatSync(name);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== file.bytes || stat.mtimeMs !== file.modified) continue;
      fs.unlinkSync(name);
      try { fs.unlinkSync(`${name}.index.json`); } catch { /* A missing index is harmless. */ }
      removed++; releasedBytes += stat.size;
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") failed++; }
  }
  return { removed, releasedBytes, failed };
}
export function cleanupLogFiles(settings = readLogSettings()) {
  const result = withLogLease(() => removeLogFiles(cleanupCandidates(settings)));
  lastCleanup = Date.now();
  return result;
}
/** Bounded tail reads. Never follow symlinks, even if files change after listing. */
export function readLogTail(file: LogFile, limit: number): { text: string; partial: boolean } {
  const fd = fs.openSync(path.join(logDirectory(), file.name), fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile()) throw new Error("Invalid log file");
    const size = Math.min(stat.size, limit);
    const start = stat.size - size;
    const buffer = Buffer.alloc(size);
    const read = fs.readSync(fd, buffer, 0, size, start);
    let text = buffer.subarray(0, read).toString("utf8");
    if (start > 0) text = text.slice(text.indexOf("\n") + 1);
    return { text, partial: start > 0 };
  } finally { fs.closeSync(fd); }
}
// Next development reloads modules. Keep one process listener and replace its callback.
const EXIT_KEY = Symbol.for("navelix.logging.flush-on-exit");
const exitRegistry = globalThis as unknown as Record<symbol, { flush: () => void } | undefined>;
if (exitRegistry[EXIT_KEY]) exitRegistry[EXIT_KEY]!.flush = flushLogs;
else {
  exitRegistry[EXIT_KEY] = { flush: flushLogs };
  process.once("exit", () => exitRegistry[EXIT_KEY]?.flush());
}

export function readFileIndex(file: LogFile): { first: number; last: number; categories: Record<string, number> } | null {
  try {
    const fd = fs.openSync(path.join(logDirectory(), `${file.name}.index.json`), fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    try {
      if (!fs.fstatSync(fd).isFile() || fs.fstatSync(fd).size > 4096) return null;
      const index = JSON.parse(fs.readFileSync(fd, "utf8"));
      if (index.bytes !== file.bytes || !Number.isFinite(index.first) || !Number.isFinite(index.last) || !index.categories || typeof index.categories !== "object") return null;
      return index;
    } finally { fs.closeSync(fd); }
  } catch { return null; }
}
