import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db.ts";
import { performDatabaseBackup } from "../db-backup.ts";
import fs from "node:fs";

describe("Admin Backup & Access Policies", () => {
  it("should create a valid physical database backup file on disk", () => {
    const backupPath = performDatabaseBackup();
    assert.ok(backupPath);
    assert.equal(fs.existsSync(backupPath), true);
    const stat = fs.statSync(backupPath);
    assert.ok(stat.size > 0);
  });

  it("should enforce allow_registration setting column in user_configs", () => {
    const testUser = "test-policy-" + Date.now();
    try {
      db.prepare("INSERT INTO users (id, username, password_hash, display_name, role, created_at) VALUES (?, ?, 'hash', 'Test', 'user', ?)").run(testUser, testUser, Date.now());
      db.prepare("INSERT INTO user_configs (user_id, allow_registration, allow_public_access) VALUES (?, 0, 0)").run(testUser);

      const cfg = db.prepare("SELECT allow_registration, allow_public_access FROM user_configs WHERE user_id = ?").get(testUser) as { allow_registration: number; allow_public_access: number };
      assert.equal(cfg.allow_registration, 0);
      assert.equal(cfg.allow_public_access, 0);
    } finally {
      db.prepare("DELETE FROM users WHERE id = ?").run(testUser);
    }
  });

  it("should properly store and format custom search engine URL and scripts", () => {
    const testUser = "test-custom-search-" + Date.now();
    try {
      db.prepare("INSERT INTO users (id, username, password_hash, display_name, role, created_at) VALUES (?, ?, 'hash', 'Test', 'user', ?)").run(testUser, testUser, Date.now());
      db.prepare("INSERT INTO user_configs (user_id, search_engine, custom_search_name, custom_search_url, custom_head_scripts, custom_css) VALUES (?, 'custom', 'SearXNG', 'https://search.example.com/search?q=%s', '<script src=\"/test.js\"></script>', 'body { color: red; }')").run(testUser);

      const cfg = db.prepare("SELECT search_engine, custom_search_name, custom_search_url, custom_head_scripts, custom_css FROM user_configs WHERE user_id = ?").get(testUser) as { search_engine: string; custom_search_name: string; custom_search_url: string; custom_head_scripts: string; custom_css: string };
      assert.equal(cfg.search_engine, "custom");
      assert.equal(cfg.custom_search_name, "SearXNG");
      assert.equal(cfg.custom_search_url, "https://search.example.com/search?q=%s");
      assert.equal(cfg.custom_head_scripts, '<script src="/test.js"></script>');
      assert.equal(cfg.custom_css, "body { color: red; }");
    } finally {
      db.prepare("DELETE FROM users WHERE id = ?").run(testUser);
    }
  });
});
