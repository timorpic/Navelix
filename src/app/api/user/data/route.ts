import { NextRequest, NextResponse } from "next/server";
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

// GET /api/user/data - Fetch categories, links, and config for current logged-in user
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  // 与 SSR 路径共用同一实现（含 EE 门禁与订阅团队分类并入）。
  // 历史上此处曾逐表重写一遍查询，与 lib/user-data.ts 长期漂移。
  return NextResponse.json(getUserData(user.id));
}

// POST /api/user/data - Save full categories, links, projects, todos, or config for current user
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const userId = user.id;
  // 注：middleware.ts 已对该路由统一执行 CSRF 校验，此处为纵深防御的第二道校验。
  // checkCSRF 返回对象，必须检查 .success 属性（对象本身恒为 truthy）
  const csrfResult = checkCSRF(req);
  if (!csrfResult.success) {
    return NextResponse.json(
      { error: csrfResult.error || "CSRF 验证失败" },
      { status: csrfResult.status || 403 },
    );
  }

  try {
    const body = await req.json();
    db.exec("BEGIN IMMEDIATE");

    // 安全门禁与 Pro 商业权限管控：
    // 1. 普通用户禁止修改全局安全策略与 Pro 特权字段
    // 2. 未激活 Pro / 开源社区版（CE）环境下，服务端自动剥离 Pro 专享字段（Logo自定义、品牌定制、代码注入、网络探针），杜绝接口级篡改
    const cfg = body.config;
    if (cfg) {
      if (user.role !== "admin") {
        delete cfg.allowPublicAccess;
        delete cfg.allowRegistration;
        delete cfg.customHeadScripts;
        delete cfg.customCss;
        delete cfg.logoImage;
        delete cfg.siteTitle;
        delete cfg.logoText;
        delete cfg.linkStatusEnabled;
        delete cfg.linkStatusInterval;
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

    db.exec("COMMIT");

    // 广播实时变更通知
    if (Array.isArray(body.links)) emitUserEvent(userId, "links:change");
    if (Array.isArray(body.categories)) emitUserEvent(userId, "categories:change");
    if (Array.isArray(body.projects)) emitUserEvent(userId, "projects:change");
    if (Array.isArray(body.todos)) emitUserEvent(userId, "todos:change");

    return NextResponse.json({ success: true });
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // rollback error ignore
    }
    const message = err instanceof Error ? err.message : "保存配置失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}