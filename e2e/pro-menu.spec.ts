import { test, expect } from "@playwright/test";

test("Pro 菜单开关持久化，桌面和移动端统一隐藏与标记且保留一级入口", async ({ page }) => {
  await page.goto("/login");
  await page.fill("#login-username", "admin");
  await page.fill("#login-password", "e2e-test-password");
  await page.getByRole("button", { name: "立即登录" }).click();
  await page.waitForURL("/");
  await page.goto("/admin?tab=pro");
  const toggle = page.getByRole("switch", { name: "显示 Pro 功能菜单" });
  await expect(toggle).toBeChecked();
  for (const name of ["品牌定制", "自定义代码", "链接探针", "Pro 高级功能"]) {
    await expect(page.getByRole("button", { name: new RegExp(`${name} PRO$`) }).first()).toBeVisible();
  }
  const saved = page.waitForResponse(response => response.url().endsWith("/api/user/data") && response.request().method() === "POST");
  await toggle.click();
  expect((await saved).ok()).toBe(true);
  await expect(toggle).not.toBeChecked();
  for (const name of ["品牌定制", "自定义代码", "链接探针"]) {
    await expect(page.getByRole("button", { name: new RegExp(`${name} PRO$`) })).toHaveCount(0);
  }
  await expect(page.getByRole("button", { name: /Pro 高级功能 PRO$/ }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "站点设置", exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(toggle).not.toBeChecked();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: /Pro 高级功能 PRO$/ }).last()).toBeVisible();
  for (const name of ["品牌定制", "自定义代码", "链接探针"]) {
    await expect(page.getByRole("button", { name: new RegExp(`${name} PRO$`) })).toHaveCount(0);
  }
  const enabled = page.waitForResponse(response => response.url().endsWith("/api/user/data") && response.request().method() === "POST");
  await toggle.click(); expect((await enabled).ok()).toBe(true);
  for (const name of ["品牌定制", "自定义代码", "链接探针"]) {
    await expect(page.getByRole("button", { name: new RegExp(`${name} PRO$`) }).last()).toBeVisible();
  }
  await page.goto("/admin?tab=site");
  await expect(page.getByText("站点社交与外部主页链接", { exact: true })).toBeVisible();
  await expect(page.getByLabel("页脚", { exact: true })).toBeVisible();
});
