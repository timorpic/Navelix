import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, username: string) {
  await page.goto("/login");
  await page.fill("#login-username", username);
  await page.fill("#login-password", "e2e-test-password");
  await page.getByRole("button", { name: "立即登录" }).click();
  await page.waitForURL("/");
}

test("首页快捷日程仅为自己新增，不提供人员选择且不会出现在其他账号中", async ({ page, browser }) => {
  await login(page, "admin");
  const username = `agenda_${Date.now()}`;
  const created = await page.evaluate(async username => {
    const response = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password: "e2e-test-password", role: "user" }) });
    return response.status;
  }, username);
  expect(created).toBe(201);
  await page.reload();
  await expect(page.getByLabel("快捷添加日程事项")).toBeVisible();
  await expect(page.locator('select[name="quickTodoAssignee"]')).toHaveCount(0);
  const title = `个人日程-${Date.now()}`;
  await page.getByLabel("快捷添加日程事项").fill(title);
  await page.locator('select[name="quickTodoPriority"]').selectOption("high");
  const saved = page.waitForResponse(response => response.url().endsWith("/api/todos") && response.request().method() === "POST");
  await page.locator("form").filter({ has: page.locator("#overview-quick-todo-input") }).getByRole("button", { name: "添加", exact: true }).click();
  const response = await saved;
  expect(response.ok()).toBe(true);
  expect(response.request().postDataJSON()).toMatchObject({ title, priority: "high" });
  expect(response.request().postDataJSON()).not.toHaveProperty("assigneeId");
  expect(response.request().postDataJSON()).not.toHaveProperty("assigneeName");
  await expect(page.getByLabel("快捷添加日程事项")).toHaveValue("");
  const own = await (await page.request.get("/api/todos")).json() as { todos: { title: string; assigneeId?: string }[] };
  const todo = own.todos.find(item => item.title === title);
  expect(todo).toBeDefined(); expect(todo?.assigneeId).toBeFalsy();
  const context = await browser.newContext();
  try {
    const member = await context.newPage(); await login(member, username);
    const other = await (await member.request.get("/api/todos")).json() as { todos: { title: string }[] };
    expect(other.todos.some(item => item.title === title)).toBe(false);
    await expect(member.getByLabel("快捷添加日程事项")).toBeVisible();
    await expect(member.locator('select[name="quickTodoAssignee"]')).toHaveCount(0);
    await expect(member.getByText(title, { exact: true })).toHaveCount(0);
  } finally { await context.close(); }
});
