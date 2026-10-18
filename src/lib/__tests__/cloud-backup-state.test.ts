import { it } from "node:test";
import assert from "node:assert/strict";
import { cloudBackupDestination, isCloudBackupDue, CLOUD_BACKUP_INTERVAL_MS } from "../cloud-backup-state.ts";

it("uses the persisted successful upload time across restarts and retries absent, damaged or expired state", () => {
  const now = 1_800_000_000_000;
  const state = JSON.stringify({ version: 1, destination: "target", lastSuccessAt: now - 1000 });
  assert.equal(isCloudBackupDue(state, "target", now), false);
  assert.equal(isCloudBackupDue(state, "target", now + CLOUD_BACKUP_INTERVAL_MS), true);
  for (const invalid of [undefined, "invalid", "null", "{}", JSON.stringify({ version: 1, destination: "target", lastSuccessAt: now + 1 })]) assert.equal(isCloudBackupDue(invalid, "target", now), true);
  assert.equal(isCloudBackupDue(state, "changed", now), true);
});

it("changes the destination digest when backup credentials or destination change, without persisting secrets", () => {
  const config = { enabled: true, type: "s3" as const, s3Bucket: "one", updatedAt: 1 };
  const digest = cloudBackupDestination(config);
  assert.equal(cloudBackupDestination({ ...config, updatedAt: 2 }), digest);
  assert.notEqual(cloudBackupDestination({ ...config, s3Bucket: "two" }), digest);
  assert.match(digest, /^[a-f0-9]{64}$/);
});
