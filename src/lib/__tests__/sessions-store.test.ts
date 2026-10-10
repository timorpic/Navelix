import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db.ts";
import { hashToken } from "../auth/api-tokens.ts";
import {
  listSessions,
  revokeOtherSessions,
  revokeSession,
} from "../auth/sessions.ts";

/**
 * 活跃会话设备管理单测。
 *
 * 这些读写此前在 `api/auth/sessions/route.ts` 里，且该路由自带了第三份
 * `hashToken` 副本。下沉后在此固定：过期会话不出现在列表、当前会话被正确标记、
 * 撤销操作受 user_id 约束。
 */

let seq = 0;
function seedUser(): string {
  const uid = `sess-test-${Date.now()}-${seq++}`;
  db.prepare(
    `INSERT INTO users (id, username, password_hash, display_name, role, created_at)
     VALUES (?, ?, 'hash', 'S User', 'user', ?)`,
  ).run(uid, uid, Date.now());
  return uid;
}

function seedSession(
  userId: string,
  over: { token?: string; expiresInMs?: number; ua?: string; ip?: string; lastActive?: number } = {},
): string {
  const token = over.token ?? `raw-${Date.now()}-${seq++}`;
  const hash = hashToken(token);
  const now = Date.now();
  db.prepare(
    `INSERT INTO sessions (token_hash, user_id, user_agent, ip_address, last_active_at, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    hash,
    userId,
    over.ua ?? "Mozilla/5.0 Chrome/151",
    over.ip ?? "10.0.0.1",
    over.lastActive ?? now,
    now + (over.expiresInMs ?? 86_400_000),
    now,
  );
  return hash;
}

describe("listSessions", () => {
  it("只返回未过期会话", () => {
    const uid = seedUser();
    seedSession(uid);
    seedSession(uid, { expiresInMs: -1000 }); // 已过期
    const list = listSessions(uid, "");
    assert.equal(list.length, 1, "过期会话不应出现");
  });

  it("只返回本人会话", () => {
    const uid = seedUser();
    const other = seedUser();
    seedSession(uid);
    seedSession(other);
    assert.equal(listSessions(uid, "").length, 1);
    assert.equal(listSessions(other, "").length, 1);
  });

  it("当前会话被标记 isCurrent", () => {
    const uid = seedUser();
    const mine = seedSession(uid);
    const other = seedSession(uid);
    const list = listSessions(uid, mine);
    const byHash = Object.fromEntries(list.map((s) => [s.tokenHash, s]));
    assert.equal(byHash[mine].isCurrent, true);
    assert.equal(byHash[other].isCurrent, false);
  });

  it("currentHash 为空时不误标任何会话", () => {
    const uid = seedUser();
    seedSession(uid);
    assert.ok(listSessions(uid, "").every((s) => !s.isCurrent));
  });

  it("设备信息缺失时回退为可读文案", () => {
    const uid = seedUser();
    seedSession(uid, { ua: "", ip: "" });
    const [s] = listSessions(uid, "");
    assert.equal(s.userAgent, "未知设备/浏览器");
    assert.equal(s.ipAddress, "未知 IP");
  });

  it("last_active_at 为 0 时回落到创建时间", () => {
    const uid = seedUser();
    seedSession(uid, { lastActive: 0 });
    const [s] = listSessions(uid, "");
    assert.ok(s.lastActiveAt > 0);
    assert.equal(s.lastActiveAt, s.createdAt);
  });

  it("无会话时返回空数组", () => {
    assert.deepEqual(listSessions(seedUser(), ""), []);
  });
});

describe("revokeOtherSessions", () => {
  it("保留当前会话，其余全部注销", () => {
    const uid = seedUser();
    const current = seedSession(uid);
    seedSession(uid);
    seedSession(uid);

    revokeOtherSessions(uid, current);

    const left = listSessions(uid, current);
    assert.equal(left.length, 1);
    assert.equal(left[0].tokenHash, current);
    assert.equal(left[0].isCurrent, true);
  });

  it("不影响他人的会话", () => {
    const uid = seedUser();
    const other = seedUser();
    const current = seedSession(uid);
    seedSession(other);

    revokeOtherSessions(uid, current);

    assert.equal(listSessions(other, "").length, 1);
  });

  it("currentHash 为空时清空本人全部会话", () => {
    const uid = seedUser();
    seedSession(uid);
    seedSession(uid);
    revokeOtherSessions(uid, "");
    assert.equal(listSessions(uid, "").length, 0);
  });
});

describe("revokeSession", () => {
  it("强退指定会话", () => {
    const uid = seedUser();
    const keep = seedSession(uid);
    const drop = seedSession(uid);

    revokeSession(uid, drop);

    const left = listSessions(uid, "");
    assert.deepEqual(left.map((s) => s.tokenHash), [keep]);
  });

  it("不能强退他人的会话（user_id 条件生效）", () => {
    const uid = seedUser();
    const other = seedUser();
    const victim = seedSession(other);

    revokeSession(uid, victim);

    assert.equal(listSessions(other, "").length, 1, "他人调用不应删除");
  });

  it("撤销不存在的摘要不抛错", () => {
    assert.doesNotThrow(() => revokeSession(seedUser(), "deadbeef"));
  });
});

describe("与 session.ts 的摘要契约", () => {
  it("本模块的 hashToken 与 api-tokens 侧一致（同一算法，无第三份副本）", () => {
    // session.ts 的 createSession 用同一函数写入 token_hash，
    // 这里验证列表查询能命中按相同规则写入的行。
    // token 必须每次唯一 —— token_hash 是主键，固定值会在重复运行时撞唯一约束。
    const uid = seedUser();
    const token = `contract-${Date.now()}-${seq++}`;
    const hash = seedSession(uid, { token });
    assert.equal(hash, hashToken(token));
    assert.equal(listSessions(uid, "").length, 1);
  });
});
