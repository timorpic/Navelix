"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  defaultConfig,
  type NavelixConfigApi,
  type NavelixDataApi,
  type WorkspaceMutationResult,
  NavelixConfigContext,
  NavelixDataContext,
} from "@/context/navelix-context";
import {
  categories as seedCategories,
  siteLinks as seedLinks,
} from "@/data/links";
import type { Category, Project, SiteLink, SystemConfig, TodoItem } from "@/types";
import type { UserDataResult } from "@/lib/user-data";
import { mergeBookmarkData } from "@/lib/bookmark-merge";
import { configForBrowser } from "@/lib/config-persistence";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** 退出登录时的客户端缓存清理：清除所有用户数据 localStorage 缓存 */
export function clearCachedUserData(): void {
  try {
    localStorage.removeItem("navelix.user.categories");
    localStorage.removeItem("navelix.user.links");
    localStorage.removeItem("navelix.user.config");
    localStorage.removeItem("navelix_theme");
  } catch {
    // localStorage 不可用时静默忽略
  }
}

export function NavelixProvider({
  children,
  initialData,
}: {
  children: React.ReactNode;
  initialData?: UserDataResult;
}) {
  const locale = useLocale();
  const tx = useTranslations();
  const router = useRouter();
  const [user, setUser] = useState(initialData?.user ?? null);
  const [categories, setCategories] = useState<Category[]>(
    initialData?.categories ?? seedCategories,
  );
  const [links, setLinks] = useState<SiteLink[]>(
    initialData?.links ?? seedLinks,
  );
  const [projects, setProjects] = useState<Project[]>(
    initialData?.projects ?? [],
  );
  const [todos, setTodos] = useState<TodoItem[]>(initialData?.todos ?? []);
  const [config, setConfig] = useState<SystemConfig>(
    initialData?.config ?? defaultConfig,
  );
  const [hydrated, setHydrated] = useState(!!initialData);

  const revisionRef = useRef(initialData?.revision);
  const pendingSaves = useRef(0);
  const saveQueue = useRef(Promise.resolve());
  const saveEpoch = useRef(0);
  const generation = useRef(0);
  const loadInFlight = useRef(false);
  const loadQueued = useRef(false);
  const loadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const [saveError, setSaveError] = useState("");

  const [resolvedDark, setResolvedDark] = useState<boolean>(false);

  // Purge historical cached plaintext even when SSR skips the fallback loader.
  useEffect(() => {
    const cached = readJson<Partial<SystemConfig>>("navelix.user.config");
    if (cached && (Object.hasOwn(cached, "aiApiKey") || Object.hasOwn(cached, "weatherApiKey"))) {
      try { localStorage.setItem("navelix.user.config", JSON.stringify(configForBrowser(cached))); } catch { /* cache is optional */ }
    }
  }, []);

  // Refs mirror the latest state so mutations can compute the next snapshot
  const categoriesRef = useRef(categories);
  const linksRef = useRef(links);
  const configRef = useRef(config);

  useEffect(() => {
    categoriesRef.current = categories;
    linksRef.current = links;
    configRef.current = config;
  });

  // 1. 核心 DOM 主题应用逻辑（防闪烁 + 禁用过渡动画 + 双 Cookie 与 DOM 同步）
  const applyThemeToDom = useCallback((theme: string) => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const isDark = theme === "dark" || (theme === "system" && media.matches);

    const docEl = document.documentElement;
    if (docEl.classList.contains("dark") !== isDark) {
      docEl.classList.add("theme-transitioning");
      docEl.classList.toggle("dark", isDark);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          docEl.classList.remove("theme-transitioning");
        });
      });
    }

    setResolvedDark(media.matches);

    try {
      document.cookie = `navelix_theme=${theme};path=/;max-age=31536000;SameSite=Lax`;
      document.cookie = `navelix_theme_dark=${isDark ? "1" : "0"};path=/;max-age=31536000;SameSite=Lax`;
    } catch {
      /* ignore */
    }
  }, []);

  // 2. 配置服务端与 LocalStorage 持久化保存
  const saveConfigToServer = useCallback((nextCfg: SystemConfig, patch: Partial<SystemConfig>) => {
    fetch("/api/user/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: patch }),
    }).then(response => {
      if (!response.ok) throw new Error("保存配置失败");
      if (patch.language) router.refresh();
    }).catch((e) => console.warn("[Navelix] 保存失败", e));

    try {
      localStorage.setItem("navelix.user.config", JSON.stringify(nextCfg));
      localStorage.setItem("navelix_theme", nextCfg.theme);
      localStorage.removeItem("theme");
    } catch (e) {
      console.warn("[Navelix] localStorage 操作失败", e);
    }
  }, [router]);

  // 3. 统一更新配置方法：即时触发 DOM 改变 + 存储 + 状态更新
  const updateConfig = useCallback(
    (patch: Partial<SystemConfig>) => {
      const next = { ...configRef.current, ...configForBrowser(patch) };
      configRef.current = next;
      setConfig(next);

      if (patch.theme) {
        applyThemeToDom(patch.theme);
        try {
          localStorage.setItem("navelix_theme", patch.theme);
        } catch {}
      }
      saveConfigToServer(next, patch);
    },
    [saveConfigToServer, applyThemeToDom],
  );

  const changeLanguage = useCallback(async (language: SystemConfig["language"]) => {
    const response = await fetch("/api/user/locale", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language }) });
    if (!response.ok) throw new Error("Unable to save language");
    const next = { ...configRef.current, language };
    configRef.current = next;
    setConfig(next);
    try { localStorage.setItem("navelix.user.config", JSON.stringify(configForBrowser(next))); } catch { /* optional cache */ }
  }, []);

  const resetConfig = useCallback(() => {
    updateConfig(defaultConfig);
  }, [updateConfig]);

  // 4. 数据加载 fallback
  const performLoad = useCallback(() => {
    if (!mounted.current) return;
    if (pendingSaves.current || loadInFlight.current) { loadQueued.current = true; return; }
    loadInFlight.current = true;
    loadQueued.current = false;
    const currentGeneration = generation.current;
    fetch("/api/user/data")
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("Not logged in");
      })
      .then((data) => {
        if (!mounted.current || pendingSaves.current || currentGeneration !== generation.current) return;
        revisionRef.current = data.revision;
        if (Array.isArray(data.categories)) categoriesRef.current = data.categories;
        if (Array.isArray(data.links)) linksRef.current = data.links;
        if (data.user) setUser(data.user);
        if (Array.isArray(data.categories)) setCategories(data.categories);
        if (Array.isArray(data.links)) setLinks(data.links);
        if (Array.isArray(data.projects)) setProjects(data.projects);
        if (Array.isArray(data.todos)) setTodos(data.todos);
        if (data.config) {
          const localTheme = localStorage.getItem("navelix_theme");
          const activeTheme =
            localTheme === "light" || localTheme === "dark" || localTheme === "system"
              ? localTheme
              : data.config.theme;
          setConfig({ ...defaultConfig, ...data.config, theme: activeTheme });
          if (data.config.language !== locale) router.refresh();
          if (activeTheme) {
            applyThemeToDom(activeTheme);
          }
        }
        setHydrated(true);
      })
      .catch(() => {
        if (!mounted.current || initialData) return;
        const cats = readJson<Category[]>("navelix.user.categories");
        const lnks = readJson<SiteLink[]>("navelix.user.links");
        const cfg = readJson<Partial<SystemConfig>>("navelix.user.config");
        const localTheme = localStorage.getItem("navelix_theme");

        if (cats) setCategories(cats);
        if (lnks) setLinks(lnks);
        if (cfg) {
          const safeConfig = configForBrowser(cfg);
          localStorage.setItem("navelix.user.config", JSON.stringify(safeConfig));
          const activeTheme =
            localTheme === "light" || localTheme === "dark" || localTheme === "system"
              ? (localTheme as SystemConfig["theme"])
              : cfg.theme || "system";
          setConfig({ ...defaultConfig, ...safeConfig, theme: activeTheme });
          applyThemeToDom(activeTheme);
        } else if (localTheme) {
          setConfig((prev) => ({ ...prev, theme: localTheme as SystemConfig["theme"] }));
          applyThemeToDom(localTheme);
        }
        setHydrated(true);
      }).finally(() => {
        loadInFlight.current = false;
        if (loadQueued.current && mounted.current && !pendingSaves.current) {
          window.dispatchEvent(new CustomEvent("navelix-workspace-updated"));
        }
      });
  }, [applyThemeToDom, initialData, locale, router]);

  const loadData = useCallback(() => {
    if (!mounted.current) return;
    if (loadTimer.current) clearTimeout(loadTimer.current);
    loadTimer.current = setTimeout(() => { loadTimer.current = null; performLoad(); }, 80);
  }, [performLoad]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; if (loadTimer.current) clearTimeout(loadTimer.current); };
  }, []);

  // 5. 挂载加载与跨标签页 Storage 同步
  useEffect(() => {
      if (typeof window !== "undefined") {
        const media = window.matchMedia("(prefers-color-scheme: dark)");
        queueMicrotask(() => setResolvedDark(media.matches));
      }

    if (!initialData) {
          loadData();
        } else {
          const localTheme = localStorage.getItem("navelix_theme");
          if (localTheme && (localTheme === "light" || localTheme === "dark" || localTheme === "system")) {
            if (localTheme !== config.theme) {
              queueMicrotask(() => setConfig((prev) => ({ ...prev, theme: localTheme as SystemConfig["theme"] })));
            }
            queueMicrotask(() => applyThemeToDom(localTheme));
          } else {
            queueMicrotask(() => applyThemeToDom(config.theme));
          }
        }

    const storageHandler = (e: StorageEvent) => {
      if (e.key === "navelix_theme" && e.newValue) {
        const nextTheme = e.newValue as SystemConfig["theme"];
        setConfig((prev) => ({ ...prev, theme: nextTheme }));
        applyThemeToDom(nextTheme);
      } else if (e.key === "navelix.user.config" && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && parsed.theme) {
            setConfig((prev) => ({ ...prev, theme: parsed.theme }));
            applyThemeToDom(parsed.theme);
          }
        } catch {}
      } else if (
        e.key === "navelix.user.categories" ||
        e.key === "navelix.user.links"
      ) {
        // 仅对本 Provider 自己持久化的数据 key 触发全量同步，
        // 避免 focus-tracker 等高频写入（每 5s 一次）造成 storage 事件风暴
        loadData();
      }
    };

    window.addEventListener("storage", storageHandler);
        return () => window.removeEventListener("storage", storageHandler);
      }, [loadData, initialData, applyThemeToDom, config.theme]);

  // 6. 实时 SSE 数据同步：当浏览器扩展收藏、跨标签页修改、后台监控刷新完成时，自动静默同步
  useRealtimeSync({
    onLinksChange: loadData,
    onProjectsChange: loadData,
    onTodosChange: loadData,
    enabled: hydrated && Boolean(user),
  });

  // 6.1 统一数据刷新：监听工作台数据变更事件（各组件改完后广播），
  // 由 Provider 作为唯一数据源统一重载，避免每个组件各自独立 fetch 造成重复请求。
  const refreshData = useCallback(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const handleWorkspaceUpdate = () => refreshData();
    window.addEventListener("navelix-workspace-updated", handleWorkspaceUpdate);
    return () =>
      window.removeEventListener("navelix-workspace-updated", handleWorkspaceUpdate);
  }, [refreshData]);

  // 7. 系统主题变动监听器（当 config.theme === 'system' 时响应系统级浅色/深色切换）
  useEffect(() => {
    if (config.theme !== "system" || typeof window === "undefined") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = () => {
      applyThemeToDom("system");
    };

    media.addEventListener("change", handleSystemChange);
    return () => media.removeEventListener("change", handleSystemChange);
  }, [config.theme, applyThemeToDom]);

  // 8. 自定义站点标题（浏览器标签页）
  useEffect(() => {
    if (hydrated && config.siteTitle) {
      document.title = config.siteTitle;
    }
  }, [config.siteTitle, hydrated]);

  // Serialize local snapshots; stale cross-tab snapshots are rejected atomically by the server.
  const saveSnapshot = useCallback((snapshot: { categories?: Category[]; links?: SiteLink[]; projects?: Project[] }) => {
    const epoch = saveEpoch.current;
    pendingSaves.current++;
    generation.current++;
    const operation = saveQueue.current.then(async () => {
      if (!mounted.current || epoch !== saveEpoch.current) return false;
      const response = await fetch("/api/user/data", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...snapshot, expectedRevision: revisionRef.current }),
      });
      if (!response.ok) throw new Error(response.status === 409 ? "conflict" : "failed");
      const data = await response.json();
      revisionRef.current = data.revision;
      if (!mounted.current) return false;
      setSaveError("");
      try {
        if (snapshot.categories) localStorage.setItem("navelix.user.categories", JSON.stringify(snapshot.categories));
        if (snapshot.links) localStorage.setItem("navelix.user.links", JSON.stringify(snapshot.links));
      } catch { /* cache is optional */ }
      return true;
    }).catch((error: unknown) => {
      saveEpoch.current++;
      if (mounted.current) setSaveError(error instanceof Error && error.message === "conflict" ? tx("workspace_save_conflict") : tx("workspace_save_failed"));
      return false;
    }).finally(() => {
      pendingSaves.current--;
      if (!pendingSaves.current) loadData();
    });
    saveQueue.current = operation.then(() => {});
    return operation;
  }, [loadData, tx]);

  const saveToServer = useCallback((nextCats: Category[], nextLinks: SiteLink[]) => {
    return saveSnapshot({ categories: nextCats, links: nextLinks });
  }, [saveSnapshot]);

  const commitData = useCallback(
    (nextCats: Category[], nextLinks: SiteLink[]) => {
      categoriesRef.current = nextCats;
      linksRef.current = nextLinks;
      setCategories(nextCats);
      setLinks(nextLinks);
      return saveToServer(nextCats, nextLinks);
    },
    [saveToServer],
  );

  const addCategory = useCallback(
    (name: string, icon: string, isTeamShared?: boolean) => {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const id = `${slug || "category"}-${Math.random().toString(36).slice(2, 7)}`;
      const nextCats = [
        ...categoriesRef.current,
        {
          id,
          name: name.trim(),
          label: name.trim().slice(0, 3),
          icon: icon || "📁",
          color: "#00C776",
          isTeamShared: Boolean(isTeamShared),
        },
      ];
      commitData(nextCats, linksRef.current);
    },
    [commitData],
  );

  const deleteCategory = useCallback(
    (id: string) => {
      if (categoriesRef.current.some(c => c.id === id && c.isSubscribed)) return;
      const nextCats = categoriesRef.current.filter((c) => c.id !== id);
      const nextLinks = linksRef.current.filter((l) => l.category !== id);
      commitData(nextCats, nextLinks);
    },
    [commitData],
  );

  const addLink = useCallback(
    (link: Omit<SiteLink, "id">) => {
      if (categoriesRef.current.some(c => c.id === link.category && c.isSubscribed)) return;
      const nextLinks = [
        ...linksRef.current,
        { ...link, id: crypto.randomUUID() },
      ];
      commitData(categoriesRef.current, nextLinks);
    },
    [commitData],
  );

  const deleteLink = useCallback(
    (id: string) => {
      const nextLinks = linksRef.current.filter((l) => l.id !== id);
      commitData(categoriesRef.current, nextLinks);
    },
    [commitData],
  );

  const updateLink = useCallback(
    (id: string, patch: Omit<SiteLink, "id">) => {
      if (linksRef.current.some(l => l.id === id && l.isSubscribed)) return;
      const nextLinks = linksRef.current.map((l) =>
        l.id === id ? { ...patch, id } : l,
      );
      commitData(categoriesRef.current, nextLinks);
    },
    [commitData],
  );

  const updateCategory = useCallback(
    (id: string, patch: { name: string; icon: string; isTeamShared?: boolean }) => {
      if (categoriesRef.current.some(c => c.id === id && c.isSubscribed)) return;
      const nextCats = categoriesRef.current.map((c) =>
        c.id === id
          ? {
              ...c,
              name: patch.name.trim(),
              label: patch.name.trim().slice(0, 3),
              icon: patch.icon || c.icon,
              isTeamShared:
                patch.isTeamShared !== undefined
                  ? Boolean(patch.isTeamShared)
                  : c.isTeamShared,
            }
          : c,
      );
      commitData(nextCats, linksRef.current);
    },
    [commitData],
  );

  const toggleQuickAccess = useCallback(
    (id: string) => {
      const nextLinks = linksRef.current.map((l) =>
        l.id === id ? { ...l, isQuickAccess: !l.isQuickAccess } : l,
      );
      commitData(categoriesRef.current, nextLinks);
    },
    [commitData],
  );

  const importData = useCallback(
    (cats: Category[], lnks: SiteLink[]) => {
      commitData(cats, lnks);
    },
    [commitData],
  );

  const resetData = useCallback(() => {
    commitData(seedCategories, seedLinks);
  }, [commitData]);

  const mergeBookmarks = useCallback(
    async (cats: Category[], lnks: SiteLink[]) => {
      const merged = mergeBookmarkData(categoriesRef.current, linksRef.current, cats, lnks);
      const saved = await commitData(merged.categories, merged.links);
      if (!saved) throw new Error("Bookmark import was not saved");
      return merged.summary;
    },
    [commitData],
  );

  const deleteAllLinks = useCallback(() => {
    commitData(categoriesRef.current, []);
  }, [commitData]);

  const saveProjects = useCallback((nextProjects: Project[]) => {
    setProjects(nextProjects);
    saveSnapshot({ projects: nextProjects });
  }, [saveSnapshot]);

  /**
   * 实体写操作（项目/待办的新建、修改、删除）的统一入口。
   *
   * 这些接口此前完全绕过 workspace revision：写成功但本地 revision 过期，
   * 用户下一次保存书签就会 409 并丢掉那次编辑。此处三件事一次做完：
   * 1. 注入 `expectedRevision`，让服务端在同一事务里校验；
   * 2. 复用 `saveQueue` 串行化，避免同页连续两次写互相踩；DELETE 用查询参数
   *    携带 revision（没有 body）；
   * 3. 成功后同步新 revision；409 时刷新数据并返回 `conflict`，由调用方保留草稿。
   */
  const mutateWorkspace = useCallback(
    (
      url: string,
      init: { method: "POST" | "PATCH" | "DELETE"; body?: unknown },
    ): Promise<WorkspaceMutationResult> => {
      const operation = saveQueue.current.then(async () => {
        const revision = revisionRef.current;
        const hasBody = init.method !== "DELETE";
        // 带 body 的写请求把 revision 放在 body 里（与 REST 文档一致）；只有
        // 没有 body 的 DELETE 才用查询参数。不要两处都加——URL 上的额外查询串
        // 会让按路径精确匹配响应的调用方（含 E2E）漏掉该请求。
        const target =
          !hasBody && revision
            ? `${url}${url.includes("?") ? "&" : "?"}expectedRevision=${encodeURIComponent(revision)}`
            : url;
        const response = await fetch(target, {
          method: init.method,
          ...(hasBody
            ? {
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...(init.body as Record<string, unknown> | undefined), expectedRevision: revision }),
              }
            : {}),
        });
        const data: unknown = await response.json().catch(() => null);
        const body = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
        if (response.ok) {
          if (typeof body.revision === "string") revisionRef.current = body.revision;
          return { ok: true as const, data: body };
        }
        if (response.status === 409) {
          loadData();
          return {
            ok: false as const,
            conflict: true,
            status: 409,
            error: typeof body.error === "string" ? body.error : "",
          };
        }
        return {
          ok: false as const,
          conflict: false,
          status: response.status,
          error: typeof body.error === "string" ? body.error : "",
        };
      });
      // 队列只关心顺序，不传播结果（与 saveSnapshot 的用法一致）
      saveQueue.current = operation.then(() => {}, () => {});
      return operation;
    },
    [loadData],
  );

  const dataApi: NavelixDataApi = {
    user,
    categories,
    links,
    projects,
    todos,
    hydrated,
    refreshData,
    mutateWorkspace,
    saveProjects,
    addCategory,
    deleteCategory,
    addLink,
    deleteLink,
    deleteAllLinks,
    updateLink,
    updateCategory,
    toggleQuickAccess,
    importData,
    resetData,
    mergeBookmarks,
  };

  const isDark =
    config.theme === "dark" || (config.theme === "system" && resolvedDark);

  const configApi: NavelixConfigApi = {
    config,
    hydrated,
    isDark,
    updateConfig,
    resetConfig,
    changeLanguage,
  };

  return (
    <NavelixDataContext.Provider value={dataApi}>
      <NavelixConfigContext.Provider value={configApi}>
        {saveError && <div role="alert" className="fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-red-700 p-3 text-sm text-white">
          {saveError}<button type="button" className="ml-3 underline" onClick={() => setSaveError("")}>{tx("workspace_notice_dismiss")}</button>
        </div>}
        {children}
      </NavelixConfigContext.Provider>
    </NavelixDataContext.Provider>
  );
}
