import { test, expect, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/login");
  await page.fill("#login-username", "admin");
  await page.fill("#login-password", "e2e-test-password");
  await page.getByRole("button", { name: "立即登录" }).click();
  await page.waitForURL("/");
}
const fixture = { icons: [{ title: "NAS", children: [
  { title: "Router", url: "http://192.168.1.1", description: "Local router" },
  { title: "Repeated", url: "http://192.168.1.1" },
] }] };
const file = { name: "sun-panel.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixture)) };

test("Sun-Panel: empty entry, persisted counts, repeat import, and failed save", async ({ page }, testInfo) => {
  await login(page);
  await page.evaluate(async () => {
    const current = await (await fetch("/api/user/data")).json();
    const response = await fetch("/api/user/data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ categories: [], links: [], expectedRevision: current.revision }) });
    if (!response.ok) throw new Error("Unable to clear test workspace");
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "已经在用 Sun-Panel？" })).toBeVisible();
  const card = page.locator('section[aria-labelledby="migration-heading"]');
  await card.screenshot({ caret: "initial", path: testInfo.outputPath('sun-panel-import-empty.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await expect(card).toBeVisible();
  expect(await card.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await card.screenshot({ caret: "initial", path: testInfo.outputPath('sun-panel-import-empty-mobile-dark.png') });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => document.documentElement.classList.remove("dark"));
  await page.getByLabel("选择 Sun-Panel JSON").setInputFiles(file);
  const dialog = page.getByRole("dialog", { name: "Sun-Panel 导入完成" });
  await expect(dialog).toContainText("已新增 1 个分组、1 个链接，跳过 1 个重复网址");
  await dialog.screenshot({ caret: "initial", path: testInfo.outputPath('sun-panel-import-result.png') });
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("link", { name: "查看日历待办" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "已经在用 Sun-Panel？" })).toHaveCount(0);
  const saved = await page.evaluate(async () => (await fetch("/api/user/data")).json());
  expect(saved.links).toHaveLength(1);
  expect(saved.links[0].url).toBe("http://192.168.1.1");
  await page.goto("/admin?tab=account");
  await page.getByLabel("选择 Sun-Panel JSON").setInputFiles(file);
  await expect(dialog).toContainText("已新增 0 个分组、0 个链接，跳过 2 个重复网址");
  await page.keyboard.press("Escape");
  await page.route("**/api/user/data", async route => {
    if (route.request().method() === "POST") await route.fulfill({ status: 500, contentType: "application/json", body: '{}' });
    else await route.continue();
  });
  await page.getByLabel("选择 Sun-Panel JSON").setInputFiles({ ...file, buffer: Buffer.from(JSON.stringify({ items: [{ title: "Failed", url: "https://example.com/failed" }] })) });
  await expect(page.getByText("导入未完成：", { exact: false })).toBeVisible();
  await expect(dialog).toHaveCount(0);
  await page.unroute("**/api/user/data");
  await page.reload();
  expect((await page.evaluate(async () => (await fetch("/api/user/data")).json())).links).toHaveLength(1);
  await page.getByLabel("选择 HTML 书签").setInputFiles({ name: "bookmarks.html", mimeType: "text/html", buffer: Buffer.from('<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><DT><A HREF="https://example.com/browser">Browser bookmark</A></DL>') });
  await expect.poll(async () => (await page.evaluate(async () => (await fetch("/api/user/data")).json())).links.length).toBe(2);
  await page.evaluate(async () => {
    const response = await fetch("/api/user/locale", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language: "en" }) });
    if (!response.ok) throw new Error("Unable to switch locale");
  });
  await page.reload();
  await page.locator('input[name="sun-panel-file"]').setInputFiles(file);
  await expect(page.getByRole("dialog", { name: "Sun-Panel import complete" })).toContainText("Added 0 categories and 0 links; skipped 2 duplicate URLs.");
  await page.evaluate(async () => {
    await fetch("/api/user/locale", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language: "zh-CN" }) });
  });
});
