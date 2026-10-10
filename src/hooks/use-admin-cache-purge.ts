"use client";

import { useCallback, useState } from "react";
import { parseCachePurgeResult, type CachePurgeTarget } from "@/lib/admin-system";

/**
 * 「系统运维与安全」Tab 的系统存储与缓存清理（块 7：🧹 缓存与系统存储清理）。
 *
 * 从 `admin-system-tab.tsx`（原 928 行）抽出 —— 三个清理按钮共用的
 * loading / 内联提示 state 原先与备份、导入导出等无关状态同处一组件。
 * 内联提示 4s 后自动消失（与重构前的 setTimeout 行为一致）。
 */
export interface UseAdminCachePurgeOptions {
  /** 展示 UI 提示并写入通知中心（来自 useToast） */
  notify: (title: string, msg: string) => void;
}

export interface UseAdminCachePurgeResult {
  isPurgingCache: boolean;
  /** 卡片内联提示（执行中 / 成功 / 失败） */
  purgeNotice: string;
  /** 执行清理：清空过期通知、VACUUM 或一键全量深度优化 */
  purgeCache: (target?: CachePurgeTarget) => Promise<void>;
}

export function useAdminCachePurge({
  notify,
}: UseAdminCachePurgeOptions): UseAdminCachePurgeResult {
  const [isPurgingCache, setIsPurgingCache] = useState(false);
  const [purgeNotice, setPurgeNotice] = useState("");

  const purgeCache = useCallback(
    async (target: CachePurgeTarget = "all") => {
      setIsPurgingCache(true);
      setPurgeNotice("正在执行系统与存储清理...");
      try {
        const res = await fetch("/api/admin/cache-purge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target }),
        });
        const data = await res.json();
        const outcome = parseCachePurgeResult(res.ok, data);
        setPurgeNotice(outcome.notice);
        if (outcome.ok) {
          notify("系统运维", outcome.message);
        }
      } catch {
        setPurgeNotice("❌ 清理失败");
      } finally {
        setIsPurgingCache(false);
        setTimeout(() => setPurgeNotice(""), 4000);
      }
    },
    [notify],
  );

  return { isPurgingCache, purgeNotice, purgeCache };
}
