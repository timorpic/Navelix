import type { SystemConfig } from "@/types";

/**
 * 界面偏好页的纯派生逻辑。
 *
 * 从 `admin-personalization-tab.tsx`（原 532 行）抽出 —— 预览宽度映射、
 * 状态文案与 6 个侧边栏组件开关此前与 JSX 混在一起。抽出的价值主要在于
 * 「开关默认值」这一约定：6 个开关都用 `!== false` 判定（缺省即开启），
 * 写成纯函数后才有地方把这条约定固定下来。
 */

export type WallpaperMode = "bing" | "custom" | "none";
export type ClockWidgetMode = "time" | "weather" | "analog";

/** 内容宽度选项 → 预览条的宽度类（未知值回落 1200px 对应的宽度）。 */
export function previewWidthClass(maxWidth?: string): string {
  switch (maxWidth) {
    case "1000px":
      return "w-[60%]";
    case "1200px":
      return "w-[72%]";
    case "1400px":
      return "w-[84%]";
    case "full":
      return "w-full";
    default:
      return "w-[72%]";
  }
}

export function resolveWallpaperMode(config: Partial<SystemConfig>): WallpaperMode {
  return (config.wallpaperMode as WallpaperMode) || "bing";
}

/** 毛玻璃默认开启：仅显式 `false` 才关闭。 */
export function isGlassmorphismEnabled(config: Partial<SystemConfig>): boolean {
  return config.glassmorphism !== false;
}

export function wallpaperStatusText(mode: WallpaperMode): string {
  if (mode === "bing") return "无线统背景 (Bing)";
  if (mode === "custom") return "自定义 URL 背景";
  return "纯色背景";
}

export function blurStatusText(enabled: boolean): string {
  return enabled ? "毛玻璃已启用" : "未开启毛玻璃";
}

export interface WidgetToggle {
  /** 稳定的标识，同时用作 React key */
  id: string;
  title: string;
  desc: string;
  icon: string;
  /** 对应的 SystemConfig 字段名 */
  configKey: keyof SystemConfig;
  /** 当前是否显示 */
  enabled: boolean;
  /** 反转该开关的值（用于 onClick） */
  toggleValue: boolean;
}

/**
 * 右侧侧边栏的 6 个组件开关。
 *
 * 注意 `config.xxxEnabled !== false` 这一判定：配置缺省（老库没有该列）时
 * 视为**开启**，只有显式存了 `false` 才隐藏。写成纯函数后这层默认值语义
 * 有了单一出处。
 */
export function buildWidgetToggles(config: Partial<SystemConfig>): WidgetToggle[] {
  const mk = (
    id: string,
    title: string,
    desc: string,
    icon: string,
    key: keyof SystemConfig,
  ): WidgetToggle => {
    const value = config[key];
    return {
      id,
      title,
      desc,
      icon,
      configKey: key,
      enabled: value !== false,
      toggleValue: value === false,
    };
  };

  return [
    mk("aiCopilot", "AI Copilot", "智能助手状态面板", "🤖", "aiCopilotEnabled"),
    mk("todayActivity", "今日动态", "今日工作动态与事件", "⚡", "todayActivityEnabled"),
    mk("modelMonitor", "模型监控", "账号与调用额度监控", "🧠", "modelMonitorEnabled"),
    mk("linkStatus", "连接状态", "第三方服务连接状态", "🔗", "linkStatusEnabled"),
    mk("quickAccess", "快捷访问", "常用快捷链接访问", "⭐", "recentVisitsEnabled"),
    mk(
      "pendingReminders",
      "待处理提醒",
      "待办事项与提醒",
      "🔔",
      "pendingRemindersEnabled",
    ),
  ];
}
