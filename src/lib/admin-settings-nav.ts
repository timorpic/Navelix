/** Settings navigation shared by desktop, mobile and URL selection. */
export const SYSTEM_SETTINGS_NAV = [
  { id: "site", label: "站点设置", pro: false },
  { id: "brand", label: "品牌定制", pro: true },
  { id: "ai", label: "AI 服务", pro: false },
  { id: "weather", label: "天气服务", pro: false },
  { id: "access", label: "访问与安全", pro: false },
  { id: "code", label: "自定义代码", pro: true },
  { id: "probe", label: "链接探针", pro: true },
  { id: "system", label: "数据与维护", pro: false },
] as const;
export const USER_SETTINGS_NAV = [
  { id: "profile", label: "个人资料" }, { id: "personalization", label: "界面与功能" },
  { id: "notifications", label: "通知设置" }, { id: "account", label: "账号与安全" },
  { id: "personalData", label: "个人数据" },
] as const;
export type SettingsTab = typeof SYSTEM_SETTINGS_NAV[number]["id"] | typeof USER_SETTINGS_NAV[number]["id"];
export function isSystemSettingsTab(tab: string): boolean {
  return SYSTEM_SETTINGS_NAV.some(item => item.id === tab);
}
export function getSystemSettingsNav(showProMenus = true) {
  return SYSTEM_SETTINGS_NAV.filter(item => showProMenus || !item.pro);
}
