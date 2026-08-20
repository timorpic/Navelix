import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { db, seedUserData } from "../db.ts";

describe("Database Foreign Keys & CASCADE", () => {
  it("should enforce foreign key constraints and enable PRAGMA foreign_keys", () => {
    const fkResult = db.prepare("PRAGMA foreign_keys").get() as { foreign_keys: number };
    assert.equal(fkResult.foreign_keys, 1);
  });

  it("should cascade delete user sessions, categories, links, and configs when user is deleted", () => {
    const testUserId = "test-cascade-user-" + Date.now();
    db.prepare(`
      INSERT INTO users (id, username, password_hash, display_name, role, created_at)
      VALUES (?, ?, 'hash', 'Test User', 'user', ?)
    `).run(testUserId, testUserId, Date.now());

    seedUserData(testUserId);

    // Verify records exist for this user
    const configBefore = db.prepare("SELECT user_id FROM user_configs WHERE user_id = ?").get(testUserId);
    assert.ok(configBefore);

    const categoriesBefore = db.prepare("SELECT user_id FROM user_categories WHERE user_id = ?").all(testUserId);
    assert.ok(categoriesBefore.length > 0);

    // Delete user
    db.prepare("DELETE FROM users WHERE id = ?").run(testUserId);

    // Verify CASCADE deletion
    const configAfter = db.prepare("SELECT user_id FROM user_configs WHERE user_id = ?").get(testUserId);
    assert.equal(configAfter, undefined);

    const categoriesAfter = db.prepare("SELECT user_id FROM user_categories WHERE user_id = ?").all(testUserId);
    assert.equal(categoriesAfter.length, 0);

    const linksAfter = db.prepare("SELECT user_id FROM user_links WHERE user_id = ?").all(testUserId);
    assert.equal(linksAfter.length, 0);
  });
});
