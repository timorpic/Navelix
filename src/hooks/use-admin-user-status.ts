"use client";

import { useRef, useState } from "react";

interface StatusTarget { id: string; username: string; disabled: boolean }

export function useAdminUserStatus({ onUpdated, flash }: {
  onUpdated: () => Promise<void>;
  flash: (message: string) => void;
}) {
  const [target, setTarget] = useState<StatusTarget | null>(null);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);

  const confirm = async () => {
    if (!target || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: target.id, disabled: !target.disabled }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const error = result && typeof result === "object" && "error" in result && typeof result.error === "string"
          ? result.error : "操作失败";
        flash(error);
        return;
      }
      flash(`账号 @${target.username} 已${target.disabled ? "启用" : "停用"}`);
      await onUpdated();
    } catch {
      flash("网络请求失败，请重试");
    } finally {
      inFlight.current = false;
      setSaving(false);
      setTarget(null);
    }
  };

  return { target, setTarget, saving, confirm };
}
