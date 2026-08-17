"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  defaultConfig,
  type NavelixConfigApi,
  type NavelixDataApi,
  NavelixConfigContext,
  NavelixDataContext,
} from "@/context/navelix-context";
import {
  categories as seedCategories,
  siteLinks as seedLinks,
} from "@/data/links";
import type { Category, Project, SiteLink, SystemConfig } from "@/types";
import type { UserDataResult } from "@/lib/user-data";

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
    localStorage.removeItem("navelix.antigravity.auth.accounts");
    localStorage.removeItem("navelix.antigravity.auth.info");
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
  const [config, setConfig] = useState<SystemConfig>(
    initialData?.config ?? defaultConfig,
  );
  const [hydrated, setHydrated] = useState(!!initialData);

  const [resolvedDark, setResolvedDark] = useState<boolean>(false);

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
  const saveConfigToServer = useCallback((nextCfg: SystemConfig) => {
    fetch("/api/user/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: nextCfg }),
    }).catch((e) => console.warn("[Navelix] 保存失败", e));

    try {
      localStorage.setItem("navelix.user.config", JSON.stringify(nextCfg));
      localStorage.setItem("navelix_theme", nextCfg.theme);
      localStorage.removeItem("theme");
    } catch (e) {
      console.warn("[Navelix] localStorage 操作失败", e);
    }
  }, []);

  // 3. 统一更新配置方法：即时触发 DOM 改变 + 存储 + 状态更新
  const updateConfig = useCallback(
    (patch: Partial<SystemConfig>) => {
      const next = { ...configRef.current, ...patch };
      configRef.current = next;
      setConfig(next);

      if (patch.theme) {
        applyThemeToDom(patch.theme);
        try {
          localStorage.setItem("navelix_theme", patch.theme);
        } catch {}
      }
      saveConfigToServer(next);
    },
    [saveConfigToServer, applyThemeToDom],
  );

  const resetConfig = useCallback(() => {
    updateConfig(defaultConfig);
  }, [updateConfig]);

  // 4. 数据加载 fallback
  const loadData = useCallback(() => {
    fetch("/api/user/data")
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("Not logged in");
      })
      .then((data) => {
        if (data.user) setUser(data.user);
        if (Array.isArray(data.categories)) setCategories(data.categories);
        if (Array.isArray(data.links)) setLinks(data.links);
        if (Array.isArray(data.projects)) setProjects(data.projects);
        if (data.config) {
          const localTheme = localStorage.getItem("navelix_theme");
          const activeTheme =
            localTheme === "light" || localTheme === "dark" || localTheme === "system"
              ? localTheme
              : data.config.theme;
          setConfig({ ...defaultConfig, ...data.config, theme: activeTheme });
          if (activeTheme) {
            applyThemeToDom(activeTheme);
          }
        }
        setHydrated(true);
      })
      .catch(() => {
        const cats = readJson<Category[]>("navelix.user.categories");
        const lnks = readJson<SiteLink[]>("navelix.user.links");
        const cfg = readJson<Partial<SystemConfig>>("navelix.user.config");
        const localTheme = localStorage.getItem("navelix_theme");

        if (cats) setCategories(cats);
        if (lnks) setLinks(lnks);
        if (cfg) {
          const activeTheme =
            localTheme === "light" || localTheme === "dark" || localTheme === "system"
              ? (localTheme as SystemConfig["theme"])
              : cfg.theme || "system";
          setConfig({ ...defaultConfig, ...cfg, theme: activeTheme });
          applyThemeToDom(activeTheme);
        } else if (localTheme) {
          setConfig((prev) => ({ ...prev, theme: localTheme as SystemConfig["theme"] }));
          applyThemeToDom(localTheme);
        }
        setHydrated(true);
      });
  }, [applyThemeToDom]);

  // 5. 挂载加载与跨标签页 Storage 同步
  useEffect(() => {
    if (typeof window !== "undefined") {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      setResolvedDark(media.matches);
      try {
        localStorage.removeItem("navelix.antigravity.auth.accounts");
        localStorage.removeItem("navelix.antigravity.auth.info");
      } catch {}
    }

    if (!initialData) {
      loadData();
    } else {
      const localTheme = localStorage.getItem("navelix_theme");
      if (localTheme && (localTheme === "light" || localTheme === "dark" || localTheme === "system")) {
        if (localTheme !== config.theme) {
          setConfig((prev) => ({ ...prev, theme: localTheme as SystemConfig["theme"] }));
        }
        applyThemeToDom(localTheme);
      } else {
        applyThemeToDom(config.theme);
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
      } else {
        loadData();
      }
    };

    window.addEventListener("storage", storageHandler);
    return () => window.removeEventListener("storage", storageHandler);
  }, [loadData, initialData, applyThemeToDom]);

  // 6. 系统主题变动监听器（当 config.theme === 'system' 时响应系统级浅色/深色切换）
  useEffect(() => {
    if (config.theme !== "system" || typeof window === "undefined") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = () => {
      applyThemeToDom("system");
    };

    media.addEventListener("change", handleSystemChange);
    return () => media.removeEventListener("change", handleSystemChange);
  }, [config.theme, applyThemeToDom]);

  // 7. 自定义站点标题（浏览器标签页）
  useEffect(() => {
    if (hydrated && config.siteTitle) {
      document.title = config.siteTitle;
    }
  }, [config.siteTitle, hydrated]);

  const saveToServer = useCallback(
    (nextCats: Category[], nextLinks: SiteLink[]) => {
      fetch("/api/user/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: nextCats, links: nextLinks }),
      })
        .then((res) => {
          if (!res.ok) {
            console.error("[Navelix] 保存配置至服务器失败 HTTP Status:", res.status);
          }
        })
        .catch((e) => console.warn("[Navelix] 保存失败", e));

      try {
        localStorage.setItem(
          "navelix.user.categories",
          JSON.stringify(nextCats),
        );
        localStorage.setItem("navelix.user.links", JSON.stringify(nextLinks));
      } catch (e) {
        console.warn("[Navelix] localStorage 操作失败", e);
      }
    },
    [],
  );

  const commitData = useCallback(
    (nextCats: Category[], nextLinks: SiteLink[]) => {
      categoriesRef.current = nextCats;
      linksRef.current = nextLinks;
      setCategories(nextCats);
      setLinks(nextLinks);
      saveToServer(nextCats, nextLinks);
    },
    [saveToServer],
  );

  const addCategory = useCallback(
    (name: string, icon: string) => {
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
        },
      ];
      commitData(nextCats, linksRef.current);
    },
    [commitData],
  );

  const deleteCategory = useCallback(
    (id: string) => {
      const nextCats = categoriesRef.current.filter((c) => c.id !== id);
      const nextLinks = linksRef.current.filter((l) => l.category !== id);
      commitData(nextCats, nextLinks);
    },
    [commitData],
  );

  const addLink = useCallback(
    (link: Omit<SiteLink, "id">) => {
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
      const nextLinks = linksRef.current.map((l) =>
        l.id === id ? { ...patch, id } : l,
      );
      commitData(categoriesRef.current, nextLinks);
    },
    [commitData],
  );

  const updateCategory = useCallback(
    (id: string, patch: { name: string; icon: string }) => {
      const nextCats = categoriesRef.current.map((c) =>
        c.id === id
          ? {
              ...c,
              name: patch.name.trim(),
              label: patch.name.trim().slice(0, 3),
              icon: patch.icon || c.icon,
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
    (cats: Category[], lnks: SiteLink[]) => {
      const catIdMap = new Map<string, string>();
      const nextCats = [...categoriesRef.current];

      cats.forEach((importedCat) => {
        const existing = nextCats.find(
          (c) =>
            c.name.trim().toLowerCase() === importedCat.name.trim().toLowerCase(),
        );
        if (existing) {
          catIdMap.set(importedCat.id, existing.id);
        } else {
          nextCats.push(importedCat);
          catIdMap.set(importedCat.id, importedCat.id);
        }
      });

      const existingUrls = new Set(
        linksRef.current.map((l) => l.url.toLowerCase()),
      );
      const remappedLinks = lnks
        .filter((l) => !existingUrls.has(l.url.toLowerCase()))
        .map((l) => ({
          ...l,
          category: catIdMap.get(l.category) || l.category,
        }));

      commitData(nextCats, [...linksRef.current, ...remappedLinks]);
    },
    [commitData],
  );

  const deleteAllLinks = useCallback(() => {
    commitData(categoriesRef.current, []);
  }, [commitData]);

  const saveProjects = useCallback((nextProjects: Project[]) => {
    setProjects(nextProjects);
    fetch("/api/user/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projects: nextProjects }),
    }).catch((e) => console.warn("[Navelix] 保存失败", e));
  }, []);

  const dataApi: NavelixDataApi = {
    user,
    categories,
    links,
    projects,
    hydrated,
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
  };

  return (
    <NavelixDataContext.Provider value={dataApi}>
      <NavelixConfigContext.Provider value={configApi}>
        {children}
      </NavelixConfigContext.Provider>
    </NavelixDataContext.Provider>
  );
}
