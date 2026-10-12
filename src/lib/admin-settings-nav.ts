/** Settings navigation shared by desktop, mobile and URL selection. */
export const SYSTEM_SETTINGS_NAV = [
  { id: "site", label: "站点与服务", pro: false },
  { id: "access", label: "访问与安全", pro: false },
  { id: "proSystem", label: "系统功能", pro: true },
  { id: "system", label: "数据与维护", pro: false },
] as const;
export const USER_SETTINGS_NAV = [
  { id: "profile", label: "个人与偏好" },
  { id: "account", label: "账号与数据" },
  { id: "proUser", label: "用户功能", pro: true },
] as const;
export type SettingsTab = typeof SYSTEM_SETTINGS_NAV[number]["id"] | typeof USER_SETTINGS_NAV[number]["id"];
export function isSystemSettingsTab(tab: string): boolean {
  return SYSTEM_SETTINGS_NAV.some(item => item.id === tab);
}
export function getSystemSettingsNav(showProMenus = true) {
  return SYSTEM_SETTINGS_NAV.filter(item => showProMenus || !item.pro);
}

export function getUserSettingsNav(showProMenus = true) {
  return USER_SETTINGS_NAV.filter(item => showProMenus || !("pro" in item && item.pro));
}

/** Keep bookmarks from before menu consolidation working. */
export function resolveSettingsTab(tab: string): SettingsTab | undefined {
  switch (tab) {
    case "ai":
    case "weather": return "site";
    case "personalization":
    case "notifications": return "profile";
    case "personalData": return "account";
    default: return [...SYSTEM_SETTINGS_NAV, ...USER_SETTINGS_NAV].find(item => item.id === tab)?.id;
  }
}
