import crypto from "node:crypto";

/**
 * 默认授权签名秘钥（生产环境建议通过 .env 中的 LICENSE_SECRET_KEY 覆盖）
 */
const LICENSE_SECRET = process.env.LICENSE_SECRET_KEY || "navelix-open-source-pro-license-secret-2026";

/**
 * 校验 PRO 授权码（开源合规模式）
 *
 * 验证规则（优先级由高到低）：
 * 1. .env 环境变量显式开启：ENABLE_COMMUNITY_PRO=true （方便开源自建者无缝开启 PRO）
 * 2. .env 环境变量匹配：用户输入的 Key === process.env.PRO_LICENSE_KEY
 * 3. 密码学签名校验：格式 NAVPRO-<IDENTIFIER>-<HMAC_SHA256>
 */
export function verifyProLicenseKey(licenseKey: string): { valid: boolean; message: string } {
  const key = (licenseKey || "").trim();

  // 1. 社区自建无缝模式：若 .env 中配置了 ENABLE_COMMUNITY_PRO=true
  if (process.env.ENABLE_COMMUNITY_PRO === "true") {
    return { valid: true, message: "开源社区模式：已通过 .env 中的 ENABLE_COMMUNITY_PRO 自动授权" };
  }

  // 2. 环境变量固定 Key 校验
  const envKey = process.env.PRO_LICENSE_KEY;
  if (envKey && envKey.trim() !== "" && key === envKey.trim()) {
    return { valid: true, message: "成功通过服务端 .env 配置的 PRO_LICENSE_KEY 授权校验！" };
  }

  // 3. 通用免密社区激活码（开源公开测试码）
  if (key.toUpperCase() === "NAV-PRO-2026" || key.toUpperCase() === "PRO-COMMUNITY") {
    return { valid: true, message: "成功通过开源社区通用授权码激活！" };
  }

  // 4. HMAC-SHA256 密码学签名校验 (格式: NAVPRO-<USER>-<8位或16位签名>)
  if (/^NAVPRO-[A-Z0-9_-]+-[A-F0-9]{8,64}$/i.test(key)) {
    const parts = key.split("-");
    const identifier = parts[1];
    const signature = parts[2].toUpperCase();

    const expectedHash = crypto
      .createHmac("sha256", LICENSE_SECRET)
      .update(identifier.toUpperCase())
      .digest("hex")
      .substring(0, signature.length)
      .toUpperCase();

    if (signature === expectedHash) {
      return { valid: true, message: `成功验证包含身份标识 [${identifier}] 的数字签名授权！` };
    }
  }

  return {
    valid: false,
    message: "授权密钥无效或已被篡改！请提供有效的激活码，或在 .env 中设置 ENABLE_COMMUNITY_PRO=true",
  };
}

/**
 * 为指定标识生成合法 HMAC 授权码（方便管理员/开发者分发密钥）
 */
export function generateProLicenseKey(identifier: string): string {
  const cleanId = identifier.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_") || "USER";
  const signature = crypto
    .createHmac("sha256", LICENSE_SECRET)
    .update(cleanId)
    .digest("hex")
    .substring(0, 16)
    .toUpperCase();
  return `NAVPRO-${cleanId}-${signature}`;
}
