import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, username = "admin", password = "e2e-test-password") {
  await page.goto("/login");
  await page.fill("#login-username", username);
  await page.fill("#login-password", password);
  await page.getByRole("button", { name: "立即登录" }).click();
  await page.waitForURL("/");
}

test("physical backup restore: browser password confirmation, CSRF and persisted snapshot", async ({ page }) => {
  await login(page);
  const origin = new URL(page.url()).origin;
  const headers = { origin };
  const savedFooter = `restore-before-${Date.now()}`;
  expect((await page.request.post("/api/user/data", { headers, data: { config: { customFooter: savedFooter } } })).ok()).toBe(true);
  const backup = await page.request.get("/api/admin/backup");
  expect(backup.ok()).toBe(true);
  const buffer = await backup.body();
  expect(buffer.subarray(0, 16).toString()).toBe("SQLite format 3\0");
  const changedFooter = "restore-after";
  expect((await page.request.post("/api/user/data", { headers, data: { config: { customFooter: changedFooter } } })).ok()).toBe(true);
  const multipart = { file: { name: "snapshot.db", mimeType: "application/x-sqlite3", buffer }, confirmPassword: "e2e-test-password" };
  expect((await page.request.post("/api/admin/backup", { headers: { origin: "https://evil.example" }, multipart })).status()).toBe(403);
  expect((await page.request.post("/api/admin/backup", { headers, multipart: { ...multipart, confirmPassword: "wrong-password" } })).status()).toBe(403);
  expect((await page.request.post("/api/admin/backup", { headers, multipart: { file: multipart.file } })).status()).toBe(403);
  expect((await (await page.request.get("/api/user/data")).json()).config.customFooter).toBe(changedFooter);

  await page.goto("/admin?tab=system");
  await page.locator('input[name="dbRestoreFile"]').setInputFiles({ name: "snapshot.db", mimeType: "application/x-sqlite3", buffer });
  const dialog = page.getByRole("dialog", { name: "还原数据库", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "还原", exact: true })).toBeDisabled();
  await dialog.locator('input[name="confirmPassword"]').fill("wrong-password");
  const failed = page.waitForResponse(response => response.url().endsWith("/api/admin/backup") && response.request().method() === "POST");
  await dialog.getByRole("button", { name: "还原", exact: true }).click();
  expect((await failed).status()).toBe(403);
  await expect(dialog.getByRole("status")).toContainText("当前管理员密码");
  await expect(dialog.locator('input[name="confirmPassword"]')).toHaveValue("");
  await dialog.locator('input[name="confirmPassword"]').fill("e2e-test-password");
  const restored = page.waitForResponse(response => response.url().endsWith("/api/admin/backup") && response.request().method() === "POST");
  await dialog.getByRole("button", { name: "还原", exact: true }).click();
  expect((await restored).status()).toBe(200);
  // Restore invalidates browser sessions; reauthentication must use the snapshot's account.
  await page.waitForURL("/login", { timeout: 20_000 });
  await login(page);
  expect((await (await page.request.get("/api/user/data")).json()).config.customFooter).toBe(savedFooter);
});

test("delegated task edits work in admin and calendar views while transfers remain forbidden", async ({ page, browser }) => {
  await login(page);
  const origin = new URL(page.url()).origin;
  const headers = { origin };
  const username = `edit_${Date.now().toString().slice(-10)}`;
  const created = await page.request.post("/api/admin/users", { headers, data: { username, password: "delegated-test-password" } });
  expect(created.status()).toBe(201);
  const { userId } = await created.json();
  const ownerId = (await (await page.request.get("/api/user/data")).json()).user.id;
  const today = await page.evaluate(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const taskTitle = `delegated-${Date.now()}`;
  const result = await page.request.post("/api/todos", { headers, data: { title: taskTitle, dueDate: today, assigneeId: userId } });
  expect(result.ok()).toBe(true);
  const id = (await result.json()).todo.id;
  const context = await browser.newContext();
  try {
    const member = await context.newPage();
    await login(member, username, "delegated-test-password");
    await member.goto("/admin?tab=schedules");
    const row = member.getByRole("row").filter({ hasText: taskTitle });
    await expect(row.getByRole("button", { name: "删除", exact: true })).toHaveCount(0);
    await row.getByRole("button", { name: "编辑", exact: true }).click();
    const adminDialog = member.getByRole("dialog", { name: "编辑日程安排", exact: true });
    await expect(adminDialog.locator('select[name="formProjectId"]')).toBeDisabled();
    const adminTitle = `${taskTitle}-admin`;
    await adminDialog.locator('input[name="formTitle"]').fill(adminTitle);
    const adminSaved = member.waitForResponse(response => response.request().method() === "PATCH" && response.url().includes(`/api/todos/${id}`));
    await adminDialog.getByRole("button", { name: "保存日程" }).click();
    expect((await adminSaved).status()).toBe(200);
    await expect(adminDialog).toBeHidden();

    await member.goto("/");
    await member.getByRole("button", { name: /日历日程/ }).click();
    const task = member.locator("div").filter({ has: member.locator("span").filter({ hasText: new RegExp(`^${adminTitle}$`) }) });
    // The selected day's task row contains its title and a single pencil edit button.
    await task.filter({ has: member.getByRole("button", { name: "✏️", exact: true }) }).last().getByRole("button", { name: "✏️", exact: true }).click();
    const calendarDialog = member.getByRole("dialog", { name: "编辑日程事项", exact: true });
    await expect(calendarDialog.locator('select[name="formAssigneeId"]')).toBeDisabled();
    await expect(calendarDialog.getByRole("button", { name: "删除事项" })).toHaveCount(0);
    const calendarTitle = `${taskTitle}-calendar`;
    await calendarDialog.locator('input[name="formTitle"]').fill(calendarTitle);
    const calendarSaved = member.waitForResponse(response => response.request().method() === "PATCH" && response.url().includes(`/api/todos/${id}`));
    await calendarDialog.getByRole("button", { name: "保存更新", exact: true }).click();
    expect((await calendarSaved).status()).toBe(200);
    await expect(calendarDialog).toBeHidden();
    const todos = (await (await page.request.get("/api/todos")).json()).todos as Array<{ id: string; title: string; assigneeId: string }>;
    expect(todos.find(todo => todo.id === id)).toMatchObject({ title: calendarTitle, assigneeId: userId });
    expect((await member.request.patch(`/api/todos/${id}?ownerId=${ownerId}`, { headers, data: { assigneeId: ownerId } })).status()).toBe(403);
    expect((await member.request.patch(`/api/todos/${id}?ownerId=${ownerId}`, { headers, data: { projectId: "" } })).status()).toBe(403);
  } finally {
    await context.close();
    await page.request.delete(`/api/admin/users/${userId}`, { headers });
  }
});
