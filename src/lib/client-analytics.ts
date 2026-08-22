"use client";

/**
 * 客户端 fire-and-forget 埋点（规范：wiki/Analytics-使用统计与埋点规范.md）。
 * 失败静默、不阻塞 UI；服务端 track() 内部亦保证幂等与静默。
 */
export function trackClientEvent(event: string, meta?: Record<string, unknown>): void {
  try {
    fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, meta }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // 失败静默：遥测绝不能影响主功能
  }
}
