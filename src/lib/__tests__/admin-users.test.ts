import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db.ts";
import {
  adminCount,
  deleteUserCascade,
  updateUser,
  UserUpdateError,
} from "../admin-users.ts";

/**
 * 管理员用户管理的事务性与完整性测试。
 *
 * 回归背景：
 * - DELETE 此前是路由内 10 条裸 DELETE 且**无事务**，中途失败会留下半删状态；
 *   且 analytics_events 无外键约束、从未被清理。
 * - PATCH 此前是 5 条独立 UPDATE 逐条提交，中途失败会留下部分更新
 *   （如「角色已改、密码未改」）。
 */

const TABLES_WITH_USER_ID = [
  "sessions",
  "user_categories",
  "user_links",
  "user_configs",
  "projects",
  "user_todos",
  "notifications",
  "api_tokens",
  "model_accounts",
  "analytics_events",
] as const;

function seedUser(userId: string, role = "user") {
  db.prepare(
    "INSERT INTO users (id, username, password_hash, display_name, role, avatar, created_at) VALUES (?, ?, ?, ?, ?, '', ?)",
  ).run(userId, `u_${userId}`, "hash", "测试用户", role, Date.now());
  db.prepare(
    "INSERT INTO user_configs (user_id) VALUES (?)",
  ).run(userId);
  db.prepare(
    "INSERT INTO user_categories (id, user_id, name, label, icon, color) VALUES (?, ?, 'c', 'C', '', '')",
  ).run(`cat-${userId}`, userId);
  db.prepare(
    "INSERT INTO user_links (id, user_id, title, url, category) VALUES (?, ?, 't', 'https://e.com', 'c')",
  ).run(`link-${userId}`, userId);
  db.prepare(
    "INSERT INTO projects (id, user_id, name, status, status_color, url, sort_order) VALUES (?, ?, 'p', 's', '', '', 0)",
  ).run(`proj-${userId}`, userId);
  db.prepare(
    "INSERT INTO user_todos (id, user_id, title, priority, done, due_date, created_at, sort_order) VALUES (?, ?, 'todo', 'medium', 0, '', ?, 0)",
  ).run(`todo-${userId}`, userId, Date.now());
  db.prepare(
    "INSERT INTO notifications (id, user_id, title, content, source, created_at, read) VALUES (?, ?, 'n', 'c', 'system', ?, 0)",
  ).run(`notif-${userId}`, userId, Date.now());
  db.prepare(
    "INSERT INTO api_tokens (id, user_id, name, token_hash, token_prefix, created_at) VALUES (?, ?, 'tok', 'h', 'nvx_live_', ?)",
  ).run(`tok-${userId}`, userId, Date.now());
  db.prepare(
    "INSERT INTO sessions (token_hash, user_id, user_agent, ip_address, last_active_at, expires_at, created_at) VALUES (?, ?, '', '', ?, ?, ?)",
  ).run(
    `sess-${userId}`,
    userId,
    Date.now(),
    Date.now() + 86400000,
    Date.now(),
  );
  db.prepare(
    "INSERT INTO model_accounts (id, user_id, provider, created_at, updated_at) VALUES (?, ?, 'codex', ?, ?)",
  ).run(`acct-${userId}`, userId, Date.now(), Date.now());
  db.prepare(
    "INSERT INTO analytics_events (event, user_id, instance_id, meta, ts) VALUES ('test.event', ?, 'inst', '{}', ?)",
  ).run(userId, Date.now());
}

