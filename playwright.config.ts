import { defineConfig, devices, type ReporterDescription } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const PORT = 3722;
const externalBaseURL = process.env.E2E_BASE_URL;
if (externalBaseURL && !/^http:\/\/(localhost|127\.0\.0\.1):3722$/.test(externalBaseURL)) {
  throw new Error("E2E_BASE_URL 必须是隔离测试容器的本机 HTTP 地址，禁止使用生产实例");
}

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
  // CI 下同时输出 github 注解与 HTML 报告；后者供失败时 upload-artifact 收集。
  // 数组形式要求每一项都是 [name, arg] 元组，不能混入裸字符串。
  reporter: (process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : "list") as ReporterDescription[] | "list",
  timeout: 90_000,

  use: {
    locale: "zh-CN",
    baseURL: externalBaseURL || `http://localhost:${PORT}`,
    trace: process.env.CI ? "on-first-retry" : "off",
    screenshot: "only-on-failure",
  },

  webServer: externalBaseURL ? undefined : {
    command: `pnpm build && pnpm exec next start -p ${PORT}`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      PORT: String(PORT),
      NAVELIX_ADMIN_PASSWORD: "e2e-test-password",
      NAVELIX_DATA_DIR: E2E_DATA_DIR,
      APP_SECRET: "",
      NAVELIX_LICENSE_KEY: "",
    },
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
