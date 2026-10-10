import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db.ts";
import {
  countUnread,
  createNotification,
  deleteAllNotifications,
  deleteNotification,
  listNotifications,
  markAllRead,
  patchNotification,
  toPublicNotification,
} from "../notification-store.ts";

/**
 * 通知存储层单测。
 *
 * 这些查询此前散落在三个路由里，行映射（`read: 0/1` ↔ `boolean`、
 * `source` 兜底 `"system"`）在 GET 与 POST 各写一份。下沉后在此固定行为。
 */

let seq = 0;
function seedUser(): string {
  const uid = `nt-test-${Date.now()}-${seq++}`;
  db.prepare(
    `INSERT INTO users (id, username, password_hash, display_name, role, created_at)
     VALUES (?, ?, 'hash', 'NT User', 'user', ?)`,
  ).run(uid, uid, Date.now());
  return uid;
}

describe("toPublicNotification", () => {
  it("read 数值映射为布尔，source 缺省回退 system", () => {
    const base = { id: "n1", title: "T", content: "C", created_at: 1 };
    assert.deepEqual(toPublicNotification({ ...base, read: 1 }), {
      id: "n1",
      title: "T",
      content: "C",
      source: "system",
      createdAt: 1,
      read: true,
    });
    assert.equal(toPublicNotification({ ...base, read: 0 }).read, false);
    assert.equal(toPublicNotification({ ...base, read: 0, source: "" }).source, "system");
    assert.equal(toPublicNotification({ ...base, read: 0, source: "calendar" }).source, "calendar");
  });
});

describe("createNotification", () => {
  it("返回的公开对象与随后读回的一致", () => {
    const uid = seedUser();
    const created = createNotification(uid, { title: "标题", content: "正文", source: "api" });

    assert.ok(created.id);
    assert.equal(created.read, false);
    assert.equal(created.source, "api");

    const listed = listNotifications(uid);
    assert.equal(listed.length, 1);
    assert.deepEqual(listed[0], created);
  });

  it("source 依次回退 tag / category / system", () => {
    const uid = seedUser();
    assert.equal(createNotification(uid, { title: "a", tag: "from-tag" }).source, "from-tag");
    assert.equal(createNotification(uid, { title: "b", category: "from-cat" }).source, "from-cat");
    assert.equal(createNotification(uid, { title: "c" }).source, "system");
  });

  it("字段做 trim", () => {
    const uid = seedUser();
    const n = createNotification(uid, { title: "  标题  ", content: "  正文  ", source: " api " });
    assert.equal(n.title, "标题");
    assert.equal(n.content, "正文");
    assert.equal(n.source, "api");
  });
});

describe("listNotifications / countUnread", () => {
  it("最新在前，且只返回本人数据", () => {
    const uid = seedUser();
    const other = seedUser();
    const first = createNotification(uid, { title: "早" });
    const second = createNotification(uid, { title: "晚" });
    createNotification(other, { title: "他人" });

    const listed = listNotifications(uid);
    assert.deepEqual(listed.map((n) => n.id), [second.id, first.id]);
    assert.equal(listNotifications(other).length, 1);
  });

  it("countUnread 只计未读", () => {
    const uid = seedUser();
    createNotification(uid, { title: "a" });
    const b = createNotification(uid, { title: "b" });
    assert.equal(countUnread(uid), 2);
    patchNotification(b.id, uid, { read: true });
    assert.equal(countUnread(uid), 1);
  });
});

describe("patchNotification", () => {
  it("无字段时返回 false 且不写库", () => {
    const uid = seedUser();
    const n = createNotification(uid, { title: "原标题" });
    assert.equal(patchNotification(n.id, uid, {}), false);
    assert.equal(listNotifications(uid)[0].title, "原标题");
  });

  it("局部更新只动传入的字段", () => {
    const uid = seedUser();
    const n = createNotification(uid, { title: "原标题", content: "原正文", source: "api" });
    assert.equal(patchNotification(n.id, uid, { title: "新标题" }), true);
    const after = listNotifications(uid)[0];
    assert.equal(after.title, "新标题");
    assert.equal(after.content, "原正文");
    assert.equal(after.source, "api");
  });

  it("read 传 false 也会写入（不是「缺省即忽略」）", () => {
    const uid = seedUser();
    const n = createNotification(uid, { title: "x" });
    patchNotification(n.id, uid, { read: true });
    assert.equal(listNotifications(uid)[0].read, true);
    patchNotification(n.id, uid, { read: false });
    assert.equal(listNotifications(uid)[0].read, false);
  });

  it("不能改他人的通知", () => {
    const uid = seedUser();
    const other = seedUser();
    const n = createNotification(uid, { title: "原" });
    patchNotification(n.id, other, { title: "篡改" });
    assert.equal(listNotifications(uid)[0].title, "原");
  });
});

describe("删除与批量已读", () => {
  it("deleteNotification 只删本人那一条", () => {
    const uid = seedUser();
    const other = seedUser();
    const mine = createNotification(uid, { title: "我的" });
    const foreign = createNotification(other, { title: "他人的" });

    deleteNotification(mine.id, uid);
    assert.equal(listNotifications(uid).length, 0);

    // 用他人身份删自己的那条，应无效
    deleteNotification(foreign.id, uid);
    assert.equal(listNotifications(other).length, 1);
  });

  it("deleteAllNotifications 只清空本人", () => {
    const uid = seedUser();
    const other = seedUser();
    createNotification(uid, { title: "a" });
    createNotification(uid, { title: "b" });
    createNotification(other, { title: "c" });

    deleteAllNotifications(uid);
    assert.equal(listNotifications(uid).length, 0);
    assert.equal(listNotifications(other).length, 1);
  });

  it("markAllRead 只影响本人且幂等", () => {
    const uid = seedUser();
    const other = seedUser();
    createNotification(uid, { title: "a" });
    createNotification(uid, { title: "b" });
    createNotification(other, { title: "c" });

    markAllRead(uid);
    markAllRead(uid);
    assert.equal(countUnread(uid), 0);
    assert.equal(countUnread(other), 1);
  });
});
