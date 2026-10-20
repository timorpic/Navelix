import { writeLog } from "@/lib/logging/events";
import { withRequestLogging } from "@/lib/logging/request";
import { localizedJson } from "@/lib/localized-json";
import { sendUserTelegramNotification } from "@/lib/telegram";
import { NextRequest } from "next/server";
import { validateConfigPatch } from "@/lib/config-validation";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { checkCSRF } from "@/lib/csrf";
import {
  getUserData,
  saveUserCategories,
  saveUserLinks,
  saveUserProjects,
  saveUserTodos,
  saveUserConfigs,
} from "@/lib/user-data";
import { emitUserEvent } from "@/lib/events";
import { getProFeatureFlags } from "@/lib/ee-gate";
import { getWorkspaceRevision, requireWorkspaceRevision, WorkspaceConflictError } from "@/lib/workspace-revision";
import { GLOBAL_SCOPE_CONFIG_KEYS } from "@/lib/user-config-columns";

// GET /api/user/data - Fetch categories, links, and config for current logged-in user
async function GETHandler() {
  const user = await getSessionUser();
  if (!user) {
    return localizedJson({ error: "未登录" }, { status: 401 });
  }

  // 与 SSR 路径共用同一实现（含 EE 门禁与订阅团队分类并入）。
  // 历史上此处曾逐表重写一遍查询，与 lib/user-data.ts 长期漂移。
  return localizedJson(getUserData(user.id));
}

// POST /api/user/data - Save full categories, links, projects, todos, or config for current user
async function POSTHandler(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return localizedJson({ error: "未登录" }, { status: 401 });
  }
  const userId = user.id;
  // 注：src/proxy.ts 已对该路由统一执行 CSRF 校验，此处为纵深防御的第二道校验。
  // checkCSRF 返回对象，必须检查 .success 属性（对象本身恒为 truthy）
  const csrfResult = checkCSRF(req);
  if (!csrfResult.success) {
    return localizedJson(
      { error: csrfResult.error || "CSRF 验证失败" },
      { status: csrfResult.status || 403 },
    );
  }

  try {
    const body = await req.json();
    if (body.config !== undefined) {
      try { validateConfigPatch(body.config); }
      catch (error) { return localizedJson({ error: error instanceof Error ? error.message : "配置无效" }, { status: 400 }); }
    }
    if (body.dataTransferAction !== undefined && body.dataTransferAction !== "import") {
      return localizedJson({ error: "无效数据传输操作" }, { status: 400 });
    }
    db.exec("BEGIN IMMEDIATE");
    if ([body.categories, body.links, body.projects, body.todos].some(Array.isArray)) {
      requireWorkspaceRevision(userId, body.expectedRevision);
    }
    const subscribers = db.prepare("SELECT DISTINCT user_id FROM user_category_subscriptions WHERE owner_id = ?").all(userId);
    const assignees = db.prepare("SELECT DISTINCT COALESCE(NULLIF(assignee_id, ''), assigned_to) AS id FROM user_todos WHERE user_id = ?").all(userId);

    // 安全门禁与 Pro 商业权限管控：
    // 1. 普通用户禁止修改全局安全策略与 Pro 特权字段
    // 2. 未激活 Pro / 开源社区版（CE）环境下，服务端自动剥离 Pro 专享字段（Logo自定义、品牌定制、代码注入、网络探针），杜绝接口级篡改
    const cfg = body.config;
    if (cfg) {
      if (user.role !== "admin") {
        // 普通用户只能改个人偏好；全部全站级字段（品牌/AI/天气/社交/安全/探针/页脚/代码注入）一律剥离。
        for (const key of GLOBAL_SCOPE_CONFIG_KEYS) {
          delete cfg[key];
        }
        delete cfg.aiKeyConfigured;
        delete cfg.weatherKeyConfigured;
      } else {
        const { hasCodeInject, hasBrandCustom, hasProbes } = getProFeatureFlags();
        if (!hasCodeInject) {
          delete cfg.customHeadScripts;
          delete cfg.customCss;
        }
        if (!hasBrandCustom) {
          delete cfg.logoImage;
          delete cfg.siteTitle;
          delete cfg.logoText;
        }
        if (!hasProbes) {
          delete cfg.linkStatusEnabled;
          delete cfg.linkStatusInterval;
        }
      }
    }

    if (Array.isArray(body.categories)) {
      saveUserCategories(userId, body.categories);
    }
    if (Array.isArray(body.links)) {
      saveUserLinks(userId, body.links);
    }
    if (Array.isArray(body.projects)) {
      saveUserProjects(userId, body.projects);
    }
    if (Array.isArray(body.todos)) {
      saveUserTodos(userId, body.todos);
    }
    if (body.config) {
      saveUserConfigs(userId, body.config);
    }

    const revision = getWorkspaceRevision(userId);
    db.exec("COMMIT");
    for (const key of ["categories", "links", "projects", "todos"] as const) {
      if (Array.isArray(body[key])) writeLog({ category: key === "links" || key === "categories" ? "navigation" : "workspace",
        event: `${key}.snapshot.saved`, kind: "business", actorId: userId, details: { count: body[key].length } });
    }

    // 广播实时变更通知
    if (Array.isArray(body.links)) emitUserEvent(userId, "links:change");
    if (Array.isArray(body.categories)) emitUserEvent(userId, "categories:change");
    if (Array.isArray(body.projects)) emitUserEvent(userId, "projects:change");
    if (Array.isArray(body.todos)) emitUserEvent(userId, "todos:change");

    if (Array.isArray(body.links) || Array.isArray(body.categories)) {
      for (const subscriber of subscribers) emitUserEvent(String(subscriber.user_id), "categories:change");
    }
    if (Array.isArray(body.todos)) {
      const recipients = new Set([...assignees, ...db.prepare("SELECT DISTINCT COALESCE(NULLIF(assignee_id, ''), assigned_to) AS id FROM user_todos WHERE user_id = ?").all(userId)].map(row => String(row.id || "")));
      for (const id of recipients) if (id && id !== userId) emitUserEvent(id, "todos:change");
    }
    if (body.dataTransferAction === "import") {
      await sendUserTelegramNotification(userId, "📦 Navelix：个人 JSON 数据导入成功。", "dataTransfer");
    }
    return localizedJson({ success: true, revision });
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // rollback error ignore
    }
    if (err instanceof WorkspaceConflictError) return localizedJson({ error: err.message, code: "WORKSPACE_CONFLICT" }, { status: 409 });
    const message = err instanceof Error ? err.message : "保存配置失败";
    return localizedJson({ error: message }, { status: 500 });
  }
}
export const GET = withRequestLogging("/api/user/data", GETHandler);
export const POST = withRequestLogging("/api/user/data", POSTHandler);
