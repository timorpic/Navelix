import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server.js";
import { proxy } from "../../proxy.ts";
import { db } from "../db.ts";
import { issueApiToken } from "../auth/api-tokens.ts";
import { getSessionUser } from "../auth/session.ts";
import { requireAdmin } from "../auth/guard.ts";
import { listWorkspaceMembers, validateAssignee } from "../workspace-members.ts";
import { createTodo, createProject, syncProjectMilestones, updateTodoFields } from "../todos-projects.ts";
import { saveUserTodos } from "../user-data.ts";

const ids = ["security-owner", "security-member", "security-admin", "security-outsider"];
for (const id of ids) db.prepare("INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, 'hash', ?, ?)").run(id, id, id.endsWith('admin') ? 'admin' : 'user', Date.now());
after(() => { for (const id of ids) db.prepare("DELETE FROM users WHERE id = ?").run(id); });

describe("API proxy", () => {
  it("rejects cross-port writes before handlers and returns security headers", () => {
    const response = proxy(new NextRequest("http://localhost:3721/api/user/data", { method: "POST", headers: { host: "localhost:3721", origin: "http://localhost:9999", "content-type": "application/json" } }));
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  });
  it("rejects browser simple form content types on all write methods", () => {
    for (const method of ["POST", "PATCH", "PUT", "DELETE"]) for (const type of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data; boundary=a"]) {
      assert.equal(proxy(new NextRequest("https://example.com/api/user/data", { method, headers: { host: "example.com", origin: "https://example.com", "content-type": type } })).status, 415);
    }
  });
  it("allows same-origin JSON and safe reads", () => {
    assert.equal(proxy(new NextRequest("http://localhost:3721/api/user/data", { method: "POST", headers: { host: "localhost:3721", origin: "http://localhost:3721", "content-type": "application/json" } })).headers.get("x-middleware-next"), "1");
    assert.equal(proxy(new NextRequest("http://localhost:3721/api/user/data")).status, 200);
  });
  it("allows backup multipart uploads while retaining CSRF and limiting the exception to POST", () => {
    const makeRequest = (path: string, method: string, origin?: string) => new NextRequest(`https://example.com${path}`, {
      method, headers: { host: "example.com", ...(origin ? { origin } : {}), "content-type": "multipart/form-data; boundary=a" },
    });
    assert.equal(proxy(makeRequest("/api/admin/backup", "POST", "https://example.com")).headers.get("x-middleware-next"), "1");
    for (const origin of [undefined, "https://evil.example", "http://example.com", "https://example.com:9999"]) {
      assert.equal(proxy(makeRequest("/api/admin/backup", "POST", origin)).status, 403);
    }
    for (const path of ["/api/user/data", "/api/admin/backup/other"]) {
      assert.equal(proxy(makeRequest(path, "POST", "https://example.com")).status, 415);
    }
    assert.equal(proxy(makeRequest("/api/admin/backup", "PATCH", "https://example.com")).status, 415);
  });
});

describe("authentication guards and token expiry", () => {
  it("calls the real admin guard for anonymous, ordinary, admin, expired and disabled accounts", async () => {
    assert.equal(await requireAdmin(), null);
    for (const id of [ids[0], ids[2]]) {
      const issued = issueApiToken(id, "guard");
      const request = new Request("https://example.com", { headers: { authorization: `Bearer ${issued.token}` } });
      assert.equal((await requireAdmin(request))?.id ?? null, id === ids[2] ? id : null);
      assert.equal((await getSessionUser(request))?.id, id);
      db.prepare("UPDATE api_tokens SET expires_at = ? WHERE id = ?").run(Date.now() - 1, issued.tokenId);
      assert.equal(await getSessionUser(request), null);
      assert.equal(await requireAdmin(request), null);
    }
    const issued = issueApiToken(ids[2], "disabled");
    db.prepare("UPDATE users SET disabled = 1 WHERE id = ?").run(ids[2]);
    assert.equal(await requireAdmin(new Request("https://example.com", { headers: { authorization: `Bearer ${issued.token}` } })), null);
    db.prepare("UPDATE users SET disabled = 0 WHERE id = ?").run(ids[2]);
  });
});

describe("member privacy and delegation", () => {
  it("hides unrelated accounts and roles, including disabled accounts from admins", () => {
    assert.deepEqual(listWorkspaceMembers(ids[0]).map(m => m.id), [ids[0]]);
    assert.ok(listWorkspaceMembers(ids[2]).some(m => m.id === ids[1]));
    assert.ok(listWorkspaceMembers(ids[2]).every(m => !("role" in m)));
    db.prepare("UPDATE users SET disabled = 1 WHERE id = ?").run(ids[3]);
    assert.ok(!listWorkspaceMembers(ids[2]).some(m => m.id === ids[3]));
    db.prepare("UPDATE users SET disabled = 0 WHERE id = ?").run(ids[3]);
  });
  it("rejects arbitrary recipients in create, patch, milestone and snapshot writes", () => {
    const recipient = ids[3];
    assert.throws(() => createTodo(ids[0], { title: "bad", assigneeId: recipient }));
    const id = createTodo(ids[0], { title: "own" });
    assert.throws(() => updateTodoFields(id, ids[0], { assigneeId: recipient }));
    assert.throws(() => saveUserTodos(ids[0], [{ id, title: "bad", assigneeId: recipient }]));
    assert.throws(() => createProject(ids[0], { name: "bad", todos: [{ title: "bad", assigneeId: recipient }] }));
    const project = createProject(ids[0], { name: "own" });
    assert.throws(() => syncProjectMilestones(project.id, ids[0], [{ title: "bad", assigneeId: recipient }]));
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM projects WHERE user_id = ?").get(ids[0])?.n, 1);
  });
  it("allows existing shared-category collaborators and uses server-side names", () => {
    db.prepare("INSERT INTO user_categories (id,user_id,name,label,icon,color,is_team_shared) VALUES ('shared',?,'shared','shared','','',1)").run(ids[1]);
    db.prepare("INSERT INTO user_category_subscriptions (user_id, category_id, owner_id, created_at) VALUES (?,'shared',?,?)").run(ids[0],ids[1],Date.now());
    assert.equal(validateAssignee(ids[0], ids[1]).name, ids[1]);
    assert.ok(listWorkspaceMembers(ids[1]).some(m => m.id === ids[0]));
    createTodo(ids[0], { title: "team", assigneeId: ids[1], assigneeName: "spoofed" });
    assert.equal(db.prepare("SELECT assignee_name FROM user_todos WHERE title = 'team' AND user_id = ?").get(ids[0])?.assignee_name, ids[1]);
  });
});
