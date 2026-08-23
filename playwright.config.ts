import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const PORT = 3722;

// E2E 运行在隔离的数据目录（默认系统临时目录 /e2e-data）与独立端口，
// 避免污染开发者本地 data/navelix.db，也不与本地 `next dev`(3721) 冲突。
// 首次启动会以 NAVELIX_ADMIN_PASSWORD 种子全新 admin。
const E2E_DATA_DIR = process.env.E2E_DATA_DIR || path.join(os.tmpdir(), `navelix-e2e-${Date.now()}`);
fs.mkdirSync(E2E_DATA_DIR, { recursive: true, mode: 0o700 });

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 90_000,

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: process.env.CI ? "on-first-retry" : "off",
    screenshot: "only-on-failure",
  },

  webServer: {
    command: `pnpm exec next dev -p ${PORT}`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      PORT: String(PORT),
      NAVELIX_ADMIN_PASSWORD: "e2e-test-password",
      NAVELIX_DATA_DIR: E2E_DATA_DIR,
    },
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});