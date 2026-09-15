"use client";

import { useEffect } from "react";

const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * 仅在页面可见时续期，iPad/Safari 从后台恢复时也会立即续期。
 * 服务端会限制会话从首次登录起最多存续 30 天。
 */
export function SessionKeepalive() {
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      void fetch("/api/auth/refresh", { method: "POST" }).catch(() => {
        // 未登录、离线或网络临时失败均不打断当前页面；下次可见/定时再尝试。
      });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };

    refresh();
    document.addEventListener("visibilitychange", onVisibilityChange);
    const interval = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