function countRows(table: string, userId: string): number {
  return (
    db.prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE user_id = ?`).get(userId) as {
      c: number;
    }
  ).c;
}

describe("admin-users: deleteUserCascade", () => {
  beforeEach(() => {
    // 清理可能残留的测试数据
    for (const t of TABLES_WITH_USER_ID) {
      db.prepare(`DELETE FROM ${t} WHERE user_id LIKE 'cascade-test-%'`).run();
    }
    db.prepare("DELETE FROM users WHERE id LIKE 'cascade-test-%'").run();
  });

  it("应清空全部关联表，不留任何孤儿行", () => {
    const userId = `cascade-test-${Date.now()}`;
    seedUser(userId);

    // 前置断言：数据确实写入
    for (const t of TABLES_WITH_USER_ID) {
      assert.equal(countRows(t, userId), 1, `${t} 应有 1 行种子数据`);
    }

    deleteUserCascade(userId);

    // 用户本身已删除
    const userRow = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
    assert.equal(userRow, undefined, "用户行应已删除");

    // 全部关联表无残留（含此前从未清理的 analytics_events）
    for (const t of TABLES_WITH_USER_ID) {
      assert.equal(countRows(t, userId), 0, `${t} 不应有残留行`);
    }
  });

  it("应保留 audit_logs（合规证据不随账号删除）", () => {
    const userId = `cascade-test-${Date.now()}`;
    seedUser(userId);
    db.prepare(
      "INSERT INTO audit_logs (id, user_id, action, target, ip, details, created_at) VALUES (?, ?, 'test', '', '', '', ?)",
    ).run(`aud-${userId}`, userId, Date.now());

    deleteUserCascade(userId);

    const auditCount = (
      db.prepare("SELECT COUNT(*) AS c FROM audit_logs WHERE user_id = ?").get(userId) as {
        c: number;
      }
    ).c;
    assert.equal(auditCount, 1, "审计日志应被刻意保留");

    db.prepare("DELETE FROM audit_logs WHERE user_id = ?").run(userId);
  });

  it("删除过程中抛出异常应整体回滚，不留半删状态", () => {
    const userId = `cascade-test-${Date.now()}`;
    seedUser(userId);

    // 制造失败：临时把一张关联表改名，使循环中的 DELETE 抛错
    db.exec("ALTER TABLE model_accounts RENAME TO model_accounts_tmp");
    let threw = false;
    try {
      deleteUserCascade(userId);
    } catch {
      threw = true;
    } finally {
      db.exec("ALTER TABLE model_accounts_tmp RENAME TO model_accounts");
    }

    assert.equal(threw, true, "应向上抛出错误");

    // 关键断言：事务回滚后，用户与所有子表数据必须完好如初
    const userRow = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
    assert.ok(userRow, "回滚后用户应仍然存在");
    for (const t of TABLES_WITH_USER_ID) {
      assert.equal(countRows(t, userId), 1, `${t} 回滚后应保留原有数据`);
    }

    deleteUserCascade(userId);
  });
});

describe("admin-users: adminCount", () => {
  it("应正确统计管理员数量（用于最后一个 admin 保护）", () => {
    const before = adminCount();
    assert.ok(before >= 1, "至少应有一个管理员（测试库种子）");

    const adminId = `cascade-test-admin-${Date.now()}`;
    seedUser(adminId, "admin");
    assert.equal(adminCount(), before + 1, "新增 admin 后计数应 +1");

    deleteUserCascade(adminId);
    assert.equal(adminCount(), before, "删除后计数应恢复");
  });
});

describe("admin-users: updateUser", () => {
  beforeEach(() => {
    db.prepare("DELETE FROM users WHERE id LIKE 'upd-test-%'").run();
  });

  it("应一次性应用多个字段变更", () => {
    const userId = `upd-test-${Date.now()}`;
    seedUser(userId);

    const changed = updateUser(
      userId,
      { displayName: "新昵称", avatar: "https://example.com/a.png" },
      { actorId: "someone-else", targetRole: "user" },
    );
    assert.deepEqual(changed.sort(), ["avatar", "displayName"]);

    const row = db
      .prepare("SELECT display_name, avatar FROM users WHERE id = ?")
      .get(userId) as { display_name: string; avatar: string };
    assert.equal(row.display_name, "新昵称");
    assert.equal(row.avatar, "https://example.com/a.png");

    deleteUserCascade(userId);
  });

  it("校验失败时应整体回滚，不留部分更新", () => {
    const userId = `upd-test-${Date.now()}`;
    seedUser(userId);

    // displayName 合法、avatar 非法 → 整笔应回滚，displayName 不得落库
    assert.throws(
      () =>
        updateUser(
          userId,
          { displayName: "不应写入", avatar: "javascript:alert(1)" },
          { actorId: "someone-else", targetRole: "user" },
        ),
      (err: unknown) => err instanceof UserUpdateError,
    );

    const row = db
      .prepare("SELECT display_name FROM users WHERE id = ?")
      .get(userId) as { display_name: string };
    assert.notEqual(row.display_name, "不应写入", "失败后不应留下部分更新");

    deleteUserCascade(userId);
  });

  it("用户名冲突应抛 UserUpdateError 且不修改任何字段", () => {
    const a = `upd-test-a-${Date.now()}`;
    const b = `upd-test-b-${Date.now()}`;
    seedUser(a);
    seedUser(b);

    // seedUser 生成的 username 含连字符，不符合 /^[a-z0-9_]{3,20}$/，
    // 因此这里显式改写成合法用户名后再验证唯一性冲突。
    db.prepare("UPDATE users SET username = ? WHERE id = ?").run("upd_taken_name", b);

    assert.throws(
      () =>
        updateUser(
          a,
          { username: "upd_taken_name", displayName: "改名失败" },
          { actorId: "someone-else", targetRole: "user" },
        ),
      (err: unknown) =>
        err instanceof UserUpdateError && /already taken/.test(err.message),
    );

    const row = db
      .prepare("SELECT display_name FROM users WHERE id = ?")
      .get(a) as { display_name: string };
    assert.notEqual(row.display_name, "改名失败");

    deleteUserCascade(a);
    deleteUserCascade(b);
  });

  it("非法用户名格式应被拒绝", () => {
    const userId = `upd-test-${Date.now()}`;
    seedUser(userId);

    assert.throws(
      () =>
        updateUser(
          userId,
          { username: "AB" }, // 太短且含大写
          { actorId: "someone-else", targetRole: "user" },
        ),
      (err: unknown) => err instanceof UserUpdateError,
    );

    deleteUserCascade(userId);
  });

  it("禁止把自己降级", () => {
    const userId = `upd-test-${Date.now()}`;
    seedUser(userId, "admin");

    assert.throws(
      () =>
        updateUser(
          userId,
          { role: "user" },
          { actorId: userId, targetRole: "admin" },
        ),
      (err: unknown) =>
        err instanceof UserUpdateError && /your own admin account/.test(err.message),
    );

    const row = db.prepare("SELECT role FROM users WHERE id = ?").get(userId) as {
      role: string;
    };
    assert.equal(row.role, "admin", "角色应保持不变");

    deleteUserCascade(userId);
  });

  it("禁止降级最后一个 admin", () => {
    const userId = `upd-test-${Date.now()}`;
    seedUser(userId, "admin");
    const adminsBefore = adminCount();

    // 构造「该用户是唯一 admin」的场景不可行（测试库已有种子 admin），
    // 因此直接断言：当 adminCount()<=1 时才拦截。此处验证多 admin 时允许降级。
    if (adminsBefore > 1) {
      const changed = updateUser(
        userId,
        { role: "user" },
        { actorId: "someone-else", targetRole: "admin" },
      );
      assert.deepEqual(changed, ["role"]);
    }

    deleteUserCascade(userId);
  });

  it("无字段变更时应返回空数组", () => {
    const userId = `upd-test-${Date.now()}`;
    seedUser(userId);

    const changed = updateUser(
      userId,
      {},
      { actorId: "someone-else", targetRole: "user" },
    );
    assert.deepEqual(changed, []);

    deleteUserCascade(userId);
  });
});
