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
  showSearchBar: boolean;
  maxWidth: "1000px" | "1200px" | "1400px" | "full";
  customFooter: string;
  theme: "light" | "dark" | "system";
  searchEngine: "google" | "baidu" | "bing" | "perplexity";
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
  // 天气模块（和风天气）
  weatherEnabled?: boolean;
  weatherApiKey?: string;
  weatherLocation?: string; // 和风天气 LocationID 或 "经度,纬度" 坐标
  weatherApiBaseUrl?: string; // 可选，默认 devapi.qweather.com
  weatherKeyConfigured?: boolean;
}
