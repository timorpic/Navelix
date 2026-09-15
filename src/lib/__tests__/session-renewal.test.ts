import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { db, SESSION_IDLE_TTL_MS, SESSION_MAX_TTL_MS } from "../db.ts";
import { createSession, destroySession, renewSession } from "../auth.ts";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

describe("browser session renewal", () => {
  it("extends an active session but never beyond 30 days after its creation", async () => {
    const userId = `session-renew-user-${randomBytes(8).toString("hex")}`;
    db.prepare(
      "INSERT INTO users (id, username, password_hash, display_name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(userId, userId, "hash", "Session renewal", "user", Date.now());

    const token = await createSession(userId);
    const tokenHash = hashToken(token);
    const createdAt = (
      db.prepare("SELECT created_at FROM sessions WHERE token_hash = ?").get(tokenHash) as {
        created_at: number;
      }
    ).created_at;

    try {
      db.prepare("UPDATE sessions SET expires_at = ? WHERE token_hash = ?").run(
        Date.now() + 1_000,
        tokenHash,
      );
      const renewed = renewSession(token);

      assert.ok(renewed?.renewed);
      assert.ok(renewed.expiresAt > Date.now() + SESSION_IDLE_TTL_MS - 5_000);
      assert.ok(renewed.expiresAt <= createdAt + SESSION_MAX_TTL_MS);
    } finally {
      await destroySession(token);
      db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    }
  });

  it("does not renew a session after its absolute lifetime", async () => {
    const userId = `session-max-user-${randomBytes(8).toString("hex")}`;
    db.prepare(
      "INSERT INTO users (id, username, password_hash, display_name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(userId, userId, "hash", "Session max", "user", Date.now());

    const token = await createSession(userId);
    const tokenHash = hashToken(token);
    try {
      db.prepare("UPDATE sessions SET created_at = ?, expires_at = ? WHERE token_hash = ?").run(
        Date.now() - SESSION_MAX_TTL_MS,
        Date.now() + SESSION_IDLE_TTL_MS,
        tokenHash,
      );

      assert.equal(renewSession(token), null);
    } finally {
      await destroySession(token);
      db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    }
  });

  it("does not reactivate a session that was explicitly logged out", async () => {
    const userId = `session-logout-user-${randomBytes(8).toString("hex")}`;
    db.prepare(
      "INSERT INTO users (id, username, password_hash, display_name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(userId, userId, "hash", "Session logout", "user", Date.now());

    const token = await createSession(userId);
    try {
      await destroySession(token);
      assert.equal(renewSession(token), null);
    } finally {
      db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    }
  });
});
