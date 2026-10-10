"use client";

import { useCallback, useEffect, useState } from "react";
import {
  parseReportConfig,
  parseReportSaveResult,
} from "@/lib/admin-profile";

/**
 * 「个人账号与安全」Tab 的匿名遥测上报开关（隐私透明卡片）。
 *
 * 从 `admin-profile-tab.tsx`（原 1219 行）抽出 —— 该开关只有 2 个 state，
 * 但与账号安全、Telegram 配置同处一个组件。独立成 hook 后，
 * 遥测卡片可以整体条件渲染而不牵动其他两块的 state。
 */

interface UseAdminReportSettingsOptions {
  /** 仅展示 UI 提示（来自 useToast） */
  flash: (msg: string) => void;
}

export interface UseAdminReportSettingsResult {
  reportEnabled: boolean;
  reportEndpointConfigured: boolean;
  /** 切换上报开关并保存（成功文案随开关状态不同） */
  reportSave: (next: boolean) => Promise<void>;
}

export function useAdminReportSettings({
  flash,
}: UseAdminReportSettingsOptions): UseAdminReportSettingsResult {
  // ── 匿名遥测上报（隐私透明开关）──
  const [reportEnabled, setReportEnabled] = useState(true);
  const [reportEndpointConfigured, setReportEndpointConfigured] = useState(false);

  const fetchReportConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/analytics/report");
      const data = await res.json();
      const state = parseReportConfig(data);
      if (state) {
        setReportEnabled(state.enabled);
        setReportEndpointConfigured(state.endpointConfigured);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      fetchReportConfig();
    });
  }, [fetchReportConfig]);

  // 匿名遥测上报开关（隐私透明）：POST /api/admin/analytics/report { enabled }
  const reportSave = useCallback(
    async (next: boolean) => {
      try {
        const res = await fetch("/api/admin/analytics/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: next }),
        });
        const data = await res.json();
        const confirmed = parseReportSaveResult(data);
        if (res.ok && confirmed !== null) {
          setReportEnabled(confirmed);
          flash(
            next
              ? "✅ 匿名遥测已开启（仅聚合计数，不含个人信息）"
              : "已关闭匿名遥测上报",
          );
        } else {
          flash(`❌ ${data.error || "保存失败"}`);
        }
      } catch {
        flash("❌ 网络请求失败");
      }
    },
    [flash],
  );

  return { reportEnabled, reportEndpointConfigured, reportSave };
}
