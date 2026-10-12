import { test, expect } from "@playwright/test";

const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";

test("在线网站图标：获取结果可预览，失败明确提示，接口保留鉴权与协议校验", async ({ page }) => {
  expect((await page.request.get("/api/favicon?url=https://www.timor.eu.org")).status()).toBe(401);
  await page.goto("/login");
  await page.fill("#login-username", "admin");
  await page.fill("#login-password", "e2e-test-password");
  await page.getByRole("button", { name: "立即登录" }).click();
  await page.waitForURL("/");
  expect((await page.request.get("/api/favicon?url=invalid")).status()).toBe(400);
  expect((await page.request.get("/api/favicon?url=file:///etc/passwd")).status()).toBe(400);
  await page.goto("/admin?tab=links");
  await page.getByRole("button", { name: "添加新链接" }).click();
  await page.locator("#link-url").fill("https://www.timor.eu.org/");
  await page.getByRole("button", { name: "网站图标" }).click();
  let success = false;
  await page.route("**/api/favicon?**", async route => {
    expect(new URL(route.request().url()).searchParams.get("url")).toBe("https://www.timor.eu.org/");
    await route.fulfill({ status: success ? 200 : 502, contentType: "application/json", body: JSON.stringify(success
      ? { dataUrl: png, iconUrl: "https://www.timor.eu.org/assets/logo_shuwei_zhiyu.png" }
      : { error: "未找到可用的网站图标，请检查网址或上传图标" }) });
  });
  await page.getByRole("button", { name: "抓取图标", exact: true }).click();
  await expect(page.getByText("未找到可用的网站图标，请检查网址或上传图标", { exact: true })).toBeVisible();
  success = true;
  await page.getByRole("button", { name: "抓取图标", exact: true }).click();
  const preview = page.locator(`img[src="${png}"]`);
  await expect(preview).toBeVisible();
  await expect.poll(() => preview.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
});
