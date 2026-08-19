"use client";

import { useEffect } from "react";

/**
 * 注册 PWA Service Worker（网络优先 + 离线核心壳）。
 * 仅在生产环境启用：开发环境 SW 会干扰 HMR。
 */
export function PWARegister() {
  useEffect(() => {
    if (!process.env.NODE_ENV || process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator) || !("caches" in window)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => {
        console.warn("[PWA] service worker registration failed:", err);
      });
  }, []);

  return null;
}