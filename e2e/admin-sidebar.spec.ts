import { test, expect } from "@playwright/test";

test("后台账号卡片在菜单折叠和滚动时固定在侧栏底部", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/login");
  await page.fill("#login-username", "admin");
  await page.fill("#login-password", "e2e-test-password");
  await page.getByRole("button", { name: "立即登录" }).click();
  await page.waitForURL("/");
  await page.goto("/admin");

  const sidebar = page.locator("aside");
  const footer = sidebar.locator(":scope > div").last();
  await expect(footer).toBeVisible();
  const initial = await footer.boundingBox();
  expect(initial).not.toBeNull();
  expect(initial!.y + initial!.height).toBeCloseTo(700, 0);

  for (const name of ["系统设置", "用户设置"]) {
    await sidebar.getByRole("button", { name, exact: true }).click();
    const folded = await footer.boundingBox();
    expect(folded!.y).toBeCloseTo(initial!.y, 0);
    await sidebar.getByRole("button", { name, exact: true }).click();
  }

  const nav = sidebar.locator("nav");
  expect(await nav.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  await nav.evaluate(el => { el.scrollTop = el.scrollHeight; });
  const scrolled = await footer.boundingBox();
  expect(scrolled!.y).toBeCloseTo(initial!.y, 0);
  await expect(sidebar.getByRole("button", { name: "账号与数据", exact: true })).toBeVisible();
});
