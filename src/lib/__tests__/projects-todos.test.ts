import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db.ts";

describe("Projects & Todos Data Integrity", () => {
  it("should create, read, and cascade delete projects and todos for a user", () => {
    const testUserId = "test-pt-user-" + Date.now();
    db.prepare(`
      INSERT INTO users (id, username, password_hash, display_name, role, created_at)
      VALUES (?, ?, 'hash', 'PT User', 'user', ?)
    `).run(testUserId, testUserId, Date.now());

    // Insert project
    const projId = "proj-" + Date.now();
    db.prepare(`
      INSERT INTO projects (id, user_id, name, status, status_color, url, sort_order)
      VALUES (?, ?, 'Test Project', '进行中', '#00C776', 'https://example.com', 0)
    `).run(projId, testUserId);

    // Insert todo
    const todoId = "todo-" + Date.now();
    db.prepare(`
      INSERT INTO user_todos (id, user_id, title, priority, done, due_date, project_id, created_at, sort_order)
      VALUES (?, ?, 'Test Todo', 'high', 0, '', ?, ?, 0)
    `).run(todoId, testUserId, projId, Date.now());

    // Read back
    const proj = db.prepare("SELECT * FROM projects WHERE user_id = ? AND id = ?").get(testUserId, projId);
    assert.ok(proj);

    const todo = db.prepare("SELECT * FROM user_todos WHERE user_id = ? AND id = ?").get(testUserId, todoId);
    assert.ok(todo);

    // Delete user -> verify cascade deletion of projects & todos
    db.prepare("DELETE FROM users WHERE id = ?").run(testUserId);

    const projsAfter = db.prepare("SELECT * FROM projects WHERE user_id = ?").all(testUserId);
    assert.equal(projsAfter.length, 0);

    const todosAfter = db.prepare("SELECT * FROM user_todos WHERE user_id = ?").all(testUserId);
    assert.equal(todosAfter.length, 0);
  });
});
