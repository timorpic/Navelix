import { createHash } from "node:crypto";
import type { CloudStorageConfig } from "./storage-provider.ts";

export const CLOUD_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const CLOUD_BACKUP_STATE_KEY = "cloud_backup_schedule_v1";

export function cloudBackupDestination(config: CloudStorageConfig): string {
  // Include credentials only in the digest so a configuration change triggers a fresh backup.
  const destination = { ...config };
  delete destination.updatedAt;
  return createHash("sha256").update(JSON.stringify(destination)).digest("hex");
}

export function isCloudBackupDue(rawState: string | undefined, destination: string, now = Date.now()): boolean {
  try {
    const state: unknown = JSON.parse(rawState ?? "null");
    if (!state || typeof state !== "object") return true;
    const record = state as Record<string, unknown>;
    return record.version !== 1 || record.destination !== destination ||
      typeof record.lastSuccessAt !== "number" || !Number.isFinite(record.lastSuccessAt) ||
      record.lastSuccessAt <= 0 || record.lastSuccessAt > now ||
      now - record.lastSuccessAt >= CLOUD_BACKUP_INTERVAL_MS;
  } catch { return true; }
}
