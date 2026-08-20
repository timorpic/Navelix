import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db.ts";
import { saveUserTodos } from "../user-data.ts";

describe("Cross-User Task Delegation & Inbox Aggregation", () => {
  const managerId = "user-mgr-" + Date.now();
  const devId = "user-dev-" + Date.now();

  after(() => {
    db.prepare("DELETE FROM users WHERE id IN (?, ?)").run(managerId, devId);
  });

  it("should aggregate delegated tasks in assignee inbox and sync completion", () => {
    // 1. 创建管理者与开发者两个用户
    db.prepare(`
      INSERT OR IGNORE INTO users (id, username, password_hash, role, display_name, created_at)
      VALUES (?, ?, 'hash', 'admin', 'Manager', ?)
    `).run(managerId, "mgr_" + Date.now(), Date.now());

    db.prepare(`
      INSERT OR IGNORE INTO users (id, username, password_hash, role, display_name, created_at)
      VALUES (?, ?, 'hash', 'user', 'Developer', ?)
    `).run(devId, "dev_" + Date.now(), Date.now());

    // 2. 管理者创建任务，指派给开发者
    const todoId = "todo-task-delegated-" + Date.now();
    saveUserTodos(managerId, [
      {
        id: todoId,
        title: "完成 API 接口联调",
        priority: "high",
        done: false,
        dueDate: "2026-08-30",
        assignedTo: devId,
        assigneeName: "Developer",
      },
    ]);

    // 3. 开发者查询自己的待办列表 (WHERE user_id = ? OR assigned_to = ?)
    const devTodos = db
      .prepare(
        `SELECT t.id, t.user_id, t.title, t.priority, t.done, t.assigned_to,
                u.display_name AS owner_display_name
         FROM user_todos t
         LEFT JOIN users u ON u.id = t.user_id
         WHERE t.user_id = ? OR t.assigned_to = ?
         ORDER BY t.created_at DESC`,
      )
      .all(devId, devId) as Array<{
      id: string;
      user_id: string;
      title: string;
      priority: string;
      done: number;
      assigned_to: string;
      owner_display_name: string;
    }>;

    const delegatedTask = devTodos.find((t) => t.id === todoId);
    assert.ok(delegatedTask, "开发者待办列表中应聚合出指派给他的任务");
    assert.equal(delegatedTask?.title, "完成 API 接口联调");
    assert.equal(delegatedTask?.user_id, managerId, "该任务创建者应为管理者");
    assert.equal(delegatedTask?.assigned_to, devId, "被指派人应为开发者");
    assert.equal(delegatedTask?.done, 0);

    // 4. 开发者完成该任务
    db.prepare("UPDATE user_todos SET done = 1 WHERE id = ?").run(todoId);

    // 5. 管理者查看待办，应看到任务已完成
    const mgrTodo = db
      .prepare("SELECT done FROM user_todos WHERE id = ? AND user_id = ?")
      .get(todoId, managerId) as { done: number };

    assert.equal(mgrTodo.done, 1, "管理者视角中该任务应自动同步标记为已完成");
  });
});
