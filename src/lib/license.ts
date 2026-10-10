import crypto from "node:crypto";
import { db } from "./db.ts";
import { getMachineFingerprint } from "./fingerprint.ts";
import { getOfficialEELicenseKey, isEEAvailable } from "./ee-bridge/index.ts";
// 公钥常量本体在零依赖模块中：ee/index.ts 必须从这里取，原因见该文件顶部注释。
// 此处 re-export 以保持既有导入路径（`../license.ts`）不变。
import { OFFICIAL_PUBLIC_KEY as PUBLIC_KEY } from "./license-public-key.ts";

export { OFFICIAL_PUBLIC_KEY } from "./license-public-key.ts";

export interface LicensePayload {
  licenseId: string;
  customer: string;
  email: string;
  plan: "pro_lifetime" | "pro_annual" | "team_enterprise";
  features: string[]; // e.g. ["brand_customization", "custom_code_injection", "s3_backup", "all"]
  issuedAt: number;
  expiresAt: number; // 0 表示终身买断永久有效 (Lifetime)
  maxSeats?: number;
  fingerprint?: string; // 绑定的机器/安装指纹 (可选，"*" 或留空表示不限制指纹)
}

export interface LicenseVerificationResult {
  valid: boolean;
  payload?: LicensePayload;
  error?: string;
}

/**
 * 获取当前使用的验签公钥
 * 优先从 EE 商业驱动注入获取，默认回退至官方硬编码公钥（杜绝任何环境变量注入篡改）
 */
export function getPublicKey(): string {
  const eeKey = getOfficialEELicenseKey();
  if (eeKey && eeKey.trim().includes("PUBLIC KEY")) {
    return eeKey.trim();
  }
  return PUBLIC_KEY;
}

/**
 * 验签结果缓存 —— 仅缓存**成功**的验签。
 *
 * 动机：`getUserData()` 每次 SSR 渲染都会走门禁 → canAccessFeature → getLicenseStatus
 * → verifyLicenseKey，而 Ed25519 验签是纯 CPU 开销。这里缓存有效令牌的验签结果，
 * 因为验签是 token 的纯函数，无需任何失效逻辑。
 *
 * 只缓存成功结果有两个好处：
 * 1. 正常实例只有一个有效 token，缓存天然有界；
 * 2. 攻击者伪造的大量无效 token 不会被写入，避免缓存膨胀。
 */
const VERIFIED_TOKEN_CACHE = new Map<string, LicensePayload>();
const VERIFIED_TOKEN_CACHE_MAX = 8;

function verifyLicenseKeyUncached(token: string): LicenseVerificationResult {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return { valid: false, error: "许可证格式无效（必须包含有效签名载荷）" };
  }

  const parts = token.trim().split(".");
  if (parts.length !== 2) {
    return { valid: false, error: "许可证凭证结构损坏" };
  }

  const [payloadBase64, signatureBase64] = parts;
  if (!payloadBase64 || !signatureBase64) {
    return { valid: false, error: "许可证签名或数据段缺失" };
  }

  let payloadStr = "";
  let payload: LicensePayload;
  try {
    payloadStr = Buffer.from(payloadBase64, "base64url").toString("utf8");
    payload = JSON.parse(payloadStr) as LicensePayload;
  } catch {
    return { valid: false, error: "解析许可证元数据失败" };
  }

  // 1. 字段完整性校验
  if (!payload.licenseId || !payload.customer || !payload.plan) {
    return { valid: false, error: "许可证缺少必要的核心属性" };
  }

  // 2. 过期时间检查 (expiresAt > 0 时校验)
  if (payload.expiresAt > 0 && Date.now() > payload.expiresAt) {
    return {
      valid: false,
      payload,
      error: `许可证已于 ${new Date(payload.expiresAt).toLocaleDateString()} 到期`,
    };
  }

  // 3. 机器安装指纹绑定校验 (如果 License 显式指定了 fingerprint 且非 "*")
  if (
    payload.fingerprint &&
    payload.fingerprint !== "*" &&
    payload.fingerprint.trim() !== ""
  ) {
    const currentFingerprint = getMachineFingerprint();
    if (payload.fingerprint.trim().toUpperCase() !== currentFingerprint.trim().toUpperCase()) {
      return {
        valid: false,
        payload,
        error: `该许可证仅限绑定的实例使用 (授权指纹: ${payload.fingerprint}，当前本机指纹: ${currentFingerprint})`,
      };
    }
  }

  // 4. 非对称密码学签名校验 (Ed25519)
  try {
    const pubKey = getPublicKey();
    const signature = Buffer.from(signatureBase64, "base64url");
    const data = Buffer.from(payloadStr, "utf8");

    const isVerified = crypto.verify(null, data, pubKey, signature);
    if (!isVerified) {
      return { valid: false, payload, error: "数字签名无效或已被篡改" };
    }

    return { valid: true, payload };
  } catch (err) {
    return {
      valid: false,
      payload,
      error: `签名校验异常: ${err instanceof Error ? err.message : "未知错误"}`,
    };
  }
}

