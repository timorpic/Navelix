"use client";

import { createContext, useContext } from "react";
import type { Category, Project, SiteLink, SystemConfig, TodoItem } from "@/types";
import { DEFAULT_SITE_TITLE, DEFAULT_CUSTOM_FOOTER } from "@/lib/constants";

export const defaultConfig: SystemConfig = {
  logoText: "Navelix",
  logoImage: "",
  showSearchBar: true,
  maxWidth: "1200px",
  customFooter: DEFAULT_CUSTOM_FOOTER,
  theme: "system",
  allowPublicAccess: false,
  allowRegistration: false,
  securitySetupDone: false,
  customHeadScripts: "",
  customCss: "",
  aiBaseUrl: "https://api.openai.com/v1",
  aiApiKey: "",
  aiModel: "gpt-4o-mini",
  aiKeyConfigured: false,
  siteTitle: DEFAULT_SITE_TITLE,
  linkStatusEnabled: false,
  linkStatusInterval: 60,
  socialGithub: "https://github.com",
  socialX: "https://x.com",
  socialLinkedin: "https://linkedin.com",
  socialEmail: "[邮箱]",
  weatherEnabled: false,
  weatherApiKey: "",
  weatherLocation: "",
  weatherApiBaseUrl: "https://api.seniverse.com",
  weatherKeyConfigured: false,
  linkOpenTarget: "_blank",
  wallpaperMode: "none",
  customWallpaperUrl: "",
  glassmorphism: false,
  sidebarDefaultState: "expanded",
  clockWidgetMode: "time",
  modelMonitorEnabled: true,
  aiCopilotEnabled: true,
  todayActivityEnabled: true,
  recentVisitsEnabled: true,
  pendingRemindersEnabled: false,
  todaySummaryEnabled: false,
  socialLinksEnabled: true,
};

export interface NavelixDataApi {
  user?: {
    id: string;
    username: string;
    displayName: string;
    email: string;
    bio: string;
    role: "admin" | "user";
    avatar: string;
  } | null;
  categories: Category[];
  links: SiteLink[];
  projects: Project[];
  todos: TodoItem[];
  hydrated: boolean;
  refreshData: () => void;
  saveProjects: (projects: Project[]) => void;
  addCategory: (name: string, icon: string, isTeamShared?: boolean) => void;
  deleteCategory: (id: string) => void;
  addLink: (link: Omit<SiteLink, "id">) => void;
  deleteLink: (id: string) => void;
  deleteAllLinks: () => void;
  updateLink: (id: string, patch: Omit<SiteLink, "id">) => void;
  updateCategory: (id: string, patch: { name: string; icon: string; isTeamShared?: boolean }) => void;
  toggleQuickAccess: (id: string) => void;
  importData: (cats: Category[], lnks: SiteLink[]) => void;
  resetData: () => void;
  mergeBookmarks: (cats: Category[], lnks: SiteLink[]) => void;
}

export interface NavelixConfigApi {
  config: SystemConfig;
  hydrated: boolean;
  /** 当前实际生效的明暗状态（dark/light/system 解析后的结果），由 Provider 统一计算 */
  isDark: boolean;
  updateConfig: (patch: Partial<SystemConfig>) => void;
  resetConfig: () => void;
}

export const NavelixDataContext = createContext<NavelixDataApi | null>(null);
export const NavelixConfigContext = createContext<NavelixConfigApi | null>(null);

export function useNavelixData(): NavelixDataApi {
  const ctx = useContext(NavelixDataContext);
  if (!ctx) {
    throw new Error("useNavelixData must be used within NavelixProvider");
  }
  return ctx;
}

export function useNavelixConfig(): NavelixConfigApi {
  const ctx = useContext(NavelixConfigContext);
  if (!ctx) {
    throw new Error("useNavelixConfig must be used within NavelixProvider");
  }
  return ctx;
}