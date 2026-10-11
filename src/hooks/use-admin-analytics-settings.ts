"use client";
import { useEffect, useState } from "react";
export function useAdminAnalyticsSettings() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    fetch("/api/admin/analytics/settings").then(async response => {
      if (!response.ok) throw new Error("读取使用统计设置失败");
      const data = await response.json(); setEnabled(data.enabled === true);
    }).catch(error => setError(error.message));
  }, []);
  async function toggle() {
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/admin/analytics/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !enabled }) });
      if (!response.ok) throw new Error("保存使用统计设置失败");
      const data = await response.json(); setEnabled(data.enabled === true);
    } catch (error) { setError(error instanceof Error ? error.message : "保存失败"); }
    finally { setSaving(false); }
  }
  return { enabled, error, saving, toggle };
}
