import { describe, it } from "node:test";
import assert from "node:assert";
import { db } from "../db.ts";
import { getSessionUser } from "../auth.ts";
import { issueApiToken, revokeApiToken } from "../auth/api-tokens.ts";

describe("Personal API Tokens & Bearer Auth System", () => {
  it("should generate, authenticate via Bearer token, update last_used_at, and revoke token", async () => {
    // 1. Setup mock user
    const testUserId = `user_token_test_${Date.now()}`;
    db.prepare(
      "INSERT INTO users (id, username, password_hash, display_name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(testUserId, `tokuser_${Date.now()}`, "hash", "Token User", "user", Date.now());

    try {
      // 2. Generate API token
      const { token: rawToken, tokenId } = issueApiToken(testUserId, "Test Token");

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
      revokeApiToken(testUserId, tokenId);
      const revokedUser = await getSessionUser(req);
      assert.strictEqual(revokedUser, null);
    } finally {
      // Guaranteed Cleanup
      db.prepare("DELETE FROM users WHERE id = ?").run(testUserId);
    }
  });
});
