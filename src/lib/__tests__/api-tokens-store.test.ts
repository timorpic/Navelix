import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db.ts";
import {
  API_TOKEN_PREFIX,
  hashToken,
  issueApiToken,
  listApiTokens,
  revokeApiToken,
} from "../auth/api-tokens.ts";

/**
 * 个人 API Token 管理单测。
 *
 * 此前这些读写散在 `api/auth/api-tokens/route.ts` 里，而 Token **校验**在
 * `auth/session.ts`，同一张表两处维护。下沉后在此固定几条不变量：
 * 明文只返回一次、库内只存摘要、跨用户不可见/不可撤销。
 */

let seq = 0;
function seedUser(): string {
  const uid = `tok-test-${Date.now()}-${seq++}`;
  db.prepare(
    `INSERT INTO users (id, username, password_hash, display_name, role, created_at)
     VALUES (?, ?, 'hash', 'TOK User', 'user', ?)`,
  ).run(uid, uid, Date.now());
  return uid;
}

describe("hashToken", () => {
  it("为 SHA-256 十六进制摘要（64 字符）", () => {
    const h = hashToken("nvx_live_abc");
    assert.equal(h.length, 64);
    assert.match(h, /^[0-9a-f]{64}$/);
  });

  it("同一输入稳定、不同输入不同", () => {
    assert.equal(hashToken("a"), hashToken("a"));
    assert.notEqual(hashToken("a"), hashToken("b"));
  });
});

describe("issueApiToken", () => {
  it("明文带 nvx_live_ 前缀且长度为 57（9 + 48 位 hex）", () => {
    const uid = seedUser();
    const t = issueApiToken(uid, "我的密钥");
    assert.ok(t.token.startsWith(API_TOKEN_PREFIX));
    assert.equal(t.token.length, API_TOKEN_PREFIX.length + 48);
    assert.match(t.token.slice(API_TOKEN_PREFIX.length), /^[0-9a-f]{48}$/);
  });

  it("库内只存摘要，不存明文", () => {
    const uid = seedUser();
    const t = issueApiToken(uid, "我的密钥");
    const row = db
      .prepare("SELECT token_hash FROM api_tokens WHERE id = ?")
      .get(t.tokenId) as { token_hash: string };
    assert.equal(row.token_hash, hashToken(t.token));
    assert.notEqual(row.token_hash, t.token);
    // 明文不得出现在库内任何列
    const all = db.prepare("SELECT * FROM api_tokens WHERE id = ?").get(t.tokenId) as Record<
      string,
      unknown
    >;
    for (const [col, val] of Object.entries(all)) {
      assert.notEqual(String(val), t.token, `列 ${col} 泄露了明文 Token`);
    }
  });

  it("展示前缀取首尾各 4 位，便于辨认", () => {
    const uid = seedUser();
    const t = issueApiToken(uid, "x");
    const secret = t.token.slice(API_TOKEN_PREFIX.length);
    assert.equal(t.tokenPrefix, `${API_TOKEN_PREFIX}${secret.slice(0, 4)}...${secret.slice(-4)}`);
  });

  it("每次签发的明文与 id 都不同", () => {
    const uid = seedUser();
    const a = issueApiToken(uid, "a");
    const b = issueApiToken(uid, "b");
    assert.notEqual(a.token, b.token);
    assert.notEqual(a.tokenId, b.tokenId);
  });

  it("名称缺失时回退默认名，并做 trim", () => {
    const uid = seedUser();
    assert.equal(issueApiToken(uid, "").name, "默认 API 密钥");
    assert.equal(issueApiToken(uid, undefined).name, "默认 API 密钥");
    assert.equal(issueApiToken(uid, "  带空格  ").name, "带空格");
  });
});

describe("listApiTokens", () => {
  it("新建在前，且只返回本人 Token", () => {
    const uid = seedUser();
    const other = seedUser();
    const first = issueApiToken(uid, "早");
    const second = issueApiToken(uid, "晚");
    issueApiToken(other, "他人");

    const mine = listApiTokens(uid);
    assert.equal(mine.length, 2);
    // created_at 同毫秒时顺序可能不稳，用集合断言 id 归属
    assert.deepEqual(
      new Set(mine.map((t) => t.id)),
      new Set([first.tokenId, second.tokenId]),
    );
    assert.equal(listApiTokens(other).length, 1);
  });

  it("返回驼峰字段且不泄露摘要", () => {
    const uid = seedUser();
    issueApiToken(uid, "字段检查");
    const [item] = listApiTokens(uid);
    assert.deepEqual(Object.keys(item).sort(), [
      "createdAt",
      "id",
      "lastUsedAt",
      "name",
      "tokenPrefix",
    ]);
  });

  it("新签发的 Token 未使用过，lastUsedAt 为 null", () => {
    const uid = seedUser();
    issueApiToken(uid, "x");
    assert.equal(listApiTokens(uid)[0].lastUsedAt, null);
  });

  it("无 Token 时返回空数组", () => {
    assert.deepEqual(listApiTokens(seedUser()), []);
  });
});

describe("revokeApiToken", () => {
  it("删除本人 Token", () => {
    const uid = seedUser();
    const t = issueApiToken(uid, "待撤销");
    revokeApiToken(uid, t.tokenId);
    assert.equal(listApiTokens(uid).length, 0);
  });

  it("不能撤销他人的 Token（user_id 条件生效）", () => {
    const uid = seedUser();
    const other = seedUser();
    const mine = issueApiToken(uid, "我的");
    revokeApiToken(other, mine.tokenId);
    assert.equal(listApiTokens(uid).length, 1, "他人调用不应删除");
  });

  it("撤销不存在的 id 不抛错", () => {
    const uid = seedUser();
    assert.doesNotThrow(() => revokeApiToken(uid, "tok_nonexistent"));
  });
});

describe("与 Bearer 校验的契约", () => {
  it("签发的明文经 hashToken 后能命中库内记录（session.ts 的校验路径）", () => {
    const uid = seedUser();
    const t = issueApiToken(uid, "端到端");
    // 复刻 session.ts 的查询：token_hash = hashToken(明文)
    const row = db
      .prepare("SELECT user_id FROM api_tokens WHERE token_hash = ?")
      .get(hashToken(t.token)) as { user_id: string } | undefined;
    assert.ok(row, "Bearer 校验应能查到该 Token");
    assert.equal(row!.user_id, uid);
  });
});
