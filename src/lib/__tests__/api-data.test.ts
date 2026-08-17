import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db.ts";
import {
  saveUserCategories,
  saveUserLinks,
  saveUserProjects,
  saveUserTodos,
  saveUserConfigs,
} from "../user-data.ts";
import { decryptSecret } from "../secret.ts";
import {
  checkLoginRateLimit,
  recordLoginFailure,
  resetLoginRateLimit,
} from "../auth.ts";

/**
 * API 数据层集成测试：
 * 覆盖 POST /api/user/data 的 5 种实体保存函数（upsert + 删除语义）
 * 以及登录限流的锁定组合场景。
 * 注：测试沿用现有模式，操作真实 db 但使用独立测试用户（结束后清理）。
 */

const TEST_USER_ID = `test-api-data-${Date.now()}`;

function createTestUser() {
  db.prepare(`
    INSERT OR IGNORE INTO users (id, username, password_hash, display_name, role, created_at)
    VALUES (?, ?, 'hash', 'API Test', 'user', ?)
  `).run(TEST_USER_ID, TEST_USER_ID, Date.now());
}

function cleanupTestUser() {
  db.prepare("DELETE FROM users WHERE id = ?").run(TEST_USER_ID);
  db.prepare("DELETE FROM user_categories WHERE user_id = ?").run(TEST_USER_ID);
  db.prepare("DELETE FROM user_links WHERE user_id = ?").run(TEST_USER_ID);
  db.prepare("DELETE FROM projects WHERE user_id = ?").run(TEST_USER_ID);
  db.prepare("DELETE FROM user_todos WHERE user_id = ?").run(TEST_USER_ID);
  db.prepare("DELETE FROM user_configs WHERE user_id = ?").run(TEST_USER_ID);
}

beforeEach(() => {
  cleanupTestUser();
  createTestUser();
});

afterEach(() => {
  cleanupTestUser();
});

describe("saveUserCategories (upsert + 删除语义)", () => {
  it("应该新增分类并删除不在列表中的旧分类", () => {
    // 首次保存两个分类
    saveUserCategories(TEST_USER_ID, [
      { id: "cat-a", name: "AI 工具", label: "AI", icon: "🤖", color: "#00C776" },
      { id: "cat-b", name: "开发", label: "Dev", icon: "💻", color: "#3B82F6" },
    ]);
    let rows = db
      .prepare("SELECT id FROM user_categories WHERE user_id = ? ORDER BY id")
      .all(TEST_USER_ID) as { id: string }[];
    assert.deepEqual(rows.map((r) => r.id), ["cat-a", "cat-b"]);

    // 再次保存仅保留 cat-a + 新增 cat-c → cat-b 应被删除
    saveUserCategories(TEST_USER_ID, [
      { id: "cat-a", name: "AI 工具", label: "AI", icon: "🤖", color: "#00C776" },
      { id: "cat-c", name: "设计", label: "Des", icon: "🎨", color: "#EC4899" },
    ]);
    rows = db
      .prepare("SELECT id FROM user_categories WHERE user_id = ? ORDER BY id")
      .all(TEST_USER_ID) as { id: string }[];
    assert.deepEqual(rows.map((r) => r.id), ["cat-a", "cat-c"]);
  });

  it("传入空数组时应清空全部分类", () => {
    saveUserCategories(TEST_USER_ID, [{ id: "cat-a", name: "A", label: "A", icon: "📁", color: "#000" }]);
    saveUserCategories(TEST_USER_ID, []);
    const count = db
      .prepare("SELECT COUNT(*) AS c FROM user_categories WHERE user_id = ?")
      .get(TEST_USER_ID) as { c: number };
    assert.equal(count.c, 0);
  });
});

describe("saveUserLinks (upsert + 删除语义)", () => {
  it("应该新增链接并删除不在列表中的旧链接", () => {
    saveUserLinks(TEST_USER_ID, [
      { id: "lnk-1", title: "GitHub", url: "https://github.com", description: "", icon: "", category: "cat-a", isQuickAccess: true },
      { id: "lnk-2", title: "Google", url: "https://google.com", description: "", icon: "", category: "cat-b", isQuickAccess: false },
    ]);
    const rows = db
      .prepare("SELECT id, is_quick_access FROM user_links WHERE user_id = ? ORDER BY id")
      .all(TEST_USER_ID) as { id: string; is_quick_access: number }[];
    assert.deepEqual(rows.map((r) => r.id), ["lnk-1", "lnk-2"]);
    assert.equal(rows[0].is_quick_access, 1);

    // 仅保留 lnk-2 → lnk-1 应被删除
    saveUserLinks(TEST_USER_ID, [{ id: "lnk-2", title: "Google", url: "https://google.com", description: "", icon: "", category: "cat-b", isQuickAccess: false }]);
    const remainingLinks = db
      .prepare("SELECT id FROM user_links WHERE user_id = ? ORDER BY id")
      .all(TEST_USER_ID) as unknown as { id: string; is_quick_access: number }[];
    assert.deepEqual(remainingLinks.map((r) => r.id), ["lnk-2"]);
  });
});

