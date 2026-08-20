export const CONFIG_KEY = "navelix_config";
export const CONFIG_DEFAULT = { baseUrl: "", token: "" };

export async function getConfig() {
  const stored = await chrome.storage.sync.get(CONFIG_KEY);
  return { ...CONFIG_DEFAULT, ...(stored[CONFIG_KEY] || {}) };
}

export async function saveConfig(cfg) {
  await chrome.storage.sync.set({ [CONFIG_KEY]: { ...CONFIG_DEFAULT, ...cfg } });
}

export function baseUrlOf(baseUrl) {
  return String(baseUrl || "").trim().replace(/\/+$/, "");
}

export async function apiCall(path, opts = {}) {
  const cfg = await getConfig();
  const base = baseUrlOf(cfg.baseUrl);
  if (!base) throw new Error("未配置 Navelix 地址，请先在扩展设置中填写");
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (cfg.token) headers.Authorization = "Bearer " + cfg.token;
  const res = await fetch(base + path, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `请求失败 (HTTP ${res.status})`);
  }
  return data;
}

/** 保存单条书签（后端幂等去重） */
export async function saveBookmark(link) {
  const data = await apiCall("/api/links", {
    method: "POST",
    body: JSON.stringify(link),
  });
  return data;
}