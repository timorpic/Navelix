import { getSessionUser } from "@/lib/auth";
import { localizedJson } from "@/lib/localized-json";
import { readLogSettings } from "@/lib/logging/settings";
import { writeLog } from "@/lib/logging/events";
import { simpleRateLimit } from "@/lib/rate-limit";
export async function GET() {
  if (!await getSessionUser()) return localizedJson({ error: "未登录" }, { status: 401 });
  return localizedJson({ enabled: readLogSettings().frontendEnabled });
}
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return localizedJson({ error: "未登录" }, { status: 401 });
  if (!readLogSettings().frontendEnabled) return new Response(null, { status: 204 });
  if (!simpleRateLimit(`frontend-log:${user.id}`, 10, 60_000).allowed) return new Response(null, { status: 429 });
  const reader = req.body?.getReader();
  if (!reader) return new Response(null, { status: 400 });
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 512) { await reader.cancel(); return new Response(null, { status: 413 }); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const text = Buffer.concat(chunks).toString("utf8");
  try {
    const body = JSON.parse(text);
    if (!["render-error", "unhandled-error", "unhandled-rejection"].includes(body.code) || Object.keys(body).some(key => key !== "code")) throw new Error("Invalid report");
    writeLog({ category: "runtime", event: "frontend.error", source: "frontend", actorId: user.id, level: "error", outcome: "failed", code: body.code });
    return new Response(null, { status: 204 });
  } catch { return new Response(null, { status: 400 }); }
}
