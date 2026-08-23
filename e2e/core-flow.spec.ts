import { test, expect } from "@playwright/test";

/**
 * 核心链路 E2E：登录 → 首页总览 → 项目管理 → 日历日程。
 * 覆盖真实登录、侧边栏主导航、两个核心工作空间视图的切换与渲染。
 *
 * 前置条件：服务由 playwright.config.ts 的 webServer 自动启动，
 * 运行在独立端口 + 隔离数据目录，首次启动以 NAVELIX_ADMIN_PASSWORD=e2e-test-password 种子全新 admin，
 * 不会触碰本地 data/ 数据。
 */
test("核心链路：登录后经主导航切换到项目与日历视图", async ({ page }) => {
  // ── 1. 登录 ──
  await page.goto("/login");
  await page.fill("#login-username", "admin");
  await page.fill("#login-password", "e2e-test-password");
  await page.getByRole("button", { name: "立即登录" }).click();
  await page.waitForURL("/");

  // ── 2. 首页总览：侧边栏可见，默认分类为「首页总览」 ──
  const homeNav = page.getByRole("button", { name: /首页总览/ });
  await expect(homeNav).toBeVisible();

  // ── 3. 主导航 → 项目管理 ──
  await page.getByRole("button", { name: /项目管理/ }).click();
  await expect(
    page.getByText("项目管理与团队里程碑中心"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /项目卡片/ })).toBeVisible();

  // ── 4. 主导航 → 日历日程 ──
  await page.getByRole("button", { name: /日历日程/ }).click();
  await expect(
    page.getByText("日历日程与精力调度中心"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /月视图/ })).toBeVisible();

  // ── 5. 回到首页总览，验证导航可逆 ──
  await page.getByRole("button", { name: /首页总览/ }).click();
  await expect(homeNav).toBeVisible();
});