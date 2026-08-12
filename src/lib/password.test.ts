import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword, generateStrongPassword } from "./password.ts";

void describe("password", () => {
  void it("hashPassword returns salt:hash format", () => {
    const result = hashPassword("test123");
    const parts = result.split(":");
    assert.equal(parts.length, 2);
    assert.equal(parts[0].length, 32);
    assert.equal(parts[1].length, 128);
  });

  void it("verifyPassword returns true for correct password", () => {
    const hash = hashPassword("myPassword1!");
    assert.equal(verifyPassword("myPassword1!", hash), true);
  });

  void it("verifyPassword returns false for wrong password", () => {
    const hash = hashPassword("correctPassword");
    assert.equal(verifyPassword("wrongPassword", hash), false);
  });

  void it("verifyPassword returns false for invalid stored format", () => {
    assert.equal(verifyPassword("anything", "invalidformat"), false);
    assert.equal(verifyPassword("anything", "onlysalt:"), false);
  });

  void it("different salts produce different hashes for same password", () => {
    const hash1 = hashPassword("samePassword");
    const hash2 = hashPassword("samePassword");
    assert.notEqual(hash1, hash2);
  });

  void it("generateStrongPassword returns 16 characters", () => {
    const pwd = generateStrongPassword();
    assert.equal(pwd.length, 16);
  });

  void it("generateStrongPassword produces different passwords each time", () => {
    const pwd1 = generateStrongPassword();
    const pwd2 = generateStrongPassword();
    assert.notEqual(pwd1, pwd2);
  });
});
