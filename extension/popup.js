import { getConfig, saveConfig, apiCall, saveBookmark } from "./common.js";

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const setUse = (iconEl, name) => iconEl.querySelector("use").setAttribute("href", "#" + name);

// ── 按钮三态（loading / done / reset） ──
function setBtnLoading(btnId, iconId, labelId, text) {
  const btn = $(btnId), icon = $(iconId);
  btn.disabled = true;
  btn.setAttribute("data-loading", "1");
  icon.classList.add("spinner");
  setUse(icon, "i-spinner");
  $(labelId).textContent = text;
}
function setBtnDone(btnId, iconId, labelId, text) {
  const icon = $(iconId);
  icon.classList.remove("spinner");
  setUse(icon, "i-check");
  $(labelId).textContent = text;
  $(btnId).setAttribute("data-done", "1");
}
function setBtnReset(btnId, iconId, labelId, text, idleIcon) {
  const btn = $(btnId), icon = $(iconId);
  btn.disabled = false;
  btn.removeAttribute("data-loading");
  btn.removeAttribute("data-done");
  icon.classList.remove("spinner");
  setUse(icon, idleIcon || "i-plus");
  $(labelId).textContent = text;
}

// ── 状态消息 ──
const MSG_ICON = { ok: "i-check", err: "i-alert-circle", warn: "i-alert", info: "i-info" };
function setStatus(elId, type, title, desc) {
  const el = $(elId);
  el.className = "msg " + type;
  el.innerHTML = `<svg class="ic"><use href="#${MSG_ICON[type]}" /></svg><div><b>${esc(title)}</b>${desc ? `<span>${esc(desc)}</span>` : ""}</div>`;
  el.classList.add("on");
}
function clearStatus(elId) {
  const el = $(elId);
  el.className = "msg";
  el.innerHTML = "";
  el.classList.remove("on");
}

// ── Toast ──
let toastTimer;
function toast(type, title, desc) {
  const t = $("toast");
  t.className = "toast " + type;
  t.innerHTML = `<svg class="ic"><use href="#${MSG_ICON[type]}" /></svg><div><b>${esc(title)}</b>${desc ? `<span>${esc(desc)}</span>` : ""}</div>`;
  requestAnimationFrame(() => t.classList.add("on"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), 2600);
}

// ── Tab ──
const tabs = { save: $("tabSave"), settings: $("tabSettings") };
const views = { save: $("viewSave"), settings: $("viewSettings") };
function showView(name) {
  Object.entries(tabs).forEach(([k, el]) => el.classList.toggle("active", k === name));
  Object.entries(views).forEach(([k, el]) => el.classList.toggle("active", k === name));
  if (name === "save") loadSaveView();
  if (name === "settings") loadSettingsView();
}
tabs.save.addEventListener("click", () => showView("save"));
tabs.settings.addEventListener("click", () => showView("settings"));

// ── 收藏视图 ──
async function prefillFromActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url && /^https?:\/\//i.test(tab.url)) {
      $("url").value = tab.url;
      $("title").value = tab.title || "";
    } else {
      $("url").value = "";
      $("title").value = "";
    }
  } catch {
    $("url").value = "";
    $("title").value = "";
  }
}

async function loadSaveView() {
  const cfg = await getConfig();
  if (!cfg.baseUrl) {
    $("needConfig").hidden = false;
    $("saveBtn").disabled = true;
    return;
  }
  $("needConfig").hidden = true;
  $("saveBtn").disabled = false;

  if (!$("url").value) await prefillFromActiveTab();

  try {
    const data = await apiCall("/api/links");
    const cats = data.categories || [];
    $("category").innerHTML = "";
    for (const c of cats) {
      const opt = document.createElement("option");
      opt.value = c.id || c.name;
      opt.textContent = c.name || c.label || c.id;
      $("category").appendChild(opt);
    }
  } catch {
    $("category").innerHTML = `<option value="favorites">未分类</option>`;
  }
}

