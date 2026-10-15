import { expect, test, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/login");
  await page.fill("#login-username", "admin");
  await page.fill("#login-password", "e2e-test-password");
  await page.getByRole("button", { name: "立即登录" }).click();
  await page.waitForURL("/");
}
async function write(page: Page, url: string, body: unknown) {
  return page.evaluate(async ({ url, body }) => {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return response.status;
  }, { url, body });
}

test("助手覆盖主内容，快捷操作与悬浮入口共用会话，旧展开偏好不自动打开", async ({ page }) => {
  await login(page);
  await page.evaluate(() => { localStorage.setItem("navelix_sidebar_right", "false"); document.cookie = "navelix_sidebar_right=0;path=/"; });
  await page.reload();
  const drawer = page.getByRole("dialog", { name: "AI 助手", exact: true });
  await expect(drawer).toBeHidden();
  const width = await page.locator("main").evaluate(element => element.getBoundingClientRect().width);
  const requests: { conversationId: string; history: unknown[] }[] = [];
  await page.route("**/api/ai/chat", async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ json: { text: `已收到你的安排请求 ${requests.length}` } });
  });
  const launcher = page.getByRole("button", { name: "AI 助手", exact: true }).last();
  await launcher.click();
  await expect(drawer).toBeVisible();
  expect(await page.locator("main").evaluate(element => element.getBoundingClientRect().width)).toBe(width);
  const input = drawer.getByRole("textbox");
  await expect(input).toBeFocused();
  await input.fill("帮我安排今天"); await input.press("Enter");
  await expect(drawer.getByText("已收到你的安排请求 1", { exact: false })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden(); await expect(launcher).toBeFocused();
  const quickAction = page.locator("main").getByRole("button", { name: /AI 助手/ });
  await quickAction.click();
  await expect(drawer.getByText("已收到你的安排请求 1", { exact: false })).toBeVisible();
  await input.fill("继续"); await input.press("Enter");
  await expect(drawer.getByText("已收到你的安排请求 2", { exact: false })).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[1].conversationId).toBe(requests[0].conversationId);
  expect(requests[1].history).toHaveLength(2);
  await drawer.getByRole("button", { name: "关闭 AI 助手" }).click();
  await expect(quickAction).toBeFocused();
  await page.getByRole("button", { name: /项目管理/ }).click();
  await launcher.click(); await expect(drawer.getByText("已收到你的安排请求 2", { exact: false })).toBeVisible();
});

test("顶部通知和首页动态共享真实记录，全部已读不完成待办", async ({ page }) => {
  await login(page);
  expect(await write(page, "/api/user/data", { config: { pendingRemindersEnabled: true, todayActivityEnabled: true } })).toBe(200);
  expect(await write(page, "/api/notifications", { title: "布局回归通知", content: "通知与动态共享同一条记录" })).toBe(201);
  expect(await write(page, "/api/todos", { title: "需要保留的未完成待办", priority: "high" })).toBe(200);
  await page.reload();
  await expect(page.getByRole("region", { name: "最近动态" }).getByText("通知与动态共享同一条记录")).toBeVisible();
  const bell = page.getByRole("button", { name: "提醒与通知", exact: true });
  await bell.click();
  const popover = page.getByRole("region", { name: "提醒与通知", exact: true });
  await expect(popover.getByText("布局回归通知")).toBeVisible();
  await expect(popover.getByText("需要保留的未完成待办")).toBeVisible();
  const [readResponse] = await Promise.all([
    page.waitForResponse(response => response.url().endsWith("/api/notifications/read") && response.request().method() === "POST"),
    popover.getByRole("button", { name: "通知全部已读" }).click(),
  ]);
  expect(readResponse.ok()).toBe(true);
  await expect(popover.getByRole("button", { name: "通知全部已读" })).toBeDisabled();
  await expect.poll(() => page.evaluate(async () => (await (await fetch("/api/notifications")).json()).unreadCount), { timeout: 15_000 }).toBe(0);
  await expect(popover.getByText("需要保留的未完成待办")).toBeVisible();
  await page.keyboard.press("Escape"); await expect(popover).toBeHidden(); await expect(bell).toBeFocused();
  await bell.click(); await popover.getByRole("button", { name: "查看全部", exact: false }).click();
  await expect(page.getByRole("heading", { name: /消息通知与活动动态/ })).toBeVisible();
  const record = page.getByRole("row").filter({ hasText: "通知与动态共享同一条记录" });
  await record.getByTitle("删除此记录").click();
  await page.getByRole("dialog").getByRole("button", { name: "删除", exact: true }).click();
  await expect(record).toHaveCount(0);
  await bell.click();
  await expect(popover.getByText("布局回归通知")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /首页总览/ }).click();
  await expect(page.getByRole("region", { name: "最近动态" }).getByText("通知与动态共享同一条记录")).toHaveCount(0);
});

test("手机抽屉适配视口、展示服务端错误；禁用后两个入口同时隐藏", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.route("**/api/ai/chat", route => route.fulfill({ status: 503, json: { message: "助手服务暂时不可用" } }));
  await page.getByRole("button", { name: "AI 助手", exact: true }).last().click();
  const drawer = page.getByRole("dialog", { name: "AI 助手", exact: true });
  const rect = await drawer.boundingBox();
  expect(rect!.x).toBeGreaterThanOrEqual(0); expect(rect!.x + rect!.width).toBeLessThanOrEqual(390);
  await drawer.getByRole("textbox").fill("帮我查找书签");
  await drawer.getByRole("button", { name: "发送", exact: true }).click();
  await expect(drawer.getByRole("alert")).toHaveText("助手服务暂时不可用");
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await write(page, "/api/user/data", { config: { aiCopilotEnabled: false } })).toBe(200);
  await page.reload();
  await expect(page.getByRole("button", { name: "AI 助手", exact: true })).toHaveCount(0);
  expect(await write(page, "/api/user/data", { config: { aiCopilotEnabled: true } })).toBe(200);
});