/**
 * 校验并解析 License Token
 * 格式：<base64url(payload)>.<base64url(signature)>
 */
export function verifyLicenseKey(
  token: string,
): LicenseVerificationResult {
  const cached = VERIFIED_TOKEN_CACHE.get(token);
  if (cached) {
    // 缓存命中也必须复检到期时间：年费授权可能在进程存活期间到期。
    // 指纹校验无需复检（进程存活期内不会变化）。
    if (cached.expiresAt > 0 && Date.now() > cached.expiresAt) {
      VERIFIED_TOKEN_CACHE.delete(token);
      return {
        valid: false,
        payload: cached,
        error: `许可证已于 ${new Date(cached.expiresAt).toLocaleDateString()} 到期`,
      };
    }
    return { valid: true, payload: cached };
  }

  const res = verifyLicenseKeyUncached(token);

  if (res.valid && res.payload) {
    if (VERIFIED_TOKEN_CACHE.size >= VERIFIED_TOKEN_CACHE_MAX) {
      const oldest = VERIFIED_TOKEN_CACHE.keys().next().value;
      if (oldest !== undefined) VERIFIED_TOKEN_CACHE.delete(oldest);
    }
    VERIFIED_TOKEN_CACHE.set(token, res.payload);
  }

  return res;
}

/**
 * 获取当前系统中存储的 License Key
 * 优先级：环境变量 NAVELIX_LICENSE_KEY > 数据库 system_settings (key = 'license_key')
 */
export function getStoredLicenseKey(): string {
  if (process.env.NAVELIX_LICENSE_KEY && process.env.NAVELIX_LICENSE_KEY.trim()) {
    return process.env.NAVELIX_LICENSE_KEY.trim();
  }

  try {
    const row = db
      .prepare("SELECT value FROM system_settings WHERE key = 'license_key'")
      .get() as { value: string } | undefined;
    return row?.value?.trim() || "";
  } catch {
    return "";
  }
}

/**
 * 获取当前系统的 Pro / Enterprise 激活状态与 License 详情
 */
export function getLicenseStatus(): {
  isPro: boolean;
  isEE: boolean;
  payload?: LicensePayload;
  error?: string;
  source?: "env" | "database" | "none";
} {
  const isEE = isEEAvailable();
  const token = getStoredLicenseKey();
  if (!token) {
    return { isPro: false, isEE, source: "none" };
  }

  const res = verifyLicenseKey(token);
  const source = process.env.NAVELIX_LICENSE_KEY ? "env" : "database";

  if (!res.valid) {
    return { isPro: false, isEE, payload: res.payload, error: res.error, source };
  }

  return { isPro: true, isEE, payload: res.payload, source };
}

/**
 * 校验当前 License 是否有权访问某项特定特性
 * @param featureName 特性标识，如 "brand_customization", "custom_code_injection", "s3_backup"
 */
export function canAccessFeature(featureName: string): boolean {
  const status = getLicenseStatus();
  if (!status.isPro || !status.payload) {
    return false;
  }

  const { features, plan } = status.payload;
  if (!Array.isArray(features)) {
    return false;
  }

  // 终身版 / 企业版包含通配符或包含此特性
  if (
    features.includes("*") ||
    features.includes("all") ||
    features.includes(featureName) ||
    plan === "team_enterprise"
  ) {
    return true;
  }

  return false;
}

/**
 * 保存新的 License Key 到数据库
 */
export function saveLicenseKey(key: string): LicenseVerificationResult {
  const trimmed = key.trim();
  const res = verifyLicenseKey(trimmed);
  if (!res.valid) {
    return res;
  }

  db.prepare(`
    INSERT INTO system_settings (key, value, updated_at)
    VALUES ('license_key', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(trimmed, Date.now());

  return res;
}

/**
 * 移除当前系统中存储的 License Key
 */
export function removeLicenseKey(): void {
  db.prepare("DELETE FROM system_settings WHERE key = 'license_key'").run();
}
