import { test, expect } from "@playwright/test";

test("EE 状态独立于官方镜像与许可证，支持失败提示和刷新", async ({ page }) => {
  await page.goto("/login");
  await page.fill("#login-username", "admin");
  await page.fill("#login-password", "e2e-test-password");
  await page.getByRole("button", { name: "立即登录" }).click();
  await page.waitForURL("/");
  const actual = await page.evaluate(async () => (await fetch("/api/admin/license")).json());
  expect(actual.eeDriverStatus.storageRegistered).toBe(actual.isEE);
  expect(actual.eeDriverStatus.probeRegistered).toBe(actual.isEE);
  let state = "loaded";
  let licensed = false;
  let queryFails = false;
  await page.route("**/api/admin/license", async route => {
    if (route.request().method() === "DELETE") {
      licensed = false;
      await route.fulfill({ json: { success: true } }); return;
    }
    if (queryFails) { await route.fulfill({ status: 503, json: { error: "fixture" } }); return; }
    await route.fulfill({ json: {
      isPro: licensed, isEE: state === "loaded", isDockerBuild: true,
      payload: licensed ? { customer: "fixture", email: "fixture@example.com", plan: "pro_lifetime", expiresAt: 0 } : undefined,
      eeDriverStatus: { state, storageRegistered: state === "loaded" || state === "partial", probeRegistered: state === "loaded", failure: state === "failed" ? "incompatible-runtime" : null },
    } });
  });
  await page.goto("/admin?tab=pro");
  await expect(page.getByRole("heading", { name: "EE 驱动状态", exact: true })).toBeVisible();
  await expect(page.getByTestId("ee-driver-state")).toHaveText("已加载");
  await expect(page.getByText("构建类型：官方 Docker 镜像", { exact: true })).toBeVisible();
  await expect(page.getByText("未激活 Pro", { exact: true })).toBeVisible();
  for (const [next, label] of [["missing", "未包含 EE 驱动"], ["partial", "驱动注册不完整"], ["failed", "加载失败"]]) {
    state = next;
    await page.getByRole("button", { name: "刷新状态", exact: true }).click();
    await expect(page.getByTestId("ee-driver-state")).toHaveText(label);
  }
  await expect(page.getByText(/制品与当前 Node\/V8 版本不兼容/)).toBeVisible();
  queryFails = true;
  await page.getByRole("button", { name: "刷新状态", exact: true }).click();
  await expect(page.getByTestId("ee-driver-state")).toHaveText("状态查询失败");
  queryFails = false; state = "loaded"; licensed = true;
  await page.getByRole("button", { name: "刷新状态", exact: true }).click();
  await expect(page.getByTestId("ee-driver-state")).toHaveText("已加载");
  await page.getByRole("button", { name: "注销授权", exact: true }).click();
  await page.getByRole("button", { name: "注销", exact: true }).click();
  await expect(page.getByText("未激活 Pro", { exact: true })).toBeVisible();
  await expect(page.getByTestId("ee-driver-state")).toHaveText("已加载");
  await expect(page.getByText("构建类型：官方 Docker 镜像", { exact: true })).toBeVisible();
});
