import { requireAdmin } from "@/lib/auth";
import { localizedJson } from "@/lib/localized-json";
import { queryLogs } from "@/lib/logging/query";
import type { NextRequest } from "next/server";
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin(req)) return localizedJson({ error: "需要管理员权限" }, { status: 403 });
  const { id } = await context.params;
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(id)) return localizedJson({ error: "无效日志 ID" }, { status: 400 });
  const page = queryLogs({ from: 0, to: Date.now(), q: id }, 200);
  const event = page.logs.find(event => event.id === id);
  if (!event) return localizedJson({ error: page.partial ? "记录不在当前扫描范围内" : "日志不存在" }, { status: page.partial ? 409 : 404 });
  return localizedJson({ log: event });
}
