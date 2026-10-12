import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, username = "admin", password = "e2e-test-password") {
  await page.goto("/login");
  await page.locator("#login-username").fill(username);
  await page.locator("#login-password").fill(password);
  await page.getByRole("button", { name: /^(立即登录|Sign in)$/ }).click();
  await page.waitForURL("/");
}

async function write(page: Page, path: string, body: unknown, method = "POST") {
  return page.evaluate(async ({ path, body, method }) => {
    const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  }, { path, body, method });
}

test("访客语言：浏览器识别、手动切换、Cookie 持久化与非法值拒绝", async ({ browser }) => {
  const context = await browser.newContext({ locale: "en-US" });
  const page = await context.newPage();
  try {
    await page.goto("/login");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
    await page.getByLabel("Language / 界面语言").selectOption("zh-CN");
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
    await page.reload();
    await expect(page.getByRole("button", { name: "立即登录", exact: true })).toBeVisible();
    const rejected = await write(page, "/api/user/locale", { language: "fr" });
    expect(rejected.status).toBe(400);
    expect(rejected.data.code).toBe("INVALID_LOCALE");
    await page.goto("/register");
    await expect(page.getByLabel("Language / 界面语言")).toHaveValue("zh-CN");
  } finally { await context.close(); }
});

// 登录/注册页是固定浅色设计，但根布局会按系统主题给 <html> 加 .dark。
// 固定浅色后，下拉框不应随系统深色变黑。
test("登录与注册页的语言下拉框在深色系统偏好下保持浅色", async ({ browser }) => {
  const context = await browser.newContext({ locale: "zh-CN", colorScheme: "dark" });
  const page = await context.newPage();
  const white = "rgb(255, 255, 255)";
  try {
    await page.goto("/login");
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.getByLabel("Language / 界面语言")).toHaveCSS("background-color", white);
    await page.goto("/register");
    await expect(page.getByLabel("Language / 界面语言")).toHaveCSS("background-color", white);
  } finally { await context.close(); }
});

test("账号语言：跨设备、用户隔离、英文新增任务和移动端后台", async ({ page, browser }) => {
  await login(page);
  const username = `locale_${Date.now()}`;
  expect((await write(page, "/api/admin/users", { username, password: "e2e-test-password", role: "user" })).status).toBe(201);
  const memberContext = await browser.newContext({ locale: "zh-CN" });
  const member = await memberContext.newPage();
  const errors: string[] = [];
  member.on("pageerror", error => errors.push(error.message));
  try {
    await login(member, username);
    await member.goto("/admin?tab=personalization");
    await member.getByLabel("Language / 界面语言").selectOption("en");
    await expect(member.locator("html")).toHaveAttribute("lang", "en");
    await expect(member.getByRole("heading", { name: "Appearance & preferences", exact: true })).toBeVisible();
    const stored = await (await member.request.get("/api/user/data")).json();
    expect(stored.config.language).toBe("en");
    await member.reload();
    await expect(member.locator("html")).toHaveAttribute("lang", "en");
    await member.goto("/");
    const title = `中文任务 / English task ${Date.now()}`;
    await member.getByLabel("Quick add schedule", { exact: true }).fill(title);
    const [created] = await Promise.all([
      member.waitForResponse(response => response.url().endsWith("/api/todos") && response.request().method() === "POST"),
      member.locator("form").filter({ has: member.locator("#overview-quick-todo-input") }).getByRole("button", { name: "Add", exact: true }).click(),
    ]);
    expect(created.ok()).toBe(true);
    const todos = await (await member.request.get("/api/todos")).json();
    expect(todos.todos.some((todo: { title: string }) => todo.title === title)).toBe(true);
    await expect(member.getByRole("main").getByText(title, { exact: true })).toBeVisible();
    const error = await write(member, "/api/todos", { title: "" });
    expect(error.status).toBe(400);
    expect(error.data.error).toBe("待办内容不能为空");
    expect(error.data.message).toBe("Task content is required");
    expect(error.data.code).toBeTruthy();
    const secondContext = await browser.newContext({ locale: "zh-CN" });
    try {
      const second = await secondContext.newPage();
      await login(second, username);
      await expect(second.locator("html")).toHaveAttribute("lang", "en");
      await second.setViewportSize({ width: 390, height: 844 });
      await second.goto("/admin?tab=personalization");
      await expect(second.getByRole("heading", { name: "Appearance & preferences" })).toBeVisible();
      expect(await second.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await second.getByLabel("Language / 界面语言").selectOption("zh-CN");
      await expect(second.locator("html")).toHaveAttribute("lang", "zh-CN");
    } finally { await secondContext.close(); }
    expect((await (await page.request.get("/api/user/data")).json()).config.language).toBe("zh-CN");
    expect(errors).toEqual([]);
  } finally { await memberContext.close(); }
});


test("新注册账号继承访客选择的语言", async ({ page, browser }) => {
  await login(page);
  const original = (await (await page.request.get("/api/user/data")).json()).config.allowRegistration;
  expect((await write(page, "/api/admin/settings", { allowRegistration: true }, "PATCH")).status).toBe(200);
  const context = await browser.newContext({ locale: "en-US" });
  try {
    const member = await context.newPage();
    await member.goto("/register");
    const result = await write(member, "/api/auth/register", { username: `nl_${Date.now()}`, password: "e2e-test-password" });
    expect(result.status).toBe(201);
    await member.goto("/");
    await expect(member.locator("html")).toHaveAttribute("lang", "en");
    expect((await (await member.request.get("/api/user/data")).json()).config.language).toBe("en");
  } finally {
    await context.close();
    await write(page, "/api/admin/settings", { allowRegistration: original }, "PATCH");
  }
});
