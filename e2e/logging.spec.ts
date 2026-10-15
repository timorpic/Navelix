import { test, expect, type Page } from "@playwright/test";
async function login(page: Page) {
  await page.goto("/login"); await page.fill("#login-username", "admin"); await page.fill("#login-password", "e2e-test-password");
  await page.getByRole("button", { name: "立即登录" }).click(); await page.waitForURL("/");
}
async function write(page: Page, url: string, body: unknown, method = "POST") {
  return page.evaluate(async ({ url, body, method }) => {
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json().catch(() => null), requestId: response.headers.get("x-request-id") };
  }, { url, body, method });
}
test("日志中心按功能查询、关联、导出，设置及清理需要确认", async ({ page }) => {
  await login(page);
  const project = await write(page, "/api/projects", { name: "private-project-content-should-not-be-logged" }); expect(project.status).toBe(200); expect(project.requestId).toBeTruthy();
  const link = await write(page, "/api/links", { title: "private-bookmark-title", url: "https://example.com/?token=private-query-secret" }); expect(link.status).toBe(201);
  await page.goto("/admin?tab=links");
  await expect(page.locator("main").getByText("链接总数", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "日志中心", exact: true }).click();
  await expect(page.locator("main").getByText("链接总数", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "日志中心", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "项目与日程", exact: true }).click();
  await expect(page.getByText("project.created", { exact: true })).toBeVisible();
  const result = await page.evaluate(async () => (await fetch("/api/admin/logs?category=workspace")).json());
  expect(JSON.stringify(result)).not.toContain("private-project-content-should-not-be-logged");
  await page.getByRole("button", { name: "详情", exact: true }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "查看本次操作的关联日志" }).click();
  await expect(page.getByText("project.created", { exact: true })).toBeVisible();
  const exported = await write(page, "/api/admin/logs/export?format=jsonl", {}); expect(exported.status).toBe(200);
  await page.getByRole("button", { name: "日志设置", exact: true }).click();
  await expect(page.getByLabel("审计保留时间")).toBeVisible();
  await page.getByRole("button", { name: "保存设置", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("button", { name: "确认删除", exact: true })).toHaveCount(0);
  const save = page.getByRole("dialog").getByRole("button", { name: "确认保存", exact: true });
  await expect(save).toHaveClass(/bg-\[#00C776\]/);
  await save.click();
  await expect(page.getByText("操作完成", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "预览并清理", exact: true }).click();
  await expect(page.getByText(/没有过期或超出容量限制的日志需要清理/)).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const invalid = await write(page, "/api/admin/logs/cleanup", { token: "invalid" }); expect(invalid.status).toBe(400);
  await page.goto("/admin?tab=auditLogs"); await expect(page.getByRole("heading", { name: "日志中心", exact: true })).toBeVisible();
});
test("普通账号无法读取、导出或清理全站日志，前端只接受白名单事件", async ({ page, browser }) => {
  await login(page);
  const username = `loguser_${Date.now().toString().slice(-8)}`;
  expect((await write(page, "/api/admin/users", { username, password: "isolated-member-password", role: "user" })).status).toBe(201);
  const context = await browser.newContext(); const member = await context.newPage();
  try {
    await member.goto("/login"); await member.fill("#login-username", username); await member.fill("#login-password", "isolated-member-password"); await member.getByRole("button", { name: "立即登录" }).click(); await member.waitForURL("/");
    for (const path of ["/api/admin/logs", "/api/admin/logs/stats", "/api/admin/logs/settings"]) expect(await member.evaluate(async path => (await fetch(path)).status, path)).toBe(403);
    for (const path of ["/api/admin/logs/export", "/api/admin/logs/cleanup-preview", "/api/admin/logs/cleanup"]) expect((await write(member, path, {})).status).toBe(403);
    expect((await write(page, "/api/admin/logs/settings", { settings: { frontendEnabled: true } }, "PATCH")).status).toBe(200);
    expect((await write(member, "/api/logs/frontend", { code: "render-error", body: "private-content" })).status).toBe(400);
    expect((await write(member, "/api/logs/frontend", { code: "render-error" })).status).toBe(204);
    expect((await write(page, "/api/admin/logs/settings", { settings: { frontendEnabled: false } }, "PATCH")).status).toBe(200);
  } finally { await context.close(); }
});

test("日志每页可选 20/50/100，改变条数保留筛选并回到第一页", async ({ page }) => {
  await login(page);
  for (let i = 0; i < 12; i++) {
    expect((await write(page, "/api/projects", { name: `pagination-fixture-${i}` })).status).toBe(200);
  }
  await page.goto("/admin?tab=logs");
  await expect(page.getByRole("heading", { name: "日志中心", exact: true })).toBeVisible();
  const size = page.getByRole("combobox", { name: "每页显示条数", exact: true });
  await expect(size).toHaveValue("20");
  expect(await size.locator("option").evaluateAll(options => options.map(option => (option as HTMLOptionElement).value))).toEqual(["20", "50", "100"]);
  await page.getByRole("button", { name: "项目与日程", exact: true }).click();
  const responseFor = (limit: number, cursor: boolean) => page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === "/api/admin/logs" && url.searchParams.get("limit") === String(limit) && url.searchParams.get("category") === "workspace" && url.searchParams.has("cursor") === cursor;
  });
  const initialFifty = responseFor(50, false); await size.selectOption("50"); expect((await initialFifty).status()).toBe(200);
  const first = responseFor(20, false); await size.selectOption("20"); const firstResponse = await first; expect(firstResponse.status()).toBe(200);
  const { total } = await firstResponse.json() as { total: number };
  await expect(page.getByText(`第 1 / ${Math.ceil(total / 20)} 页，共 ${total} 条`, { exact: true })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(20);
  const second = responseFor(20, true); await page.getByRole("button", { name: "下一页", exact: true }).click(); expect((await second).status()).toBe(200);
  await expect(page.getByRole("button", { name: "上一页", exact: true })).toBeEnabled();
  await expect(page.getByText(`第 2 / ${Math.ceil(total / 20)} 页，共 ${total} 条`, { exact: true })).toBeVisible();
  const hundred = responseFor(100, false); await size.selectOption("100"); expect((await hundred).status()).toBe(200);
  await expect(page.getByRole("button", { name: "上一页", exact: true })).toBeDisabled();
  await expect.poll(() => page.locator("tbody tr").count()).toBeGreaterThan(20);
  await expect(page.getByText(`第 1 / ${Math.ceil(total / 100)} 页，共 ${total} 条`, { exact: true })).toBeVisible();
  const fifty = responseFor(50, false); await size.selectOption("50"); expect((await fifty).status()).toBe(200);
  await expect(page.getByRole("button", { name: "上一页", exact: true })).toBeDisabled();
  await page.route("**/api/admin/logs?**", route => route.fulfill({ status: 503, json: { error: "test query failure" } }));
  await size.selectOption("20");
  await expect(page.getByRole("alert").filter({ hasText: "操作失败，请重试或检查筛选及设置" })).toHaveText("操作失败，请重试或检查筛选及设置");
  await expect(page.getByRole("button", { name: "上一页", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "下一页", exact: true })).toBeDisabled();
});


test("日志设置可重试，统计故障不阻塞保存，表单与确认框支持键盘操作", async ({ page }) => {
  await login(page);
  await page.goto("/admin?tab=logs");
  await expect(page.getByText(/^第 1 \/ .* 页，共 .* 条$/)).toBeVisible();
  await expect(page.getByLabel("日志级别", { exact: true }).locator('option[value="error"]')).toHaveText("错误");
  await expect(page.getByLabel("来源", { exact: true }).locator('option[value="frontend"]')).toHaveText("前端");
  await page.screenshot({ path: "/tmp/navelix-final-logs-desktop.png", fullPage: true, animations: "disabled" });
  await page.route("**/api/admin/logs/stats", route => route.fulfill({ status: 503, json: { error: "test statistics failure" } }));
  let failLoad = true;
  await page.route("**/api/admin/logs/settings", route => {
    if (route.request().method() === "GET" && failLoad) {
      return route.fulfill({ status: 503, json: { error: "test settings failure" } });
    }
    return route.continue();
  });
  await page.getByRole("button", { name: "日志设置", exact: true }).click();
  await expect(page.getByText("操作失败，请重试或检查筛选及设置", { exact: true })).toBeVisible();
  failLoad = false;
  await page.getByRole("button", { name: "刷新", exact: true }).click();
  const retention = page.getByLabel("运行日志保留天数", { exact: true });
  await expect(retention).toBeVisible();
  await retention.fill("91");
  await page.getByRole("button", { name: "保存设置", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await retention.evaluate(input => (input as HTMLInputElement).validity.rangeOverflow)).toBe(true);
  await retention.fill("14");
  await page.getByRole("button", { name: "保存设置", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeFocused();
  await expect(retention).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(retention).toBeEnabled();
  await page.getByRole("button", { name: "保存设置", exact: true }).click();
  await page.getByRole("button", { name: "确认保存", exact: true }).click();
  await expect(page.getByText("操作完成", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/navelix-final-settings-mobile.png", fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: "日志记录", exact: true }).click();
  await expect(page.getByText(/^第 1 \/ .* 页，共 .* 条$/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/navelix-final-logs-mobile.png", fullPage: true, animations: "disabled" });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.screenshot({ path: "/tmp/navelix-final-logs-mobile-dark.png", fullPage: true, animations: "disabled" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole("button", { name: "日志设置", exact: true }).click();
  await page.getByRole("button", { name: "保存设置", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeFocused();
  await page.screenshot({ path: "/tmp/navelix-final-confirm-dark.png", fullPage: true, animations: "disabled" });
  await page.keyboard.press("Escape");
});
