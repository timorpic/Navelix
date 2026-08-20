import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db.ts";
import { getUserData, saveUserCategories, saveUserLinks } from "../user-data.ts";

describe("Team Shared Categories & Subscriptions", () => {
  const userA = "user-team-a-" + Date.now();
  const userB = "user-team-b-" + Date.now();

  after(() => {
    db.prepare("DELETE FROM users WHERE id IN (?, ?)").run(userA, userB);
  });

  it("should support creating shared categories and subscribing across users", () => {
    // 1. 创建测试用户 A 与 B
    db.prepare(`
      INSERT OR IGNORE INTO users (id, username, password_hash, role, display_name, created_at)
      VALUES (?, ?, 'hash', 'user', 'User A', ?)
    `).run(userA, "usera_" + Date.now(), Date.now());

    db.prepare(`
      INSERT OR IGNORE INTO users (id, username, password_hash, role, display_name, created_at)
      VALUES (?, ?, 'hash', 'user', 'User B', ?)
    `).run(userB, "userb_" + Date.now(), Date.now());

    // 2. 用户 A 创建一个公开分类「前端规范」并添加链接
    saveUserCategories(userA, [
      {
        id: "cat-shared-fe",
        name: "前端规范",
        icon: "🎨",
        color: "#00C776",
        isTeamShared: true,
      },
    ]);

    saveUserLinks(userA, [
      {
        id: "link-fe-doc",
        title: "React 19 规范指南",
        url: "https://react.dev",
        category: "cat-shared-fe",
      },
    ]);

    // 3. 用户 B 订阅用户 A 的「前端规范」分类
    db.prepare(`
      INSERT INTO user_category_subscriptions (user_id, category_id, owner_id, created_at)
      VALUES (?, ?, ?, ?)
    `).run(userB, "cat-shared-fe", userA, Date.now());

    // 4. 用户 B 获取数据，应自动并入该分类及分类下的链接
    const bData = getUserData(userB);
    const subCat = bData.categories.find((c) => c.id === "cat-shared-fe");
    assert.ok(subCat, "用户 B 应能在分类列表中看到已订阅的团队分类");
    assert.equal(subCat?.isSubscribed, true);
    assert.equal(subCat?.name, "前端规范");

    const subLink = bData.links.find((l) => l.id === "link-fe-doc");
    assert.ok(subLink, "用户 B 应能在书签列表中看到订阅分类下的链接");
    assert.equal(subLink?.title, "React 19 规范指南");

    // 5. 用户 B 取消订阅
    db.prepare(`
      DELETE FROM user_category_subscriptions
      WHERE user_id = ? AND category_id = ? AND owner_id = ?
    `).run(userB, "cat-shared-fe", userA);

    const bDataAfter = getUserData(userB);
    const subCatAfter = bDataAfter.categories.find((c) => c.id === "cat-shared-fe");
    assert.equal(subCatAfter, undefined, "取消订阅后分类应从用户 B 视图中移除");
  });
});
