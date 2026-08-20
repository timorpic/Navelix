"use client";

import { useEffect } from "react";

/**
 * 注册 PWA Service Worker（网络优先 + 离线核心壳）。
 * 仅在生产环境启用：开发环境 SW 会干扰 HMR 并造成旧 Turbopack chunk 模块丢失。
 * 开发环境下主动注销已存在的 Service Worker 并清理全部 Cache Storage。
 */
export function PWARegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          let wasRegistered = false;
          for (const registration of registrations) {
            registration.unregister();
            wasRegistered = true;
          }
          if ("caches" in window) {
            caches.keys().then((keys) => {
              if (keys.length > 0) {
                Promise.all(keys.map((k) => caches.delete(k))).then(() => {
                  if (wasRegistered) {
                    window.location.reload();
                  }
                });
              }
            });
          }
        });
      }
      return;
    }
    if (!("serviceWorker" in navigator) || !("caches" in window)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => {
        console.warn("[PWA] service worker registration failed:", err);
      });
  }, []);

  return null;
}