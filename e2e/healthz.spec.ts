import { test, expect } from "@playwright/test";

/**
 * 公开探针仅返回轻量可用性；迁移、守护进程与磁盘诊断必须由管理员访问。
 */
test("healthz 公开返回轻量 DB 状态，深度诊断拒绝匿名", async ({ request }) => {
  const res = await request.get("/api/healthz");
  expect(res.status()).toBe(200);

  const body = await res.json();

  expect(body.status).toBe("ok");
  expect(body.db).toBe("ok");
  expect(body.migrations).toBeUndefined();
  expect(body.disk).toBeUndefined();
  expect(res.headers()["cache-control"]).toBe("no-store");
  expect((await request.get("/api/admin/health")).status()).toBe(403);
});

test("管理员深度诊断提供迁移与磁盘信息，并限制扫描频率", async ({ page }) => {
  await page.goto("/login");
  await page.fill("#login-username", "admin");
  await page.fill("#login-password", "e2e-test-password");
  await page.getByRole("button", { name: "立即登录" }).click();
  await page.waitForURL("/");
  const res = await page.request.get("/api/admin/health");
  expect(res.status()).toBe(200);
  const body = await res.json();

  // 迁移版本：当前 user_version 必须 >= 1（全新库也会跑完 v13），且存在 next 字段
  expect(typeof body.migrations.current).toBe("number");
  expect(body.migrations.current).toBeGreaterThanOrEqual(1);
  expect("next" in body.migrations).toBe(true);

  // 守护进程状态为布尔
  expect(typeof body.daemon.running).toBe("boolean");

  // WAL / DB 大小均为非负整数（全新库可能为 0）
  expect(typeof body.disk.dbSizeBytes).toBe("number");
  expect(typeof body.disk.walSizeBytes).toBe("number");
  expect(typeof body.disk.shmSizeBytes).toBe("number");
  expect(body.disk.dbSizeBytes).toBeGreaterThanOrEqual(0);
  expect(body.disk.walSizeBytes).toBeGreaterThanOrEqual(0);
  const repeated = await page.request.get("/api/admin/health");
  expect(repeated.status()).toBe(429);
  expect(Number(repeated.headers()["retry-after"])).toBeGreaterThan(0);
});
