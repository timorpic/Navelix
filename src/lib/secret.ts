import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ALGORITHM = "aes-256-gcm";
const PREFIX = "enc:v1:";

/**
 * 获取或生成主加密密钥 (32 字节 Master Key)
 * 优先级：环境变量 APP_SECRET > data/.app_secret 机器本地密钥
 */
function getSecretKey(): Buffer {
  if (process.env.APP_SECRET && process.env.APP_SECRET.trim().length >= 16) {
    return createHash("sha256").update(process.env.APP_SECRET.trim()).digest();
  }

  const secretFile = path.join(process.cwd(), "data", ".app_secret");
  try {
    if (fs.existsSync(secretFile)) {
      const hex = fs.readFileSync(secretFile, "utf8").trim();
      if (hex.length === 64) {
        return Buffer.from(hex, "hex");
      }
    }
    const generated = randomBytes(32);
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    }
    fs.writeFileSync(secretFile, generated.toString("hex"), { mode: 0o600 });
    return generated;
  } catch {
    return createHash("sha256").update("navelix-embedded-master-secret-fallback").digest();
  }
}

/**
 * 使用 AES-256-GCM 加密敏感字符串（如 API 密钥、第三方凭据）
 * 格式：enc:v1:<iv_hex>:<auth_tag_hex>:<ciphertext_hex>
 */
export function encryptSecret(plainText: string): string {
  if (!plainText || typeof plainText !== "string") return "";
  const trimmed = plainText.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith(PREFIX)) return trimmed; // 已经是加密密文，无需重复加密

  try {
    const key = getSecretKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(trimmed, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");
    return `${PREFIX}${iv.toString("hex")}:${authTag}:${encrypted}`;
  } catch (err) {
    console.error("[Navelix Secret] Encrypt failed:", err);
    return plainText;
  }
}

/**
 * 解密 AES-256-GCM 密文（自动向后兼容旧版未加密的明文字符串）
 */
export function decryptSecret(cipherText: string): string {
  if (!cipherText || typeof cipherText !== "string") return "";
  const trimmed = cipherText.trim();
  if (!trimmed) return "";
  if (!trimmed.startsWith(PREFIX)) return trimmed; // 未加密明文直接返回，实现平滑向后兼容

  try {
    const parts = trimmed.slice(PREFIX.length).split(":");
    if (parts.length !== 3) return trimmed;
    const [ivHex, authTagHex, encryptedHex] = parts;
    const key = getSecretKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    console.error("[Navelix Secret] Decrypt failed, returning empty string:", err);
    return "";
  }
}
