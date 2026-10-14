import { it, mock } from "node:test";
import assert from "node:assert/strict";

it("uses bounded timers for the maximum backup policy without shortening the backup retention interval", async () => {
  const previous = process.env.NAVELIX_BACKUP_INTERVAL_HOURS;
  process.env.NAVELIX_BACKUP_INTERVAL_HOURS = "8760";
  const { startBackgroundDaemon, stopBackgroundDaemon } = await import("../daemon.ts");
  const { BACKUP_INTERVAL_MS } = await import("../db-backup-core.ts");
  const timer = mock.method(globalThis, "setTimeout");
  try {
    startBackgroundDaemon();
    assert.equal(BACKUP_INTERVAL_MS, 8760 * 60 * 60 * 1000);
    const delays = timer.mock.calls.map(call => Number(call.arguments[1]));
    assert.ok(delays.length >= 7);
    assert.ok(delays.every(delay => delay > 1 && delay <= 2 ** 31 - 1));
    assert.ok(delays.filter(delay => delay === 24 * 60 * 60 * 1000).length >= 2, "cloud and long-interval local backups both use daily checks");
  } finally {
    stopBackgroundDaemon();
    timer.mock.restore();
    if (previous === undefined) delete process.env.NAVELIX_BACKUP_INTERVAL_HOURS;
    else process.env.NAVELIX_BACKUP_INTERVAL_HOURS = previous;
  }
});
