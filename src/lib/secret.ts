import { writeLog } from "./logging/events.ts";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolveDataDir } from "./data-dir.ts";

const ALGORITHM = "aes-256-gcm";
const PREFIX = "enc:v1:";

/**
 * 获取或生成主加密密钥 (32 字节 Master Key)
 * 优先级：环境变量 APP_SECRET > data/.app_secret 机器本地密钥
 */
export function getSecretKey(): Buffer {
  if (process.env.APP_SECRET) {
    if (process.env.APP_SECRET.trim().length < 16) throw new Error("APP_SECRET 必须至少包含 16 个字符");
    return createHash("sha256").update(process.env.APP_SECRET.trim()).digest();
  }

  const secretFile = path.join(resolveDataDir(), ".app_secret");
  const readKey = () => {
    const fd = fs.openSync(secretFile, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    try {
      const info = fs.fstatSync(fd);
      if (!info.isFile() || info.size > 128) throw new Error("主密钥文件格式无效，请恢复原密钥");
      const hex = fs.readFileSync(fd, "utf8").trim();
      if (!/^[a-f0-9]{64}$/i.test(hex)) throw new Error("主密钥文件格式无效，请恢复原密钥");
      return Buffer.from(hex, "hex");
    } finally { fs.closeSync(fd); }
  };
  try {
    return readKey();
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }

  fs.mkdirSync(resolveDataDir(), { recursive: true, mode: 0o700 });
  const temporary = `${secretFile}.${randomBytes(12).toString("hex")}.tmp`;
  try {
    // Publish a complete file without replacing an existing key, including across workers.
    const fd = fs.openSync(temporary, "wx", 0o600);
    try { fs.writeFileSync(fd, randomBytes(32).toString("hex")); fs.fsyncSync(fd); }
    finally { fs.closeSync(fd); }
    try { fs.linkSync(temporary, secretFile); }
    catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
    }
    return readKey();
  } finally {
    fs.rmSync(temporary, { force: true });
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
    writeLog({ category: "security", event: "security.encryption.failed", level: "error", outcome: "failed", details: { errorName: err instanceof Error ? err.name : "UnknownError" } });
    throw new Error("加密失败，请检查系统状态");
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
    writeLog({ category: "security", event: "security.decryption.failed", level: "error", outcome: "failed", details: { errorName: err instanceof Error ? err.name : "UnknownError" } });
    return "";
  }
}
