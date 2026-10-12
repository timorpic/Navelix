"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

interface StatusTarget { id: string; username: string; disabled: boolean }

export function useAdminUserStatus({ onUpdated, flash }: {
  onUpdated: () => Promise<void>;
  flash: (message: string) => void;
}) {
  const tx = useTranslations();
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
          ? result.error : tx("operation_failed_0c3b4cf7");
        flash(error);
        return;
      }
      flash(tx("message_679d1ca5b5cc", {v0: target.username, v1: target.disabled ? tx("enable_f4f0ead1") : tx("disable_4e6fd0e2")}));
      await onUpdated();
    } catch {
      flash(tx("network_request_failed_try_again_887f6067"));
    } finally {
      inFlight.current = false;
      setSaving(false);
      setTarget(null);
    }
  };

  return { target, setTarget, saving, confirm };
}
