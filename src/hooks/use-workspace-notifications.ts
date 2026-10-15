"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchNotificationFeed, markAllNotificationsRead } from "@/lib/client/notifications";
import type { WorkspaceNotificationFeed } from "@/lib/workspace-notifications";

const EMPTY: WorkspaceNotificationFeed = { notifications: [], unreadCount: 0 };

export function useWorkspaceNotifications(userId?: string) {
  const [state, setState] = useState({ userId, data: EMPTY, loading: true, error: false });
  const [markingRead, setMarkingRead] = useState(false);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    try {
      const data = await (userId ? fetchNotificationFeed(controller.signal) : Promise.resolve(EMPTY));
      if (!controller.signal.aborted && mounted.current) setState({ userId, data, loading: false, error: false });
    } catch {
      if (!controller.signal.aborted && mounted.current) setState(current => ({ userId, data: current.userId === userId ? current.data : EMPTY, loading: false, error: true }));
    }
  }, [userId]);
  useEffect(() => {
    mounted.current = true;
    queueMicrotask(() => { if (mounted.current) void refresh(); });
    const visibleRefresh = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("navelix-workspace-updated", visibleRefresh);
    window.addEventListener("navelix-notifications-updated", visibleRefresh);
    document.addEventListener("visibilitychange", visibleRefresh);
    const timer = window.setInterval(visibleRefresh, 60_000);
    return () => {
      mounted.current = false;
      request.current?.abort();
      clearInterval(timer);
      window.removeEventListener("navelix-workspace-updated", visibleRefresh);
      window.removeEventListener("navelix-notifications-updated", visibleRefresh);
      document.removeEventListener("visibilitychange", visibleRefresh);
    };
  }, [refresh]);
  const markAllRead = async () => {
    if (markingRead) return;
    setMarkingRead(true);
    try { await markAllNotificationsRead(); }
    catch { if (mounted.current) setState(current => ({ ...current, error: true })); }
    finally { if (mounted.current) setMarkingRead(false); }
  };
  const current = state.userId === userId ? state : { data: EMPTY, loading: true, error: false };
  return { ...current.data, loading: current.loading, error: current.error, refresh, markAllRead, markingRead };
}
export type WorkspaceNotificationsState = ReturnType<typeof useWorkspaceNotifications>;
