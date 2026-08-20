"use client";

import { useEffect, useRef } from "react";
import type { RealtimeEvent } from "@/lib/events";

interface RealtimeSyncOptions {
  onLinksChange?: () => void;
  onProjectsChange?: () => void;
  onTodosChange?: () => void;
  onMonitorUpdate?: () => void;
  onNotificationsNew?: () => void;
  onEvent?: (event: RealtimeEvent) => void;
  enabled?: boolean;
}

/**
 * 前端实时数据同步 Hook：连接 /api/realtime (SSE)，
 * 监听服务端变动（浏览器扩展添加书签、跨标签页操作、后台定时巡检完成等），
 * 触发局部增量静默刷新。
 */
export function useRealtimeSync(options: RealtimeSyncOptions = {}) {
  const { enabled = true } = options;

  const callbacksRef = useRef(options);
  useEffect(() => {
    callbacksRef.current = options;
  });

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let isUnmounted = false;

    function connect() {
      if (isUnmounted) return;

      try {
        eventSource = new EventSource("/api/realtime");

        eventSource.onmessage = (e) => {
          try {
            const data: RealtimeEvent = JSON.parse(e.data);
            callbacksRef.current.onEvent?.(data);

            switch (data.type) {
              case "links:change":
              case "categories:change":
                callbacksRef.current.onLinksChange?.();
                break;
              case "projects:change":
                callbacksRef.current.onProjectsChange?.();
                break;
              case "todos:change":
                callbacksRef.current.onTodosChange?.();
                break;
              case "monitor:update":
                callbacksRef.current.onMonitorUpdate?.();
                break;
              case "notifications:new":
                callbacksRef.current.onNotificationsNew?.();
                break;
            }
          } catch {
            // ignore malformed message
          }
        };

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          // 3 秒后尝试重连
          if (!isUnmounted) {
            reconnectTimeout = setTimeout(connect, 3000);
          }
        };
      } catch {
        // Fallback reconnection
        if (!isUnmounted) {
          reconnectTimeout = setTimeout(connect, 5000);
        }
      }
    }

    connect();

    return () => {
      isUnmounted = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [enabled]);
}
