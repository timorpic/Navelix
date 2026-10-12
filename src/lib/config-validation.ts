import { USER_CONFIG_MAPPED_COLUMNS } from "./user-config-columns.ts";

/** Validate patches before starting any writes. Derived flags are accepted but never persisted. */
export function validateConfigPatch(input: unknown): asserts input is Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("配置必须是对象");
  const derived = new Set(["aiKeyConfigured", "weatherKeyConfigured"]);
  for (const [key, value] of Object.entries(input)) {
    if (derived.has(key) && typeof value === "boolean") continue;
    const col = USER_CONFIG_MAPPED_COLUMNS.find(col => col.configKey === key);
    if (!col) throw new Error(`未知配置项：${key}`);
    if (col.kind === "secret" && value === null) continue;
    const type = col.kind === "bool" ? "boolean" : col.kind === "num" ? "number" : "string";
    if (typeof value !== type) throw new Error(`配置类型错误：${key}`);
    if (typeof value === "number" && (!Number.isFinite(value) || value <= 0)) throw new Error(`配置数值无效：${key}`);
    if (key === "language" && value !== "zh-CN" && value !== "en") throw new Error("无效界面语言");
    if (key === "linkOpenTarget" && value !== "_blank" && value !== "_self") throw new Error("无效链接打开方式");
    if ((key === "aiBaseUrl" || key === "weatherApiBaseUrl") && typeof value === "string" && value) {
      let url: URL;
      try { url = new URL(value); } catch { throw new Error(`无效接口地址：${key}`); }
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error(`无效接口地址：${key}`);
    }
  }
}
