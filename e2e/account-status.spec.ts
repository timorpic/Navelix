import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, username: string, password: string) {
  await page.goto("/login");
  await page.fill("#login-username", username);
  await page.fill("#login-password", password);
  await page.getByRole("button", { name: "立即登录" }).click();
  await page.waitForURL("/");
}
async function write(page: Page, path: string, body: unknown, method = "POST") {
  return page.evaluate(async ({ path, body, method }) => {
    const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  }, { path, body, method });
}

test("账号停用：保留数据、立即撤销会话和密钥，启用后重新登录", async ({ page, browser, request }) => {
  await login(page, "admin", "e2e-test-password");
  const username = `status_${Date.now().toString().slice(-9)}`;
  const password = "status-test-password";
  const created = await write(page, "/api/admin/users", { username, password, role: "user" });
  expect(created.status).toBe(201);
  const id: string = created.data.userId;
  const context = await browser.newContext();
  const member = await context.newPage();
  try {
    await login(member, username, password);
    const issued = await write(member, "/api/auth/api-tokens", { name: "status-test" });
    expect(issued.status).toBe(200);
    const token: string = issued.data.token;
    expect((await write(member, "/api/user/data", { config: { linkOpenTarget: "_self" } })).status).toBe(200);
    expect((await write(member, "/api/admin/users", { id, disabled: true }, "PATCH")).status).toBe(403);
    expect((await write(page, "/api/admin/users", { id, disabled: "true" }, "PATCH")).status).toBe(400);
    await page.goto("/admin?tab=users");
    const own = page.getByRole("row").filter({ has: page.getByText("@admin", { exact: true }) });
    await expect(own.getByRole("button", { name: "停用", exact: true })).toBeDisabled();
    const row = page.getByRole("row").filter({ has: page.getByText(`@${username}`, { exact: true }) });
    await expect(row.getByText("正常", { exact: true })).toBeVisible();
    await row.getByRole("button", { name: "停用", exact: true }).click();
    await page.getByRole("button", { name: "取消", exact: true }).click();
    await expect(row.getByText("正常", { exact: true })).toBeVisible();
    await row.getByRole("button", { name: "停用", exact: true }).click();
    await page.getByRole("button", { name: "确认停用", exact: true }).click();
    await expect(row.getByText("已停用", { exact: true })).toBeVisible();
    expect(await member.evaluate(async () => (await fetch("/api/user/data")).status)).toBe(401);
    expect((await request.get("/api/user/data", { headers: { authorization: `Bearer ${token}` } })).status()).toBe(401);
    expect((await write(member, "/api/auth/login", { username, password })).status).toBe(403);
    await row.getByRole("button", { name: "启用", exact: true }).click();
    await page.getByRole("button", { name: "确认启用", exact: true }).click();
    await expect(row.getByText("正常", { exact: true })).toBeVisible();
    expect(await member.evaluate(async () => (await fetch("/api/user/data")).status)).toBe(401);
    expect((await request.get("/api/user/data", { headers: { authorization: `Bearer ${token}` } })).status()).toBe(401);
    expect((await write(member, "/api/auth/login", { username, password })).status).toBe(200);
    const data = await member.evaluate(async () => (await fetch("/api/user/data")).json());
    expect(data.config.linkOpenTarget).toBe("_self");
  } finally { await context.close(); }
});
