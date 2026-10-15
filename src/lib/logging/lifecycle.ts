import fs from "node:fs";
import path from "node:path";
import { ensureLogDirectory } from "./settings.ts";
import { flushLogs, instanceId } from "./store.ts";
import { writeLog } from "./events.ts";
let started = false;
/** A leftover marker is evidence of an unconfirmed exit, not proof of its cause. */
export function startLogLifecycle(): void {
  if (started) return;
  started = true;
  try {
    const dir = ensureLogDirectory();
    for (const name of fs.readdirSync(dir)) {
      const match = /^lifecycle-(\d+)-[a-f0-9]{8}\.json$/.exec(name);
      if (!match) continue;
      const file = path.join(dir, name);
      if (!fs.lstatSync(file).isFile() || fs.lstatSync(file).isSymbolicLink()) continue;
      try { process.kill(Number(match[1]), 0); continue; } catch { /* Previous process is gone. */ }
      writeLog({ category: "runtime", event: "runtime.previous_exit.unconfirmed", outcome: "unknown", level: "warn" });
      fs.unlinkSync(file);
    }
    const marker = path.join(dir, `lifecycle-${instanceId}.json`);
    fs.writeFileSync(marker, JSON.stringify({ startedAt: Date.now() }), { flag: "wx", mode: 0o600 });
    process.once("exit", code => {
      writeLog({ category: "runtime", event: "runtime.exited", outcome: code === 0 ? "succeeded" : "failed", level: code === 0 ? "info" : "error", code: `EXIT_${code}` });
      flushLogs();
      if (code === 0) { try { fs.unlinkSync(marker); } catch { /* May already be removed. */ } }
    });
  } catch { /* Console remains the fallback. */ }
}
