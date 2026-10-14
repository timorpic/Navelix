import { it } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db.ts";
import { createProject, createTodo, updateProject, updateTodoFields } from "../todos-projects.ts";
import { saveUserTodos } from "../user-data.ts";
import { AssignmentError, listWorkspaceMembers } from "../workspace-members.ts";

for (const reason of ["unsubscribed", "disabled"] as const) {
  it(`preserves unchanged assignments after ${reason}, but blocks new assignments and transfers`, () => {
    const owner = `continuity-${reason}-owner`, recipient = `continuity-${reason}-recipient`, outsider = `continuity-${reason}-outsider`;
    for (const id of [owner, recipient, outsider]) db.prepare("INSERT INTO users (id, username, password_hash, display_name, created_at) VALUES (?, ?, 'hash', ?, ?)").run(id, id, id, Date.now());
    try {
      db.prepare("INSERT INTO user_categories (id,user_id,name,label,icon,color,is_team_shared) VALUES ('team',?,'team','team','','',1)").run(recipient);
      db.prepare("INSERT INTO user_category_subscriptions (user_id,category_id,owner_id,created_at) VALUES (?,'team',?,?)").run(owner, recipient, Date.now());
      const project = createProject(owner, { name: "Original", todos: [{ title: "Milestone", assigneeId: recipient }] });
      const row = db.prepare("SELECT id FROM user_todos WHERE user_id = ? AND project_id = ?").get(owner, project.id);
      const id = String(row?.id);
      if (reason === "disabled") db.prepare("UPDATE users SET disabled = 1 WHERE id = ?").run(recipient);
      else db.prepare("DELETE FROM user_category_subscriptions WHERE user_id = ?").run(owner);
      assert.ok(!listWorkspaceMembers(owner).some(member => member.id === recipient));
      updateTodoFields(id, owner, { title: "Updated", assigneeId: recipient, assigneeName: "spoof" });
      assert.equal(db.prepare("SELECT assignee_name FROM user_todos WHERE id = ? AND user_id = ?").get(id, owner)?.assignee_name, recipient);
      const milestones = [{ id, title: "Updated", assigneeId: recipient }];
      updateProject(project.id, owner, { name: "Renamed", todos: milestones });
      assert.equal(db.prepare("SELECT name FROM projects WHERE id = ? AND user_id = ?").get(project.id, owner)?.name, "Renamed");
      saveUserTodos(owner, [{ id, title: "Snapshot", assigneeId: recipient, assigneeName: "spoof" }]);
      assert.equal(db.prepare("SELECT assignee_name FROM user_todos WHERE id = ? AND user_id = ?").get(id, owner)?.assignee_name, recipient);
      assert.throws(() => createTodo(owner, { title: "New", assigneeId: recipient }), AssignmentError);
      assert.throws(() => updateTodoFields(id, owner, { assigneeId: outsider }), AssignmentError);
      assert.throws(() => saveUserTodos(outsider, [{ id, title: "Foreign", assigneeId: recipient }]), AssignmentError);
      assert.throws(() => updateProject(project.id, owner, { name: "Rejected", todos: [...milestones, { title: "New milestone", assigneeId: recipient }] }), AssignmentError);
      assert.equal(db.prepare("SELECT name FROM projects WHERE id = ? AND user_id = ?").get(project.id, owner)?.name, "Renamed");
      // Legacy assigned_to records also retain their recipient, and null explicitly clears both columns.
      db.prepare("UPDATE user_todos SET assignee_id = '' WHERE id = ? AND user_id = ?").run(id, owner);
      updateTodoFields(id, owner, { assigneeName: "spoof" });
      assert.equal(db.prepare("SELECT assignee_name FROM user_todos WHERE id = ? AND user_id = ?").get(id, owner)?.assignee_name, recipient);
      updateTodoFields(id, owner, { assigneeId: null });
      assert.equal(db.prepare("SELECT assigned_to, assignee_name FROM user_todos WHERE id = ? AND user_id = ?").get(id, owner)?.assigned_to, "");
      assert.equal(db.prepare("SELECT assignee_name FROM user_todos WHERE id = ? AND user_id = ?").get(id, owner)?.assignee_name, "");
      assert.throws(() => updateTodoFields(id, owner, { assigneeId: recipient }), AssignmentError);
    } finally {
      for (const id of [owner, recipient, outsider]) db.prepare("DELETE FROM users WHERE id = ?").run(id);
    }
  });
}
