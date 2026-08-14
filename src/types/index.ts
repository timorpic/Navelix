export interface Category {
  id: string;
  name: string;
  label: string;
  icon: string;
  color: string;
}

export interface SiteLink {
  id: string;
  title: string;
  url: string;
  description: string;
  icon: string;
  category: string;
  isQuickAccess?: boolean;
}

export interface ProductivityStat {
  category: string;
  time: string;
  color: string;
}

export interface AIChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
}

export interface TodoItem {
  id: string;
  title: string;
  priority: "high" | "medium" | "low";
  done: boolean;
  dueDate?: string; // ISO 8601 date string
  projectId?: string; // 关联项目
  createdAt: number;
  sortOrder: number;
}

export interface Project {
  id: string;
  name: string;
  status?: string;
  statusColor?: string;
  url?: string;
  color?: string;
  sortOrder?: number;
}

export interface SystemConfig {
  logoText: string;
  logoImage?: string;
  isPro?: boolean;
  proKey?: string;
  showSearchBar: boolean;
  maxWidth: "1000px" | "1200px" | "1400px" | "full";
  customFooter: string;
  theme: "light" | "dark" | "system";
  searchEngine: "google" | "baidu" | "bing" | "perplexity" | "custom";
  customSearchName?: string;
  customSearchUrl?: string; // 搜索模板，如 https://search.example.com/search?q=%s

  // 访问与安全控制策略
  allowPublicAccess?: boolean; // 是否允许未登录访客公开浏览主页（默认 true）
  allowRegistration?: boolean; // 是否开放新用户注册（默认 true）

  // 自定义脚本与样式注入
  customHeadScripts?: string; // 统计代码/第三方探针
  customCss?: string; // 自定义 CSS 样式

  aiBaseUrl?: string;
  // 明文密钥永不下发前端；仅用于提交（留空=保持不变），及本地占位。
  aiApiKey?: string;
  aiModel?: string;
  // 服务端回传的"是否已配置"标记（不下发明文）
  aiKeyConfigured?: boolean;
  siteTitle?: string;
  linkStatusEnabled?: boolean;
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
}
