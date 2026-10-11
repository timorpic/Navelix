"use client";
import { useState } from "react";
import { useNavelixConfig } from "@/context/navelix-context";
export function useSystemSecretClear() {
  const { updateConfig } = useNavelixConfig();
  const [error, setError] = useState("");
  async function clear(key: "aiApiKey" | "weatherApiKey") {
    setError("");
    try {
      const response = await fetch("/api/admin/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [key]: null }) });
      if (!response.ok) throw new Error("清除密钥失败");
      updateConfig(key === "aiApiKey" ? { aiKeyConfigured: false } : { weatherKeyConfigured: false });
    } catch { setError("清除密钥失败，请重试"); }
  }
  return { clear, error };
}
