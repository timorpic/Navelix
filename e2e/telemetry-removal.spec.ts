import { test, expect } from "@playwright/test";

test("后台不提供使用统计或遥测，旧接口已删除且日常操作不再采集事件", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", request => {
    if (/\/api\/(?:admin\/)?analytics\//.test(request.url())) requests.push(request.url());
  });
  await page.goto("/login");
  await page.fill("#login-username", "admin");
  await page.fill("#login-password", "e2e-test-password");
  await page.getByRole("button", { name: "立即登录" }).click();
  await page.waitForURL("/");
  await page.goto("/admin?tab=system");
  await expect(page.getByRole("button", { name: "数据与维护", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "统计与遥测", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "访问统计", exact: true })).toHaveCount(0);
  await page.goto("/admin?tab=telemetry");
  await expect(page.locator('input[name="link-search"]')).toBeVisible();
  expect(requests).toEqual([]);
  for (const route of ["/api/analytics/track", "/api/admin/analytics/settings", "/api/admin/analytics/summary", "/api/admin/analytics/report"]) {
    const response = await page.request.get(route);
    expect(response.status()).toBe(404);
  }
});
