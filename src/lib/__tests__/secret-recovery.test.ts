import { it } from "node:test";
import assert from "node:assert/strict";
import { createCipheriv, randomBytes } from "node:crypto";
import { recoverEncryptedSecret } from "../secret-recovery.ts";

it("verifies restored credentials, migrates only an explicitly supplied legacy key and rejects unrelated keys", () => {
  const legacy = randomBytes(32);
  const current = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", legacy, iv);
  const ciphertext = Buffer.concat([cipher.update(randomBytes(24)), cipher.final()]);
  const value = `enc:v1:${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${ciphertext.toString("hex")}`;
  assert.throws(() => recoverEncryptedSecret(value, current));
  assert.throws(() => recoverEncryptedSecret(value, current, randomBytes(32)));
  const migrated = recoverEncryptedSecret(value, current, legacy);
  assert.notEqual(migrated, value);
  assert.equal(recoverEncryptedSecret(migrated, current), migrated);
  assert.throws(() => recoverEncryptedSecret(migrated, legacy));
  assert.throws(() => recoverEncryptedSecret("enc:v1:invalid", current));
  assert.equal(recoverEncryptedSecret("", current), "");
});
