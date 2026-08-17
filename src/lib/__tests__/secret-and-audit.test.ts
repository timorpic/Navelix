import { describe, it } from "node:test";
import assert from "node:assert";
import { encryptSecret, decryptSecret } from "../secret.ts";
import { recordAuditLog, getRecentAuditLogs } from "../audit.ts";

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

    const logs = getRecentAuditLogs(testUserId, 10);
    assert.ok(logs.length >= 1, "Should find at least 1 audit entry for the test user");
    assert.strictEqual(logs[0].userId, testUserId);
    assert.strictEqual(logs[0].action, testAction);
    assert.strictEqual(logs[0].target, "test_resource");
  });
});