describe("saveUserProjects (upsert + 删除语义)", () => {
  it("应该新增项目、保留 sort_order 并删除旧项目", () => {
    saveUserProjects(TEST_USER_ID, [
      { id: "proj-1", name: "项目A", status: "进行中", statusColor: "#00C776", url: "" },
      { id: "proj-2", name: "项目B", status: "已完成", statusColor: "#00C776", url: "" },
    ]);
    const projs = db
      .prepare("SELECT id, sort_order FROM projects WHERE user_id = ? ORDER BY sort_order")
      .all(TEST_USER_ID) as { id: string; sort_order: number }[];
    assert.deepEqual(projs.map((p) => p.id), ["proj-1", "proj-2"]);
    assert.deepEqual(projs.map((p) => p.sort_order), [0, 1]);

    saveUserProjects(TEST_USER_ID, [{ id: "proj-2", name: "项目B", status: "已完成", statusColor: "#00C776", url: "" }]);
    const remainingProjs = db
      .prepare("SELECT id FROM projects WHERE user_id = ?")
      .all(TEST_USER_ID) as unknown as { id: string; sort_order: number }[];
    assert.deepEqual(remainingProjs.map((p) => p.id), ["proj-2"]);
  });
});

describe("saveUserTodos (upsert + 删除语义)", () => {
  it("应该新增待办并删除不在列表中的旧待办", () => {
    saveUserTodos(TEST_USER_ID, [
      { id: "todo-1", title: "写周报", priority: "high", done: false, dueDate: "2026-08-20", projectId: "proj-1", sortOrder: 0 },
    ]);
    const todos = db
      .prepare("SELECT id, done FROM user_todos WHERE user_id = ?")
      .all(TEST_USER_ID) as { id: string; done: number }[];
    assert.equal(todos.length, 1);
    assert.equal(todos[0].done, 0);

    saveUserTodos(TEST_USER_ID, []);
    const remainingTodos = db
      .prepare("SELECT id FROM user_todos WHERE user_id = ?")
      .all(TEST_USER_ID) as unknown as { id: string; done: number }[];
    assert.equal(remainingTodos.length, 0);
  });
});

describe("saveUserConfigs (字段合并 + 密钥留空语义)", () => {
  it("更新部分字段时应保留库内其他字段", () => {
    saveUserConfigs(TEST_USER_ID, {
      logoText: "测试品牌",
      theme: "dark",
    });
    let row = db
      .prepare("SELECT logo_text, theme, search_engine FROM user_configs WHERE user_id = ?")
      .get(TEST_USER_ID) as { logo_text: string; theme: string; search_engine: string };
    assert.equal(row.logo_text, "测试品牌");
    assert.equal(row.theme, "dark");
    // 未传字段应保留默认值
    assert.equal(row.search_engine, "google");

    // 第二次只改 search_engine → 品牌与主题保留
    saveUserConfigs(TEST_USER_ID, { searchEngine: "bing" });
    row = db
      .prepare("SELECT logo_text, theme, search_engine FROM user_configs WHERE user_id = ?")
      .get(TEST_USER_ID) as { logo_text: string; theme: string; search_engine: string };
    assert.equal(row.logo_text, "测试品牌");
    assert.equal(row.theme, "dark");
    assert.equal(row.search_engine, "bing");
  });

  it("密钥字段传入空字符串时不清空已有密钥（留空=保持不变且落盘加密）", () => {
    saveUserConfigs(TEST_USER_ID, { aiApiKey: "sk-test-123" });
    saveUserConfigs(TEST_USER_ID, { aiApiKey: "" });
    const row = db
      .prepare("SELECT ai_api_key FROM user_configs WHERE user_id = ?")
      .get(TEST_USER_ID) as { ai_api_key: string };
    assert.ok(row.ai_api_key.startsWith("enc:v1:"), "数据库落盘必须为 AES-256 加密密文");
    assert.equal(decryptSecret(row.ai_api_key), "sk-test-123");
  });
});

describe("登录限流锁定组合场景", () => {
  it("超过 5 次失败后锁定，并返回正数剩余时间", () => {
    const clientId = `test-lock-${Date.now()}`;
    resetLoginRateLimit(clientId);

    for (let i = 0; i < 5; i++) {
      const status = checkLoginRateLimit(clientId);
      assert.equal(status.allowed, true);
      recordLoginFailure(clientId);
    }

    const locked = checkLoginRateLimit(clientId);
    assert.equal(locked.allowed, false);
    assert.ok(locked.lockRemainingMs > 0, "锁定状态应返回正数剩余毫秒");
    assert.ok(locked.lockRemainingMs <= 15 * 60 * 1000 + 1000, "剩余时间不应超过窗口");

    resetLoginRateLimit(clientId);
  });

  it("不同 clientId 互不影响（多用户隔离）", () => {
    const a = `test-iso-a-${Date.now()}`;
    const b = `test-iso-b-${Date.now()}`;
    resetLoginRateLimit(a);
    resetLoginRateLimit(b);

    for (let i = 0; i < 5; i++) {
      recordLoginFailure(a);
    }
    assert.equal(checkLoginRateLimit(a).allowed, false);
    assert.equal(checkLoginRateLimit(b).allowed, true);

    resetLoginRateLimit(a);
    resetLoginRateLimit(b);
  });
});