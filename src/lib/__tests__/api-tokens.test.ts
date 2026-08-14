import { describe, it } from "node:test";
import assert from "node:assert";
import { db } from "../db.ts";
import { getSessionUser } from "../auth.ts";
import { createHash, randomBytes } from "node:crypto";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

describe("Personal API Tokens & Bearer Auth System", () => {
  it("should generate, authenticate via Bearer token, update last_used_at, and revoke token", async () => {
    // 1. Setup mock user
    const testUserId = `user_token_test_${Date.now()}`;
    db.prepare(
      "INSERT INTO users (id, username, password_hash, display_name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(testUserId, `tokuser_${Date.now()}`, "hash", "Token User", "user", Date.now());

    // 2. Generate API token
    const secretPart = randomBytes(24).toString("hex");
    const rawToken = `nvx_live_${secretPart}`;
    const tokenId = `tok_${randomBytes(8).toString("hex")}`;
    const tokenHash = hashToken(rawToken);
    const now = Date.now();

    db.prepare(
      "INSERT INTO api_tokens (id, user_id, name, token_hash, token_prefix, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(tokenId, testUserId, "Test Token", tokenHash, "nvx_live_test...", now);

    // 3. Test getSessionUser with Bearer Header
    const req = new Request("http://localhost/api/todos", {
      headers: {
        authorization: `Bearer ${rawToken}`,
      },
    });

    const user = await getSessionUser(req);
    assert.strictEqual(user !== null, true);
    assert.strictEqual(user?.id, testUserId);
    assert.strictEqual(user?.displayName, "Token User");

    // 4. Verify last_used_at was updated
    const updatedToken = db
      .prepare("SELECT last_used_at FROM api_tokens WHERE id = ?")
      .get(tokenId) as { last_used_at: number | null };
    assert.strictEqual(typeof updatedToken.last_used_at, "number");

    // 5. Revoke token
    db.prepare("DELETE FROM api_tokens WHERE id = ?").run(tokenId);
    const revokedUser = await getSessionUser(req);
    assert.strictEqual(revokedUser, null);

    // Cleanup
    db.prepare("DELETE FROM users WHERE id = ?").run(testUserId);
  });
});
