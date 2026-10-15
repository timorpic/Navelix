import { describe, it } from "node:test";
import assert from "node:assert";
import { db } from "../db.ts";
import { encryptSecret, decryptSecret } from "../secret.ts";
import { recordAuditLog, listAuditLogs } from "../audit.ts";

describe("Database Secrets Encryption & Decryption (AES-256-GCM)", () => {
  it("should encrypt and decrypt sensitive API keys faithfully", () => {
    const rawKey = "sk-proj-abc123XYZ456SecretApiKeyForOpenAI";
    const encrypted = encryptSecret(rawKey);

    assert.ok(encrypted.startsWith("enc:v1:"), "Ciphertext should have enc:v1: prefix");
    assert.notStrictEqual(encrypted, rawKey, "Ciphertext must not match raw plaintext");

    const decrypted = decryptSecret(encrypted);
    assert.strictEqual(decrypted, rawKey, "Decrypted text must exactly match original plaintext");
  });

  it("should handle empty or whitespace inputs cleanly", () => {
    assert.strictEqual(encryptSecret(""), "");
    assert.strictEqual(encryptSecret("   "), "");
    assert.strictEqual(decryptSecret(""), "");
    assert.strictEqual(decryptSecret("   "), "");
  });

  it("should maintain backward compatibility for existing plain text in database", () => {
    const legacyPlainKey = "sk-legacy-unencrypted-key-from-old-db";
    const result = decryptSecret(legacyPlainKey);
    assert.strictEqual(result, legacyPlainKey, "Unencrypted legacy key should return as-is without crashing");
  });

  it("should not double-encrypt an already encrypted secret", () => {
    const rawKey = "sk-sensenova-test-key-12345";
    const encryptedOnce = encryptSecret(rawKey);
    const encryptedTwice = encryptSecret(encryptedOnce);
    assert.strictEqual(encryptedOnce, encryptedTwice, "Already encrypted secret should not be double-encrypted");
  });
});

describe("Security Audit Logs System", () => {
  it("should record and query audit log entries", () => {
    const testUserId = `test-user-${Date.now()}`;
    const testAction = "test.security.action";

    recordAuditLog({
      userId: testUserId,
      action: testAction,
      target: "test_resource",
      ip: "127.0.0.1",
      details: "Audit logging unit test entry",
    });

    const { logs } = listAuditLogs({ action: testAction, limit: 10 });
    assert.ok(logs.length >= 1, "Should find at least 1 audit entry for the test user");
    assert.strictEqual(logs[0].userId, testUserId);
    assert.strictEqual(logs[0].action, testAction);
    assert.strictEqual(logs[0].target, "test_resource");
  });

  it("listAuditLogs 应带身份 JOIN 返回操作者，并支持动作过滤与分页", () => {
    const uid = `audit-user-${Date.now()}`;
    const marker = `pagination-marker-${uid}`;
    db.prepare(
      "INSERT INTO users (id, username, password_hash, display_name, role, avatar, created_at) VALUES (?, ?, 'hash', ?, 'admin', '', ?)",
    ).run(uid, `u_${uid}`, "审计测试员", Date.now());

    recordAuditLog({ userId: uid, action: "config.updated", target: "user_configs", details: marker });
    recordAuditLog({ userId: uid, action: "database.backup.created", target: "db", details: marker });

    // 关键字过滤：命中本测试两条记录，且带上 username/displayName
    const scoped = listAuditLogs({ q: marker });
    assert.strictEqual(scoped.total, 2);
    assert.strictEqual(scoped.logs[0].username, `u_${uid}`);
    assert.strictEqual(scoped.logs[0].displayName, "审计测试员");

    // 动作过滤
    const filtered = listAuditLogs({ q: marker, action: "config.updated" });
    assert.ok(filtered.logs.every((l) => l.action === "config.updated"));

    // 分页：limit=1 只返回 1 条，total 仍为 2
    const paged = listAuditLogs({ q: marker, limit: 1 });
    assert.strictEqual(paged.logs.length, 1);
    assert.strictEqual(paged.total, 2);

    // 清理
    db.prepare("DELETE FROM audit_logs WHERE user_id = ?").run(uid);
    db.prepare("DELETE FROM users WHERE id = ?").run(uid);
  });

  it("listAuditLogs 对被删账号（无 users 行）应回退为已删除标识", () => {
    const uid = `ghost-user-${Date.now()}`;
    recordAuditLog({ userId: uid, action: "config.updated", details: `ghost-${uid}` });
    const result = listAuditLogs({ action: "config.updated", limit: 200 });
    const ghost = result.logs.find((l) => l.userId === uid);
    assert.ok(ghost, "应能找到 ghost 账号的审计条目");
    assert.strictEqual(ghost.username, "");
    assert.strictEqual(ghost.displayName, "");
    db.prepare("DELETE FROM audit_logs WHERE user_id = ?").run(uid);
  });
});
