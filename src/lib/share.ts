import { createHmac, hkdfSync } from "node:crypto";
import { db } from "./db.ts";
import { getSecretKey } from "./secret.ts";
import type { Category, SiteLink, Project } from "@/types";

/**
 * 分享 Token 专用签名密钥：从主密钥（getSecretKey）通过 HKDF 派生独立子密钥。
 * 避免直接用数据加密主密钥签名，缩小主密钥暴露面；即使分享签名被破解也无法推导主密钥。
 */
function getShareSecret(): Buffer {
  return Buffer.from(
    hkdfSync(
      "sha256",
      getSecretKey(),
      "navelix-share-token-salt-v1",
      "navelix-share-token-hmac-v1",
      32,
    ),
  );
}

export interface ShareTokenPayload {
  type: "category" | "project";
  id: string;
  userId: string;
  exp: number; // 过期时间戳（毫秒）
}

/**
 * 生成对外只读分享 Token（含 HMAC-SHA256 签名校验与过期时间）
 */
export function createShareToken(
  type: "category" | "project",
  id: string,
  userId: string,
  expireDays = 30,
): string {
  const exp = Date.now() + expireDays * 24 * 60 * 60 * 1000;
  const payloadStr = JSON.stringify({ type, id, userId, exp });
  const base64Payload = Buffer.from(payloadStr, "utf8").toString("base64url");
  const hmac = createHmac("sha256", getShareSecret()).update(base64Payload).digest("hex");
  return `${base64Payload}.${hmac}`;
}

/**
 * 校验分享 Token
 */
export function verifyShareToken(token: string): {
  valid: boolean;
  payload?: ShareTokenPayload;
  error?: string;
} {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return { valid: false, error: "无效的分享凭证" };
  }

  const [base64Payload, signature] = token.split(".");
  if (!base64Payload || !signature) {
    return { valid: false, error: "分享凭证格式错误" };
  }

  const expectedHmac = createHmac("sha256", getShareSecret())
    .update(base64Payload)
    .digest("hex");

  if (expectedHmac !== signature) {
    return { valid: false, error: "凭证签名校验失败或已被篡改" };
  }

  try {
    const raw = Buffer.from(base64Payload, "base64url").toString("utf8");
    const payload = JSON.parse(raw) as ShareTokenPayload;

    if (Date.now() > payload.exp) {
      return { valid: false, error: "分享链接已过期" };
    }

    return { valid: true, payload };
  } catch {
    return { valid: false, error: "解析分享内容失败" };
  }
}

/**
 * 获取公开分享的分类及书签数据
 */
export function getSharedCategoryData(
  categoryId: string,
  userId: string,
): { category: Category; links: SiteLink[]; ownerName: string } | null {
  const catRow = db
    .prepare("SELECT id, name, label, icon, color FROM user_categories WHERE id = ? AND user_id = ?")
    .get(categoryId, userId) as unknown as Category | undefined;

  if (!catRow) return null;

  const links = db
    .prepare(
      `SELECT id, title, url, description, icon, category, is_quick_access AS isQuickAccess
       FROM user_links WHERE user_id = ? AND category = ? ORDER BY is_quick_access DESC, title ASC`,
    )
    .all(userId, categoryId) as unknown as SiteLink[];

  const userRow = db
    .prepare("SELECT display_name, username FROM users WHERE id = ?")
    .get(userId) as { display_name?: string; username: string } | undefined;

  const ownerName = userRow?.display_name || userRow?.username || "Navelix 用户";

  return { category: catRow, links, ownerName };
}

/**
 * 获取公开分享的项目数据
 */
export function getSharedProjectData(
  projectId: string,
  userId: string,
): { project: Project; ownerName: string } | null {
  const projRow = db
    .prepare(
      `SELECT id, name, status, status_color AS statusColor, url, sort_order AS sortOrder
       FROM projects WHERE id = ? AND user_id = ?`,
    )
    .get(projectId, userId) as unknown as Project | undefined;

  if (!projRow) return null;

  const userRow = db
    .prepare("SELECT display_name, username FROM users WHERE id = ?")
    .get(userId) as { display_name?: string; username: string } | undefined;

  const ownerName = userRow?.display_name || userRow?.username || "Navelix 用户";

  return { project: projRow, ownerName };
}
