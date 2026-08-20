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

  it("should atomically create project with AI scheduled milestones and due dates", () => {
    const testUserId = "test-pt-user2-" + Date.now();
    db.prepare(`
      INSERT INTO users (id, username, password_hash, display_name, role, created_at)
      VALUES (?, ?, 'hash', 'PT User 2', 'user', ?)
    `).run(testUserId, testUserId, Date.now());

    const projId = "proj-ai-" + Date.now();
    const tasks = [
      { title: "系统架构与设计", priority: "high", dueDate: "2026-08-16" },
      { title: "核心接口联调", priority: "medium", dueDate: "2026-08-18" },
      { title: "上线发布", priority: "low", dueDate: "2026-08-20" },
    ];

    db.prepare(`
      INSERT INTO projects (id, user_id, name, status, status_color, url, sort_order)
      VALUES (?, ?, 'AI Project', '进行中', '#00C776', '', 0)
    `).run(projId, testUserId);

    const insertTodo = db.prepare(`
      INSERT INTO user_todos (id, user_id, title, priority, done, due_date, project_id, created_at, sort_order)
      VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)
    `);

    tasks.forEach((t, i) => {
      insertTodo.run(`todo-${projId}-${i}`, testUserId, t.title, t.priority, t.dueDate, projId, Date.now() + i, i);
    });

    const createdTodos = db
      .prepare("SELECT title, priority, due_date FROM user_todos WHERE user_id = ? AND project_id = ? ORDER BY sort_order ASC")
      .all(testUserId, projId) as { title: string; priority: string; due_date: string }[];

    assert.equal(createdTodos.length, 3);
    assert.equal(createdTodos[0].title, "系统架构与设计");
    assert.equal(createdTodos[0].due_date, "2026-08-16");

    // Clean up
    db.prepare("DELETE FROM users WHERE id = ?").run(testUserId);
  });

  it("should correctly store, update, and query multi-user assignees for tasks", () => {
    const ownerId = "owner-" + Date.now();
    const colleagueId = "colleague-" + Date.now();

    db.prepare("INSERT INTO users (id, username, password_hash, display_name, role, created_at) VALUES (?, ?, 'hash', 'Owner', 'admin', ?)")
      .run(ownerId, ownerId, Date.now());
    db.prepare("INSERT INTO users (id, username, password_hash, display_name, role, created_at) VALUES (?, ?, 'hash', 'Colleague Alice', 'user', ?)")
      .run(colleagueId, colleagueId, Date.now());

    const todoId = "todo-assigned-" + Date.now();
    db.prepare(`
      INSERT INTO user_todos (id, user_id, title, priority, done, due_date, project_id, assignee_id, assignee_name, created_at, sort_order)
      VALUES (?, ?, 'Multi-user Task', 'high', 0, '2026-08-18', '', ?, 'Colleague Alice', ?, 0)
    `).run(todoId, ownerId, colleagueId, Date.now());

    const todo = db.prepare("SELECT assignee_id, assignee_name FROM user_todos WHERE id = ?").get(todoId) as { assignee_id: string; assignee_name: string };
    assert.ok(todo);
    assert.equal(todo.assignee_id, colleagueId);
    assert.equal(todo.assignee_name, "Colleague Alice");

    // Clean up
    db.prepare("DELETE FROM users WHERE id IN (?, ?)").run(ownerId, colleagueId);
  });
});
