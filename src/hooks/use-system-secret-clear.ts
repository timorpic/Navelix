"use client";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useNavelixConfig } from "@/context/navelix-context";
export function useSystemSecretClear() {
  const tx = useTranslations();
  const { updateConfig } = useNavelixConfig();
  const [error, setError] = useState("");
  async function clear(key: "aiApiKey" | "weatherApiKey") {
    setError("");
    try {
      const response = await fetch("/api/admin/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [key]: null }) });
      if (!response.ok) throw new Error(tx("failed_to_clear_key_a3da004b"));
      updateConfig(key === "aiApiKey" ? { aiKeyConfigured: false } : { weatherKeyConfigured: false });
    } catch { setError(tx("failed_to_clear_key_try_again_45360f31")); }
  }
  return { clear, error };
}
