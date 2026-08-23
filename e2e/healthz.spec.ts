import { test, expect } from "@playwright/test";

/**
 * 可观测性端点验证：/api/healthz 需返回 DB 连通性、迁移版本、守护进程状态与 WAL 大小。
 * 该端点无需鉴权（Docker healthcheck 也在用），任何请求都应得到结构化 JSON。
 */
test("healthz 返回 DB / 迁移 / daemon / WAL 诊断信息", async ({ request }) => {
  const res = await request.get("/api/healthz");
  expect(res.status()).toBe(200);

  const body = await res.json();

  expect(body.status).toBe("ok");
  expect(body.db).toBe("ok");

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
});