import { getConfig, saveBookmark, baseUrlOf } from "./common.js";

const PAGES_MENU_ID = "navelix-save-page";
const LINKS_MENU_ID = "navelix-save-link";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: PAGES_MENU_ID,
      title: "📌 收藏当前页到 Navelix",
      contexts: ["page"],
    });
    chrome.contextMenus.create({
      id: LINKS_MENU_ID,
      title: "📌 收藏此链接到 Navelix",
      contexts: ["link"],
    });
  });
});

async function notify(title, message) {
  try {
    await chrome.notifications.create(`navelix-${Date.now()}`, {
      type: "basic",
      iconUrl: "icons/icon.svg",
      title,
      message,
    });
  } catch {
    // 通知权限不可用时静默
  }
}

async function save(url, title) {
  try {
    const cfg = await getConfig();
    if (!cfg.baseUrl) throw new Error("请先在扩展设置中配置 Navelix 地址");
    const result = await saveBookmark({ title, url });
    await notify(
      "Navelix",
      result.duplicate ? "该网址已收藏过，未重复添加" : `已收藏：${title || url}`,
    );
  } catch (err) {
    await notify("Navelix 收藏失败", err instanceof Error ? err.message : String(err));
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === PAGES_MENU_ID && tab?.url) {
    save(tab.url, tab.title || "").catch(() => {});
  } else if (info.menuItemId === LINKS_MENU_ID && info.linkUrl) {
    save(info.linkUrl, "").catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "navelix:open") {
    getConfig()
      .then((c) => baseUrlOf(c.baseUrl))
      .then((base) => {
        if (base) chrome.tabs.create({ url: base, active: true });
      });
    sendResponse({ ok: true });
  }
  return false;
});