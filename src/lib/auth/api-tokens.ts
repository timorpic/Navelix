import { createHash, randomBytes } from "node:crypto";
import { db } from "../db.ts";

/**
 * 个人 API Token 的签发、列举与撤销。
 *
 * 下沉自 `api/auth/api-tokens/route.ts` —— 此前**校验**逻辑在
 * `auth/session.ts`（Bearer 头 → 查 api_tokens 表）而**管理**逻辑在路由里，
 * 同一张表的读写分散两处。集中到 auth/ 后，「Token 长什么样、怎么存、怎么查」
 * 只有一个出处。
 */

/** API Token 的明文前缀，`session.ts` 的 Bearer 校验依赖它做快速甄别。 */
export const API_TOKEN_PREFIX = "nvx_live_";

/** Token 的 SHA-256 摘要（库内只存摘要，明文仅在签发时返回一次）。 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface ApiTokenItem {
  id: string;
  name: string;
  tokenPrefix: string;
  createdAt: number;
  lastUsedAt: number | null;
}

interface ApiTokenRow {
  id: string;
  name: string;
  token_prefix: string;
  created_at: number;
  last_used_at: number | null;
}

/** 列出某用户的全部 API Token（新建在前）。 */
export function listApiTokens(userId: string): ApiTokenItem[] {
  const rows = db
    .prepare(
      `SELECT id, name, token_prefix, created_at, last_used_at
       FROM api_tokens
       WHERE user_id = ?
       ORDER BY created_at DESC`,
    )
    .all(userId) as unknown as ApiTokenRow[];

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    tokenPrefix: r.token_prefix,
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at,
  }));
}

export interface IssuedApiToken {
  /** 明文 Token —— 仅此一次返回，库内只存摘要 */
  token: string;
  tokenId: string;
  name: string;
  tokenPrefix: string;
}

/**
 * 签发一个新的个人 API Token。
 *
 * 明文格式：`nvx_live_` + 24 字节随机数的 hex（共 48 位）；
 * 展示用前缀取前 4 位与后 4 位，便于用户辨认是哪一把。
 */
export function issueApiToken(userId: string, rawName: unknown): IssuedApiToken {
  const name = String(rawName || "默认 API 密钥").trim();

  const secretPart = randomBytes(24).toString("hex");
  const token = `${API_TOKEN_PREFIX}${secretPart}`;
  const tokenPrefix = `${API_TOKEN_PREFIX}${secretPart.slice(0, 4)}...${secretPart.slice(-4)}`;
  const tokenId = `tok_${randomBytes(8).toString("hex")}`;

  db.prepare(
    `INSERT INTO api_tokens (id, user_id, name, token_hash, token_prefix, created_at, last_used_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL)`,
  ).run(tokenId, userId, name, hashToken(token), tokenPrefix, Date.now());

  return { token, tokenId, name, tokenPrefix };
}

/** 撤销指定 Token。带 user_id 条件，因此无法删除他人的 Token。 */
export function revokeApiToken(userId: string, tokenId: string): void {
  db.prepare("DELETE FROM api_tokens WHERE id = ? AND user_id = ?").run(tokenId, userId);
}
