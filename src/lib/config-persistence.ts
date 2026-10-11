import type { SystemConfig } from "@/types";

/** Secrets may be submitted in a patch but never retained in browser state/cache. */
export function configForBrowser(config: Partial<SystemConfig>): Partial<SystemConfig> {
  const safe = { ...config };
  if (safe.aiApiKey?.trim()) safe.aiKeyConfigured = true;
  if (safe.weatherApiKey?.trim()) safe.weatherKeyConfigured = true;
  delete safe.aiApiKey;
  delete safe.weatherApiKey;
  return safe;
}
