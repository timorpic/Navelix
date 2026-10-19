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

test("助手覆盖主内容，快捷操作与搜索栏入口共用会话，旧展开偏好不自动打开", async ({ page }) => {
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
  const launcher = page.getByRole("button", { name: "AI 助手", exact: true }).first();
  await launcher.click();
  await expect(drawer).toBeVisible();
  expect(await page.locator("main").evaluate(element => element.getBoundingClientRect().width)).toBe(width);
  const input = drawer.getByRole("textbox");
  await expect(input).toBeFocused();
  await input.fill("帮我安排今天"); await input.press("Enter");
  await expect(drawer.getByText("已收到你的安排请求 1", { exact: false })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden(); await expect(launcher).toBeFocused();
  const quickAction = page.locator("main").getByRole("button", { name: /AI 助手/ }).last();
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

test("AI 删除确认卡：按钮走确定性接口，取消后数据仍在", async ({ page }) => {
  await login(page);
  const title = `删除确认卡回归 ${Date.now().toString().slice(-8)}`;
  expect(await write(page, "/api/todos", { title, priority: "high" })).toBe(200);
  const pendingId = "c".repeat(32);
  await page.route("**/api/ai/chat", route => route.fulfill({
    json: { text: `我将删除「${title}」。`, deletions: [{ pendingId, targetName: title, message: `⚠️ 将删除「${title}」。` }] },
  }));
  const decisions: Record<string, unknown>[] = [];
  await page.route("**/api/ai/confirm-delete", async route => {
    decisions.push(route.request().postDataJSON());
    await route.fulfill({ json: { success: true, message: "已取消删除操作。" } });
  });
  await page.getByRole("button", { name: "AI 助手", exact: true }).last().click();
  const drawer = page.getByRole("dialog", { name: "AI 助手", exact: true });
  await drawer.getByRole("textbox").fill("删除这个待办");
  await drawer.getByRole("button", { name: "发送", exact: true }).click();
  await expect(drawer.getByRole("button", { name: "确认删除", exact: true })).toBeVisible();
  await drawer.getByRole("button", { name: "取消", exact: true }).click();
  await expect.poll(() => decisions.length).toBe(1);
  expect(decisions[0]).toEqual({ pendingId, decision: "cancel" });
  await expect(drawer.getByText("已取消删除操作。", { exact: false })).toBeVisible();
  // 待办没有被删除：数据仍在
  const todos = await page.evaluate(async () => (await (await fetch("/api/user/data", { cache: "no-store" })).json()).todos as { title: string }[]);
  expect(todos.some(todo => todo.title === title)).toBe(true);
});

test("首页精简入口，专注归入日程概览，通知记录仍可从消息页查看", async ({ page }) => {
  await login(page);
  expect(await write(page, "/api/notifications", { title: "布局回归通知", content: "消息页面保留完整记录" })).toBe(201);
  await page.reload();
  await expect(page.getByRole("region", { name: "最近动态" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "提醒与通知", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "记录想法", exact: false })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "上传文件", exact: false })).toHaveCount(0);
  const schedule = page.locator("div").filter({ has: page.getByRole("heading", { name: "日程概览", exact: true }) }).filter({ hasText: "今日专注" });
  await expect(schedule.last().getByText("今日专注", { exact: true })).toBeVisible();
  await expect(page.getByText("今日专注", { exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: /消息通知/ }).click();
  await expect(page.getByRole("heading", { name: /消息通知与活动动态/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "提醒与通知", exact: true })).toHaveCount(0);
  const record = page.getByRole("row").filter({ hasText: "消息页面保留完整记录" });
  await expect(record).toBeVisible();
  await record.getByTitle("删除此记录").click();
  await page.getByRole("dialog").getByRole("button", { name: "删除", exact: true }).click();
  await expect(record).toHaveCount(0);
  await page.getByRole("button", { name: /首页总览/ }).click();
  await expect(page.getByRole("region", { name: "最近动态" })).toHaveCount(0);
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
