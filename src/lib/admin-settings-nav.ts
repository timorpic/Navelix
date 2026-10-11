/** Settings navigation shared by desktop, mobile and URL selection. */
export const SYSTEM_SETTINGS_NAV = [
  { id: "site", label: "站点与品牌" }, { id: "ai", label: "AI 服务" },
  { id: "weather", label: "天气服务" }, { id: "access", label: "访问与安全" },
  { id: "code", label: "自定义代码" }, { id: "probe", label: "链接探针 · Pro" },
  { id: "telemetry", label: "统计与遥测" }, { id: "system", label: "数据与维护" },
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
