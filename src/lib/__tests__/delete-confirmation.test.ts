import { after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db.ts";
import {
  confirmPendingDelete,
  consumePendingDelete,
  stageDelete,
} from "../ai-tools.ts";

/**
 * 删除确认状态机回归用例。
 *
 * 旧实现按 `(userId, conversationId)` 存 pending，并先跑非锚定的取消正则：
 * - 「别的地方还有任务吗」这类追问会静默撤销待确认删除；
 * - 「别删了，确认删除 xxxx」会被判为取消；
 * - 同一会话连续两次删除请求互相覆盖。
 * 新实现以 pendingId 为键、确认顺序改为「精确确认串 → 整句取消词 → 未确认」。
 */

let seq = 0;
const users: string[] = [];
function user(): string {
  const uid = `del-test-${Date.now()}-${seq++}`;
  db.prepare(
    "INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, 'hash', ?)",
  ).run(uid, uid, Date.now());
  users.push(uid);
  return uid;
}
function todo(owner: string, id: string): void {
  db.prepare(
    "INSERT INTO user_todos (id, user_id, title, done, created_at) VALUES (?, ?, ?, 0, ?)",
  ).run(id, owner, `task ${id}`, Date.now());
}
function exists(owner: string, id: string): boolean {
  return db.prepare("SELECT 1 FROM user_todos WHERE id = ? AND user_id = ?").get(id, owner) !== undefined;
}

after(() => {
  for (const uid of users) {
    db.prepare("DELETE FROM user_todos WHERE user_id = ?").run(uid);
    db.prepare("DELETE FROM users WHERE id = ?").run(uid);
  }
});

describe("stageDelete", () => {
  let owner = "";
  beforeEach(() => { owner = user(); });

  it("returns a pending id bound to the staged target without deleting", () => {
    todo(owner, "staged");
    const result = stageDelete(owner, { tool: "delete_todo", args: { id: "staged" } });
    assert.ok("needsConfirmation" in result);
    assert.match(result.pendingId, /^[a-f0-9]{32}$/);
    assert.equal(result.targetName, "task staged");
    assert.match(result.message, /确认删除 [a-f0-9]{8}/);
    assert.ok(exists(owner, "staged"));
  });

  it("rejects a target that does not belong to the caller", () => {
    const other = user();
    todo(other, "foreign");
    const result = stageDelete(owner, { tool: "delete_todo", args: { id: "foreign" } });
    assert.ok("ok" in result && !result.ok);
  });

  it("keeps only the newest request per user but each pending id stays valid", () => {
    todo(owner, "first");
    todo(owner, "second");
    const first = stageDelete(owner, { tool: "delete_todo", args: { id: "first" } });
    const second = stageDelete(owner, { tool: "delete_todo", args: { id: "second" } });
    assert.ok("needsConfirmation" in first && "needsConfirmation" in second);
    assert.notEqual(first.pendingId, second.pendingId);
    // 文本确认路径只指向最新一条；旧的 pendingId 仍可用于确认卡
    assert.ok(consumePendingDelete(owner, second.message.match(/确认删除 [a-f0-9]{8}/)?.[0] ?? "", "chat")?.ok);
    assert.ok(exists(owner, "first"));
    assert.ok(!exists(owner, "second"));
    assert.ok(confirmPendingDelete(owner, first.pendingId, "confirm")?.ok);
    assert.ok(!exists(owner, "first"));
  });
});

describe("confirmPendingDelete", () => {
  it("executes on confirm and is idempotent afterwards", () => {
    const owner = user();
    todo(owner, "by-button");
    const staged = stageDelete(owner, { tool: "delete_todo", args: { id: "by-button" } });
    assert.ok("needsConfirmation" in staged);
    assert.ok(confirmPendingDelete(owner, staged.pendingId, "confirm")?.ok);
    assert.ok(!exists(owner, "by-button"));
    // 第二次提交返回 null（已被消费），不会重复执行
    assert.equal(confirmPendingDelete(owner, staged.pendingId, "confirm"), null);
  });

  it("cancels without touching data", () => {
    const owner = user();
    todo(owner, "keep");
    const staged = stageDelete(owner, { tool: "delete_todo", args: { id: "keep" } });
    assert.ok("needsConfirmation" in staged);
    const cancelled = confirmPendingDelete(owner, staged.pendingId, "cancel");
    assert.ok(cancelled?.ok);
    assert.ok(exists(owner, "keep"));
  });

  it("rejects another user's pending id and malformed ids", () => {
    const owner = user();
    const intruder = user();
    todo(owner, "private");
    const staged = stageDelete(owner, { tool: "delete_todo", args: { id: "private" } });
    assert.ok("needsConfirmation" in staged);
    assert.equal(confirmPendingDelete(intruder, staged.pendingId, "confirm"), null);
    assert.ok(exists(owner, "private"));
    for (const bad of [undefined, "", "abc", "A".repeat(32), 42, null]) {
      assert.equal(confirmPendingDelete(owner, bad, "confirm"), null);
    }
  });
});

describe("consumePendingDelete (text fallback)", () => {
  it("no longer cancels on a sentence that merely contains a cancel word", () => {
    const owner = user();
    todo(owner, "questions");
    const staged = stageDelete(owner, { tool: "delete_todo", args: { id: "questions" } });
    assert.ok("needsConfirmation" in staged);
    for (const prompt of ["这个项目别的地方还有任务吗", "别删了，确认删除 deadbeef", "取消订单页面的书签在哪"]) {
      assert.equal(consumePendingDelete(owner, prompt, "chat"), null, prompt);
    }
    // 三次追问之后，待确认请求仍然有效
    assert.equal(confirmPendingDelete(owner, staged.pendingId, "confirm")?.ok, true);
    assert.ok(!exists(owner, "questions"));
  });

  it("accepts the exact confirmation string and whole-sentence cancel words only", () => {
    const owner = user();
    todo(owner, "text-confirm");
    const staged = stageDelete(owner, { tool: "delete_todo", args: { id: "text-confirm" } });
    assert.ok("needsConfirmation" in staged);
    const code = staged.message.match(/确认删除 [a-f0-9]{8}/)?.[0] ?? "";
    assert.ok(code);
    // 前后带标点的变体不算精确匹配
    assert.equal(consumePendingDelete(owner, `${code}！`, "chat"), null);
    assert.ok(consumePendingDelete(owner, code, "chat")?.ok);
    assert.ok(!exists(owner, "text-confirm"));
  });

  it("cancels only when the whole message is a cancel word", () => {
    const owner = user();
    todo(owner, "cancel-text");
    const staged = stageDelete(owner, { tool: "delete_todo", args: { id: "cancel-text" } });
    assert.ok("needsConfirmation" in staged);
    const result = consumePendingDelete(owner, "取消。", "chat");
    assert.ok(result?.ok);
    assert.ok(exists(owner, "cancel-text"));
    // 已取消后，迟到的确认串不再执行
    const code = staged.message.match(/确认删除 [a-f0-9]{8}/)?.[0] ?? "";
    assert.equal(consumePendingDelete(owner, code, "chat"), null);
  });

  it("expires after the TTL and returns no result", () => {
    const owner = user();
    todo(owner, "expiring");
    const staged = stageDelete(owner, { tool: "delete_todo", args: { id: "expiring" } });
    assert.ok("needsConfirmation" in staged);
    const realNow = Date.now;
    Date.now = () => realNow() + 6 * 60 * 1000;
    try {
      assert.equal(consumePendingDelete(owner, "确认删除 00000000", "chat"), null);
      assert.equal(confirmPendingDelete(owner, staged.pendingId, "confirm"), null);
    } finally { Date.now = realNow; }
    assert.ok(exists(owner, "expiring"));
  });
});