$("saveBtn").addEventListener("click", async () => {
  const url = $("url").value.trim();
  const title = $("title").value.trim();
  if (!url) {
    setStatus("status", "err", "网址为空", "请输入要收藏的网址。");
    return;
  }
  clearStatus("status");
  setBtnLoading("saveBtn", "saveIcon", "saveLabel", "收藏中…");
  try {
    const result = await saveBookmark({ title, url, category: $("category").value });
    const catName = $("category").selectedOptions[0]?.textContent || "";
    const suffix = catName ? `已保存到「${catName}」` : "已保存到你的书签库";
    if (result.duplicate) {
      setBtnDone("saveBtn", "saveIcon", "saveLabel", "已收藏");
      setStatus("status", "info", "该网址已收藏过", "未重复添加。");
      toast("info", "已收藏过", suffix);
    } else {
      setBtnDone("saveBtn", "saveIcon", "saveLabel", "已收藏");
      setStatus("status", "ok", "已收藏", suffix);
      toast("ok", "收藏成功", suffix);
    }
    window.setTimeout(() => window.close(), 1000);
  } catch (err) {
    setBtnReset("saveBtn", "saveIcon", "saveLabel", "收藏");
    setStatus("status", "err", "收藏失败", err instanceof Error ? err.message : String(err));
  }
});

// ── 设置视图 ──
async function loadSettingsView() {
  const cfg = await getConfig();
  $("baseUrl").value = cfg.baseUrl || "";
  $("token").value = cfg.token || "";
  clearStatus("settingsStatus");
}

$("togglePw").addEventListener("click", () => {
  const input = $("token");
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  setUse($("eyeIcon"), show ? "i-eye-off" : "i-eye");
});

$("saveCfgBtn").addEventListener("click", async () => {
  const baseUrl = $("baseUrl").value.trim();
  const token = $("token").value.trim();
  if (!baseUrl) {
    setStatus("settingsStatus", "err", "请填写实例地址", "需要 Navelix 服务地址才能保存配置。");
    return;
  }
  clearStatus("settingsStatus");
  setBtnLoading("saveCfgBtn", "saveCfgIcon", "saveCfgLabel", "保存中…");
  try {
    await saveConfig({ baseUrl, token });
    setBtnDone("saveCfgBtn", "saveCfgIcon", "saveCfgLabel", "已保存");
    toast("ok", "配置已保存", "收藏功能已就绪");
    window.setTimeout(() => showView("save"), 600);
  } catch (err) {
    setBtnReset("saveCfgBtn", "saveCfgIcon", "saveCfgLabel", "保存配置", "i-check");
    setStatus("settingsStatus", "err", "保存失败", err instanceof Error ? err.message : String(err));
  }
});

$("testCfgBtn").addEventListener("click", async () => {
  const baseUrl = $("baseUrl").value.trim();
  const token = $("token").value.trim();
  if (!baseUrl) {
    setStatus("settingsStatus", "err", "请先填写实例地址", "测试连接需要实例地址与 API 令牌。");
    return;
  }
  clearStatus("settingsStatus");
  setBtnLoading("testCfgBtn", "testCfgIcon", "testCfgLabel", "测试中…");
  try {
    await saveConfig({ baseUrl, token });
    const data = await apiCall("/api/links");
    const linkCount = (data.links || []).length;
    const catCount = (data.categories || []).length;
    setBtnDone("testCfgBtn", "testCfgIcon", "testCfgLabel", "已连接");
    setStatus("settingsStatus", "ok", "连接成功", `实例运行正常 · ${linkCount} 书签 / ${catCount} 分类`);
    window.setTimeout(() => setBtnReset("testCfgBtn", "testCfgIcon", "testCfgLabel", "测试连接", "i-plug"), 1600);
  } catch (err) {
    setBtnReset("testCfgBtn", "testCfgIcon", "testCfgLabel", "测试连接", "i-plug");
    setStatus("settingsStatus", "err", "连接失败", "请检查实例地址或 API 令牌：\n" + (err instanceof Error ? err.message : String(err)));
  }
});

// ── 启动：默认打开「收藏」页（未配置时停留在收藏页并展示配置引导） ──
showView("save");