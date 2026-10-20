export interface Category {
  id: string;
  name: string;
  label: string;
  icon: string;
  color: string;
  isTeamShared?: boolean;
  isSubscribed?: boolean;
  ownerId?: string;
  ownerName?: string;
  sourceId?: string;
}

export interface SiteLink {
  ownerId?: string;
  isSubscribed?: boolean;
  sourceId?: string;
  id: string;
  title: string;
  url: string;
  description: string;
  icon: string;
  category: string;
  isQuickAccess?: boolean;
  /** 收藏页面的 Markdown 笔记/摘要（用于内容检索与展示） */
  notes?: string;
}

export interface AIChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  /** AI 暂存待确认的删除请求：存在时渲染确认卡而不是纯文本 */
  deletions?: { pendingId: string; targetName: string; message: string }[];
  /** 确认卡已处理（确认或取消）后置为 false，避免重复提交 */
  deletionPending?: boolean;
}

export interface TodoItem {
  id: string;
  title: string;
  priority: "high" | "medium" | "low";
  done: boolean;
  dueDate?: string; // ISO 8601 date string
  projectId?: string; // 关联项目
  assigneeId?: string; // 责任人ID
  assigneeName?: string; // 责任人显示名称
  ownerId?: string; // 任务创建者ID
  ownerName?: string; // 任务创建者显示名称
  isDelegated?: boolean; // 是否属于指派/委托给当前用户的任务
  createdAt: number;
  sortOrder: number;
}

export interface WorkspaceMember {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
  role?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status?: string;
  statusColor?: string;
  url?: string;
  color?: string;
  sortOrder?: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface SystemConfig {
  language: "zh-CN" | "en";
  logoText: string;
  logoImage?: string;
  showSearchBar: boolean;
  maxWidth: "1000px" | "1200px" | "1400px" | "full";
  customFooter: string;
  theme: "light" | "dark" | "system";

  // 访问与安全控制策略
  allowPublicAccess?: boolean; // 是否允许未登录访客公开浏览主页（默认 false，保守安全）
  allowRegistration?: boolean; // 是否开放新用户注册（默认 false，保守安全）
  // 首次登录安全设置引导是否已完成（修改初始密码 / 配置访问策略）
  securitySetupDone?: boolean;

  // 自定义脚本与样式注入
  // ⚠️ 安全警告：以下两项会以 dangerouslySetInnerHTML / <style> 直接注入到所有访客页面，
  // 相当于绕过 CSP 的 unsafe-inline。仅限管理员配置（服务端已用角色门禁收口）。
  // 切勿用于不可信来源的内容，否则将形成存储型 XSS / 数据外泄风险。
  customHeadScripts?: string; // 统计代码/第三方探针（仅管理员，绕过 CSP 注入）
  customCss?: string; // 自定义 CSS 样式（仅管理员，绕过 CSP style-src 注入）

  aiBaseUrl?: string;
  // 明文密钥永不下发前端；仅用于提交（留空=保持不变），及本地占位。
  aiApiKey?: string;
  aiModel?: string;
  // 服务端回传的"是否已配置"标记（不下发明文）
  aiKeyConfigured?: boolean;
  siteTitle?: string;
  showProMenus?: boolean; // 全站后台 Pro 子菜单显示，一级 Pro 入口始终保留
  linkStatusEnabled?: boolean;
  enableLinkProbe?: boolean;
  linkStatusInterval?: number;
  socialGithub?: string;
  socialX?: string;
  socialLinkedin?: string;
  socialEmail?: string;
  // 天气模块（和风/心知天气）
  weatherEnabled?: boolean;
  weatherApiKey?: string;
  weatherLocation?: string; // LocationID 或城市名称
  weatherApiBaseUrl?: string; // 默认 devapi.qweather.com
  weatherKeyConfigured?: boolean;

  // 更多个性化外观配置
  linkOpenTarget?: "_blank" | "_self";
  wallpaperMode?: "none" | "bing" | "custom";
  customWallpaperUrl?: string;
  glassmorphism?: boolean;
  sidebarDefaultState?: "expanded" | "collapsed";
  clockWidgetMode?: "time" | "weather" | "analog";
  // 前台工作区组件显示开关（管理后台「界面与功能偏好」可切换）
  aiCopilotEnabled?: boolean;
  /** @deprecated 兼容历史配置；首页已移除动态组件。 */
  todayActivityEnabled?: boolean;
  recentVisitsEnabled?: boolean;
  /** @deprecated 兼容历史配置；前台通知铃铛已移除，该开关不再影响显示。 */
  pendingRemindersEnabled?: boolean;
  todaySummaryEnabled?: boolean;
  socialLinksEnabled?: boolean;
}
