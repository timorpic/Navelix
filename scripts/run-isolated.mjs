import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

// Always create a disposable directory. An inherited production path must never reach tests/builds.
const [mode, ...extra] = process.argv.slice(2);
const commands = {
  test: ["--experimental-strip-types", "--test-concurrency=1", "--test", ...extra, "src/**/*.test.ts"],
  coverage: ["--experimental-strip-types", "--test-concurrency=1", "--experimental-test-coverage", "--test-coverage-lines=60", "--test-coverage-functions=55", "--test", ...extra, "src/**/*.test.ts"],
  build: ["node_modules/next/dist/bin/next", "build", ...extra],
};
if (!Object.hasOwn(commands, mode)) throw new Error("Expected test, coverage or build");
const standalone = path.resolve(".next/standalone");
// Next can leave old copied files behind; never carry a prior artifact's runtime data into a new build.
if (mode === "build") rmSync(standalone, { recursive: true, force: true });
const dataDir = mkdtempSync(path.join(tmpdir(), `navelix-${mode}-`));
const child = spawn(process.execPath, commands[mode], {
  stdio: "inherit",
  env: { ...process.env, NAVELIX_DATA_DIR: dataDir, APP_SECRET: "", NAVELIX_ADMIN_PASSWORD: "", NAVELIX_LICENSE_KEY: "" },
});
const signals = ["SIGINT", "SIGTERM"];
const handlers = signals.map(signal => {
  const handler = () => child.kill(signal);
  process.on(signal, handler);
  return handler;
});
let finished = false;
function finish(code) {
  if (finished) return;
  finished = true;
  signals.forEach((signal, index) => process.off(signal, handlers[index]));
  rmSync(dataDir, { recursive: true, force: true });
  if (mode === "build" && code === 0 && existsSync(standalone)) {
    // Next 16's instrumentation trace does not apply route tracing exclusions.
    // Remove only the generated runtime-data copy, and its trace references, before distribution.
    rmSync(path.join(standalone, "data"), { recursive: true, force: true });
    const runtimeRoots = [path.resolve("data"), dataDir];
    const insideRuntime = file => runtimeRoots.some(root => file === root || file.startsWith(root + path.sep));
    for (const name of readdirSync(".next/server", { recursive: true })) {
      if (!String(name).endsWith(".nft.json")) continue;
      const file = path.resolve(".next/server", String(name));
      const trace = JSON.parse(readFileSync(file, "utf8"));
      trace.files = trace.files.filter(entry => !insideRuntime(path.resolve(path.dirname(file), entry)));
      writeFileSync(file, JSON.stringify(trace));
      const copied = path.join(standalone, path.relative(process.cwd(), file));
      if (existsSync(copied)) writeFileSync(copied, JSON.stringify(trace));
    }
    const forbidden = new Set([".app_secret", "navelix.db", "navelix.db-wal", "navelix.db-shm", "navelix-admin-password.txt"]);
    if (readdirSync(standalone, { recursive: true }).some(name => forbidden.has(path.basename(String(name))))) {
      console.error("Build rejected: standalone contains runtime database, password or master key files.");
      code = 1;
    }
  }
  process.exitCode = code;
}
child.once("error", () => finish(1));
child.once("exit", (code, signal) => finish(code ?? (signal === "SIGINT" ? 130 : 143)));
