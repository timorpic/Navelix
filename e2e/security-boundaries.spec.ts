import { test, expect } from "@playwright/test";

test("HTTP security: CSRF, revision guard, member privacy, delegation and token revocation", async ({ page, browser }) => {
  await page.goto("/login");
  await page.fill("#login-username", "admin");
  await page.fill("#login-password", "e2e-test-password");
  await page.getByRole("button", { name: "立即登录" }).click();
  await page.waitForURL("/");
  const origin = new URL(page.url()).origin;
  const otherPort = new URL(origin); otherPort.port = "3999";
  expect((await page.request.post("/api/user/data", { headers: { origin: otherPort.origin }, data: { links: [], categories: [] } })).status()).toBe(403);
  expect((await page.request.post("/api/user/locale", { headers: { origin: otherPort.origin }, data: { language: "en" } })).status()).toBe(403);
  expect((await page.request.post("/api/user/data", { headers: { origin, "content-type": "text/plain" }, data: '{"links":[]}' })).status()).toBe(415);
  const before = await (await page.request.get("/api/user/data")).json();
  expect((await page.request.post("/api/user/data", { headers: { origin }, data: { links: [], categories: [] } })).status()).toBe(409);
  expect((await (await page.request.get("/api/user/data")).json()).links).toEqual(before.links);
  // A fabricated Bearer header must not bypass CSRF by falling back to session cookies.
  expect((await page.request.post("/api/user/data", { headers: { authorization: "Bearer invalid" }, data: { links: [], expectedRevision: before.revision } })).status()).toBe(401);
  // Loopback, link-local, cloud metadata and internal domain names stay blocked in every mode.
  for (const host of ["127.0.0.1", "169.254.169.254", "[::1]", "localhost"]) {
    expect((await page.request.get(`/api/favicon?url=${encodeURIComponent(`http://${host}/`)}`)).status()).toBe(400);
  }
  const username = `sec_${Date.now().toString().slice(-10)}`;
  const created = await page.request.post("/api/admin/users", { headers: { origin }, data: { username, password: "security-test-password" } });
  expect(created.status()).toBe(201);
  const { userId } = await created.json();
  const context = await browser.newContext();
  try {
    const member = await context.newPage();
    await member.goto("/login");
    await member.fill("#login-username", username); await member.fill("#login-password", "security-test-password");
    await member.getByRole("button", { name: "立即登录" }).click(); await member.waitForURL("/");
    const members = (await (await member.request.get("/api/user/members")).json()).members;
    expect(members.map((m: { id: string }) => m.id)).toEqual([userId]);
    expect(members[0]).not.toHaveProperty("role");
    expect((await member.request.get("/api/admin/users")).status()).toBe(403);
    expect((await member.request.post("/api/todos", { headers: { origin }, data: { title: "unauthorized assignment", assigneeId: before.user.id } })).status()).toBe(403);
    expect((await page.request.post("/api/todos", { headers: { origin }, data: { title: "authorized delegation", assigneeId: userId } })).status()).toBe(200);
    const delegated = (await (await member.request.get("/api/todos")).json()).todos.find((t: { title: string }) => t.title === "authorized delegation");
    expect((await member.request.patch(`/api/todos/${delegated.id}?ownerId=${before.user.id}`, { headers: { origin }, data: { assigneeId: before.user.id } })).status()).toBe(403);
    expect((await member.request.patch(`/api/todos/${delegated.id}?ownerId=${before.user.id}`, { headers: { origin }, data: { done: true } })).status()).toBe(200);
    const token = await (await member.request.post("/api/auth/api-tokens", { headers: { origin }, data: { name: "expiry" } })).json();
    expect(token.expiresAt).toBeGreaterThan(Date.now());
    expect((await member.request.get("/api/user/data", { headers: { authorization: `Bearer ${token.token}` } })).status()).toBe(200);
    await member.request.delete("/api/auth/api-tokens", { headers: { origin }, data: { id: token.tokenId } });
    expect((await member.request.get("/api/user/data", { headers: { authorization: `Bearer ${token.token}` } })).status()).toBe(401);
    expect((await member.request.get(`/api/calendar/export?token=${token.token}`)).status()).toBe(200); // valid browser session remains usable
  } finally {
    await context.close();
    await page.request.delete("/api/admin/users", { headers: { origin }, data: { id: userId } });
  }
});
