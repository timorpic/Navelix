import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/** Offline recovery only: require authenticated decryption before accepting or re-encrypting data. */
export function recoverEncryptedSecret(value: string, currentKey: Buffer, legacyKey?: Buffer): string {
  if (!value.startsWith("enc:v1:")) return value;
  const match = /^enc:v1:([a-f0-9]{24}):([a-f0-9]{32}):([a-f0-9]*)$/i.exec(value);
  if (!match) throw new Error("Invalid encrypted secret");
  const decrypt = (key: Buffer) => {
    const cipher = createDecipheriv("aes-256-gcm", key, Buffer.from(match[1], "hex"));
    cipher.setAuthTag(Buffer.from(match[2], "hex"));
    return Buffer.concat([cipher.update(Buffer.from(match[3], "hex")), cipher.final()]);
  };
  try { decrypt(currentKey); return value; }
  catch {
    if (!legacyKey) throw new Error("Secret verification failed; restore the original master key");
    const plaintext = decrypt(legacyKey);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", currentKey, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return `enc:v1:${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${encrypted.toString("hex")}`;
  }
}
