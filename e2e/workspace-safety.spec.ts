import { test, expect, type Page } from "@playwright/test";
import type { UserDataResult } from "../src/lib/user-data";

async function login(page: Page, username: string, password: string) {
  await page.goto("/login");
  await page.fill("#login-username", username); await page.fill("#login-password", password);
  await page.getByRole("button", { name: "立即登录" }).click(); await page.waitForURL("/");
}
async function data(page: Page): Promise<UserDataResult> {
  return page.evaluate(async () => (await fetch("/api/user/data", { cache: "no-store" })).json());
}
async function write(page: Page, path: string, body: unknown, method = "POST") {
  return page.evaluate(async ({ path, body, method }) => {
    const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  }, { path, body, method });
}
async function save(page: Page, patch: object) {
  const current = await data(page);
  const response = await write(page, "/api/user/data", { ...patch, expectedRevision: current.revision });
  expect(response.status).toBe(200);
}

test("工作区安全：同 ID 隔离、共享撤销、委托操作、过期快照及空工作区", async ({ page, browser }) => {
  test.setTimeout(120_000);
  await login(page, "admin", "e2e-test-password");
  const username = `safe_${Date.now().toString().slice(-10)}`;
  const created = await write(page, "/api/admin/users", { username, password: "safety-test-password" });
  expect(created.status).toBe(201);
  const memberId = created.data.userId as string;
  const ownerId = (await data(page)).user!.id;
  const context = await browser.newContext();
  const member = await context.newPage();
  try {
    await login(member, username, "safety-test-password");
    await save(page, { todos: [{ id: "same-id", title: "owner task" }] });
    await save(member, { todos: [{ id: "same-id", title: "member task" }] });
    expect((await write(page, `/api/todos/same-id?ownerId=${ownerId}`, { done: true }, "PATCH")).status).toBe(200);
    expect((await data(member)).todos.find(t => t.id === "same-id")?.done).toBe(false);
    expect((await write(page, `/api/todos/same-id?ownerId=${memberId}`, { done: true }, "PATCH")).status).toBe(404);
    expect((await write(page, `/api/todos/same-id?ownerId=${ownerId}`, undefined, "DELETE")).status).toBe(200);
    expect((await data(member)).todos.some(t => t.id === "same-id")).toBe(true);

    await save(page, { categories: [{ id: "shared", name: "共享分类", isTeamShared: true }], links: [{ id: "link", title: "共享链接", url: "https://example.com", category: "shared" }] });
    expect((await write(member, "/api/categories/team", { categoryId: "shared", ownerId })).status).toBe(200);
    const subscribed = await data(member);
    expect(subscribed.links.some(l => l.isSubscribed && l.ownerId === ownerId)).toBe(true);
    await save(member, { categories: subscribed.categories, links: subscribed.links });
    expect((await data(member)).links.filter(l => l.ownerId === ownerId)).toHaveLength(1);
    await save(page, { categories: [{ id: "shared", name: "私有分类", isTeamShared: false }] });
    expect((await data(member)).links.some(l => l.ownerId === ownerId)).toBe(false);

    expect((await write(page, "/api/projects", { name: "委托项目", todos: [{ title: "委托里程碑", assigneeId: memberId }] })).status).toBe(200);
    const delegated = (await data(member)).todos.find(t => t.title === "委托里程碑");
    expect(delegated?.isDelegated).toBe(true);
    expect((await write(member, `/api/todos/${delegated!.id}?ownerId=${ownerId}`, { done: true }, "PATCH")).status).toBe(200);
    expect((await data(page)).todos.find(t => t.id === delegated!.id)?.done).toBe(true);

    const stale = await data(member);
    expect((await write(member, "/api/links", { title: "并发新增", url: "https://example.com/new" })).status).toBe(201);
    const rejected = await write(member, "/api/user/data", { links: stale.links, expectedRevision: stale.revision });
    expect(rejected.status).toBe(409);
    expect((await data(member)).links.some(l => l.title === "并发新增")).toBe(true);
    await save(member, { categories: [], links: [] });
    await member.reload();
    expect((await data(member)).categories).toEqual([]);
    expect((await data(member)).links).toEqual([]);
  } finally { await context.close(); }
});

test("导航保存：本页面请求串行，冲突显示提示并保留外部新增", async ({ page, browser }) => {
  await login(page, "admin", "e2e-test-password");
  const username = `queue_${Date.now().toString().slice(-9)}`;
  expect((await write(page, "/api/admin/users", { username, password: "queue-test-password" })).status).toBe(201);
  const context = await browser.newContext();
  const member = await context.newPage();
  try {
    await login(member, username, "queue-test-password");
    await member.goto("/admin?tab=links");
    let posts = 0;
    let release: () => void = () => {};
    let seen: () => void = () => {};
    const firstSeen = new Promise<void>(resolve => { seen = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    await member.route("**/api/user/data", async route => {
      if (route.request().method() !== "POST") { await route.continue(); return; }
      posts++;
      if (posts === 1) { seen(); await gate; }
      await route.continue();
    });
    const add = async (title: string) => {
      await member.getByRole("button", { name: "添加新链接" }).click();
      await member.locator("#link-title").fill(title);
      await member.locator("#link-url").fill(`https://example.com/${encodeURIComponent(title)}`);
      const value = await member.locator("#link-category option").nth(1).getAttribute("value");
      await member.locator("#link-category").selectOption(value!);
      await member.getByRole("button", { name: "Add Link", exact: true }).click();
    };
    await add("queue-first");
    await firstSeen;
    await add("queue-second");
    expect(posts).toBe(1);
    release();
    await expect.poll(async () => (await data(member)).links.filter(l => l.title.startsWith("queue-")).length).toBe(2);
    expect(posts).toBe(2);
    await member.unroute("**/api/user/data");
    await member.reload();
    await member.route("**/api/user/data", async route => {
      if (route.request().method() !== "POST") { await route.continue(); return; }
      expect((await write(member, "/api/links", { title: "external-added", url: "https://example.com/external" })).status).toBe(201);
      await route.continue();
    });
    await add("conflicted-change");
    await expect(member.getByRole("alert").filter({ hasText: "本次修改未保存" })).toContainText("本次修改未保存");
    const stored = await data(member);
    expect(stored.links.some(l => l.title === "external-added")).toBe(true);
    expect(stored.links.some(l => l.title === "conflicted-change")).toBe(false);
  } finally { await context.close(); }
});
