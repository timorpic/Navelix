import { withRequestLogging } from "@/lib/logging/request";
import { localizedJson } from "@/lib/localized-json";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { createProject } from "@/lib/todos-projects";

async function GETHandler() {
  const user = await getSessionUser();
  if (!user) return localizedJson({ error: "未登录" }, { status: 401 });
  const userId = user.id;
  const rows = db
    .prepare(
      `SELECT id, name, description, status, status_color, url, sort_order, created_at, updated_at 
       FROM projects 
       WHERE user_id = ? 
       ORDER BY sort_order ASC, created_at DESC`,
    )
    .all(userId) as {
    id: string;
    name: string;
    description: string;
    status: string;
    status_color: string;
    url: string;
    sort_order: number;
    created_at: number;
    updated_at: number;
  }[];
  return localizedJson({
    projects: rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description || "",
      status: r.status || "进行中",
      color: r.status_color || "#00C776",
      statusColor: r.status_color || "#00C776",
      url: r.url || "",
      sortOrder: r.sort_order,
      createdAt: r.created_at || 0,
      updatedAt: r.updated_at || r.created_at || 0,
    })),
  });
}

async function POSTHandler(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return localizedJson({ error: "未登录" }, { status: 401 });
  const userId = user.id;
  try {
    const body = await req.json();
    const name = String(body.name || "").trim();
    if (!name) {
      return localizedJson({ error: "项目名不能为空" }, { status: 400 });
    }

    const project = createProject(userId, {
      name,
      description: body.description,
      status: body.status,
      color: body.color,
      statusColor: body.statusColor,
      url: body.url,
      todos: Array.isArray(body.todos) ? body.todos : undefined,
    });

    return localizedJson({ success: true, project });
  } catch (err) {
    return localizedJson(
      { error: err instanceof Error ? err.message : "创建失败" },
      { status: 500 },
    );
  }
}

export const GET = withRequestLogging("/api/projects", GETHandler);
export const POST = withRequestLogging("/api/projects", POSTHandler);
