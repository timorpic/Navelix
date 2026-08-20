import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { eventBus, type RealtimeEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return new Response(JSON.stringify({ error: "未登录" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // 1. 发送建立连接确认事件
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ userId: user.id, time: Date.now() })}\n\n`),
      );

      // 2. 监听针对该用户的事件
      const onUserEvent = (evt: RealtimeEvent) => {
        try {
          controller.enqueue(
            encoder.encode(`event: message\ndata: ${JSON.stringify(evt)}\n\n`),
          );
        } catch {
          // 客户端已断开
        }
      };

      const eventKey = `user:${user.id}`;
      eventBus.on(eventKey, onUserEvent);

      // 3. 定时心跳，防止网关/代理（Nginx / Cloudflare / Caddy）长连接超时
      const keepAliveTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(":keepalive\n\n"));
        } catch {
          // 客户端已断开
          clearInterval(keepAliveTimer);
        }
      }, 25_000);

      cleanup = () => {
        eventBus.off(eventKey, onUserEvent);
        clearInterval(keepAliveTimer);
      };
    },
    cancel() {
      if (cleanup) cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // 禁用 Nginx 缓冲
    },
  });
}
