"use client";

import { createContext, useContext } from "react";
import type { Category, Project, SiteLink, SystemConfig, TodoItem } from "@/types";
import type { BookmarkMergeSummary } from "@/lib/bookmark-merge";
import { DEFAULT_SITE_TITLE, DEFAULT_CUSTOM_FOOTER } from "@/lib/constants";

export const defaultConfig: SystemConfig = {
  language: "zh-CN",
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
  showProMenus: true,
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
  aiCopilotEnabled: true,
  recentVisitsEnabled: true,
  todaySummaryEnabled: false,
  socialLinksEnabled: true,
};

/**
 * 实体写结果。
 *
 * `conflict: true` 表示服务端拒绝了本次写入（工作区已在别处更新）——
 * 数据已自动刷新，调用方应保留用户输入并提示重试，而不是静默重置表单。
 */
export type WorkspaceMutationResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; conflict: boolean; status: number; error: string };

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
  /**
   * 实体写操作的统一入口。
   *
   * 自动注入 `expectedRevision`、串行化同页连续写入、成功后同步本地 revision。
   * 冲突（409）时已自动刷新数据，返回 `conflict: true`，调用方据此保留用户
   * 草稿并提示重新提交。
   */
  mutateWorkspace: (
    url: string,
    init: { method: "POST" | "PATCH" | "DELETE"; body?: unknown },
  ) => Promise<WorkspaceMutationResult>;
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
  mergeBookmarks: (cats: Category[], lnks: SiteLink[]) => Promise<BookmarkMergeSummary>;
}

export interface NavelixConfigApi {
  config: SystemConfig;
  hydrated: boolean;
  /** 当前实际生效的明暗状态（dark/light/system 解析后的结果），由 Provider 统一计算 */
  isDark: boolean;
  updateConfig: (patch: Partial<SystemConfig>) => void;
  resetConfig: () => void;
  changeLanguage: (language: SystemConfig["language"]) => Promise<void>;
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