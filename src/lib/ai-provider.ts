import { decryptSecret } from "./secret.ts";
import { getGlobalConfigRow } from "./global-config.ts";

/**
 * AI 供应商配置解析 —— 收敛此前在 4 个 AI 路由里各自重写一遍的逻辑
 * （读 user_configs 的 ai_* 三列、默认值、密钥解密、chat/completions URL 拼接）。
 *
 * 其中 `summarize` 的 URL 拼法曾与其他三处漂移，本模块统一为多数派写法。
 *
 * AI 配置为全站级：读取 lib/global-config.ts 的全局单例行（而非调用者各自的行），
 * 保证 admin 配置的 Key/模型对全体用户与 AI 路由一致生效。
 */

export const DEFAULT_AI_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_AI_MODEL = "gpt-4o-mini";

export interface ResolvedAIConfig {
  /** 解密后的明文 API Key；未配置时为空串（调用方据此走降级分支） */
  apiKey: string;
  /** 规范化后的 Base URL（已去除尾部斜杠） */
  baseUrl: string;
  modelName: string;
  /** 可直接 fetch 的 chat/completions 端点 */
  targetUrl: string;
}

/**
 * 读取并解析全站 AI 配置（AI 配置为全局单例）。
 *
 * 密钥在库内为 AES-256-GCM 密文，此处解密；明文绝不下发前端。
 */
export function resolveAIConfig(): ResolvedAIConfig {
  const configRow = getGlobalConfigRow() as
    | {
        ai_base_url: string;
        ai_api_key: string;
        ai_model: string;
      }
    | undefined;

  const apiKey = decryptSecret(configRow?.ai_api_key?.trim() || "");
  const baseUrl = (configRow?.ai_base_url?.trim() || DEFAULT_AI_BASE_URL).replace(
    /\/+$/,
    "",
  );
  const modelName = configRow?.ai_model?.trim() || DEFAULT_AI_MODEL;

  const targetUrl = baseUrl.endsWith("/chat/completions")
    ? baseUrl
    : `${baseUrl}/chat/completions`;

  return { apiKey, baseUrl, modelName, targetUrl };
}

/**
 * 校验 Base URL 是否为合法的 http/https 地址。
 * 返回错误文案，合法时返回 null（调用方据此组装各自的响应体）。
 */
export function validateAIBaseUrl(baseUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    return "⚠️ 后台配置的 BaseURL 格式不正确，请检查后重试。";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "⚠️ BaseURL 仅支持 http/https 协议，请检查后台配置。";
  }
  return null;
}
