"use client";

import React, { useEffect, useRef, useState } from "react";
import LogoMark from "@/components/logo-mark";
import { useNavelixConfig } from "@/hooks/use-navelix-config";
import { useNavelixData } from "@/hooks/use-navelix-data";
import { fileToDataUrl } from "@/lib/image-utils";
import { pushNotification } from "@/lib/notifications";
import { parseBookmarksHTML } from "@/lib/bookmarks";
import { parseSunPanelJSON } from "@/lib/sun-panel";
import type { Category, SiteLink } from "@/types";

interface UpdateCheckResult {
  local: {
    sourceSha: string | null;
    buildDate: string | null;
    version: string | null;
    isDockerBuild: boolean;
  };
  remote: { digest: string | null; lastUpdated: string | null; versionTag: string | null } | null;
  updateAvailable: boolean | null;
  error: string | null;
}

export default function AdminSystemTab() {
  const { config, updateConfig, resetConfig } = useNavelixConfig();
  const { categories, links, importData, mergeBookmarks, resetData } = useNavelixData();

  // ── Local state ──
  const dbRestoreFileRef = useRef<HTMLInputElement>(null);
  const [isRestoringDb, setIsRestoringDb] = useState(false);
  const [backupNotice, setBackupNotice] = useState("");

  const [isPurgingCache, setIsPurgingCache] = useState(false);
  const [purgeNotice, setPurgeNotice] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);
  const bookmarkFileRef = useRef<HTMLInputElement>(null);
  const sunPanelFileRef = useRef<HTMLInputElement>(null);

  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const autoCheckedUpdateRef = useRef(false);

  const [antigravitySecret, setAntigravitySecret] = useState("");
  const [antigravityConfigured, setAntigravityConfigured] = useState(false);
  const [savingAntigravitySecret, setSavingAntigravitySecret] = useState(false);
  const [antigravityNotice, setAntigravityNotice] = useState("");

  // ── Effect: 读取系统级配置状态（不返回密钥明文） ──
  useEffect(() => {
    fetch("/api/admin/system-settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.antigravityClientSecretConfigured === "boolean") {
          setAntigravityConfigured(data.antigravityClientSecretConfigured);
        }
      })
      .catch(() => {});
  }, []);

  // ── notify / flash helpers ──
    const [notice, setNotice] = useState("");
    const flash = (msg: string) => {
      setNotice(msg);
      window.setTimeout(() => setNotice(""), 2800);
    };
    const notify = (title: string, message: string) => {
      flash(message);
      pushNotification(title, message);
    };

  // ── Handler: Logo upload ──
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file, 128);
      updateConfig({ logoImage: dataUrl });
    } catch {
      flash("图片读取失败");
    }
    e.target.value = "";
  };

  // ── Handler: Download DB backup ──
  const handleDownloadDbBackup = () => {
    window.open("/api/admin/backup", "_blank");
    notify("数据库备份", "正在生成并下载数据库物理快照");
  };

  // ── Handler: Upload DB restore ──
  const handleUploadDbRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm("⚠️ 警告：恢复数据库将同步覆盖当前全量数据。确定要还原此数据库备份文件吗？")) {
      e.target.value = "";
      return;
    }
    setIsRestoringDb(true);
    setBackupNotice("正在还原数据库，请稍候...");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/backup", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (res.ok) {
        setBackupNotice("✅ " + (data.message || "数据库已成功还原"));
        notify("数据库还原", "数据还原成功，页面即将刷新");
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setBackupNotice("❌ " + (data.error || "还原失败"));
      }
    } catch {
      setBackupNotice("❌ 还原请求失败，请检查网络");
    } finally {
      setIsRestoringDb(false);
      e.target.value = "";
    }
  };

  // ── Handler: Purge cache ──
  const handlePurgeCache = async (target: "all" | "notifications" | "vacuum" = "all") => {
    setIsPurgingCache(true);
    setPurgeNotice("正在执行系统与存储清理...");
    try {
      const res = await fetch("/api/admin/cache-purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      });
      const data = await res.json();
      if (res.ok) {
        setPurgeNotice("✅ " + (data.message || "清理完成"));
        notify("系统运维", data.message || "清理完成");
      } else {
        setPurgeNotice("❌ " + (data.error || "清理失败"));
      }
    } catch {
      setPurgeNotice("❌ 清理失败");
    } finally {
      setIsPurgingCache(false);
      setTimeout(() => setPurgeNotice(""), 4000);
    }
  };

  // ── Handler: Clear notifications (7d+ old) ──
  const handleClearNotifications = async () => {
    try {
      const res = await fetch("/api/notifications", { method: "DELETE" });
      if (res.ok) {
        flash("操作记录已清空");
      } else {
        flash("清空失败");
      }
    } catch {
      flash("清空失败");
    }
  };

  // ── Handler: Reset default state ──
  const handleResetDefault = () => {
    if (confirm("确定要将所有分组、链接与系统个性化设置重置为初始状态吗？")) {
      resetData();
      resetConfig();
      notify("系统设置", "全量配置已成功重置");
    }
  };

  // ── Handler: Check update ──
  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    try {
      const res = await fetch("/api/update-check");
      const data = await res.json();
      setUpdateResult(data);
    } catch {
      setUpdateResult({
        local: { sourceSha: null, buildDate: null, version: null, isDockerBuild: false },
        remote: null,
        updateAvailable: null,
        error: "检查失败，请稍后重试",
      });
    } finally {
      setCheckingUpdate(false);
    }
  };

  // ── Handler: Save Antigravity OAuth client secret ──
  const handleSaveAntigravitySecret = async () => {
    setSavingAntigravitySecret(true);
    try {
      const res = await fetch("/api/admin/system-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ antigravityClientSecret: antigravitySecret }),
      });
      const data = await res.json();
      if (res.ok) {
        setAntigravityConfigured(Boolean(data.antigravityClientSecretConfigured));
        setAntigravitySecret("");
        setAntigravityNotice("✅ 反重力 OAuth 客户端密钥已保存");
        notify("系统设置", "反重力 OAuth 客户端密钥已保存");
      } else {
        setAntigravityNotice("❌ " + (data.error || "保存失败"));
      }
    } catch {
      setAntigravityNotice("❌ 保存失败");
    } finally {
      setSavingAntigravitySecret(false);
      setTimeout(() => setAntigravityNotice(""), 4000);
    }
  };

  // ── Handler: Export full Navelix JSON ──
  const handleExport = async () => {
    try {
      // 1. Fetch latest DB data
      const res = await fetch("/api/user/data");
      const dbData = res.ok ? await res.json() : {};

      const safeConfig = { ...(dbData.config || config) };
      delete safeConfig.aiApiKey;
      delete safeConfig.weatherApiKey;

      // 2. Collect local storage state
      let focusTracker = null;
      let quickNotes = null;
      let linkUsage = null;

      try {
        focusTracker = JSON.parse(localStorage.getItem("navelix.focus.tracker.v1") || "null");
      } catch { /* ignore */ }
      try {
        quickNotes = JSON.parse(localStorage.getItem("navelix.quick.notes") || "null");
      } catch { /* ignore */ }
      try {
        linkUsage = JSON.parse(localStorage.getItem("navelix.link.usage") || "null");
      } catch { /* ignore */ }

      const exportPayload = {
        version: "2.0",
        exportTime: new Date().toISOString(),
        categories: dbData.categories || categories,
        links: dbData.links || links,
        projects: dbData.projects || [],
        todos: dbData.todos || [],
        config: safeConfig,
        localStorageData: {
          focusTracker,
          quickNotes,
          linkUsage,
        },
      };

      const dataStr = JSON.stringify(exportPayload, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const timestamp = Math.floor(new Date().getTime());
      a.download = `navelix-full-backup-${timestamp}.json`;
      a.click();
      URL.revokeObjectURL(url);

      const projectCount = (dbData.projects || []).length;
      const todoCount = (dbData.todos || []).length;
      notify(
        "数据管理",
        `全量数据导出成功：包含 ${(dbData.links || links).length} 链接、${(dbData.categories || categories).length} 分组、${projectCount} 项目、${todoCount} 日程`,
      );
    } catch {
      flash("导出全量配置失败");
    }
  };

  // ── Handler: Import full Navelix JSON ──
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const cats: Category[] = Array.isArray(parsed.categories)
          ? parsed.categories.filter(
              (c: { id?: unknown; name?: unknown }) =>
                c && typeof c.id === "string" && typeof c.name === "string",
            )
          : [];
        const lnks: SiteLink[] = Array.isArray(parsed.links)
          ? parsed.links.filter(
              (l: { id?: unknown; title?: unknown; url?: unknown }) =>
                l &&
                typeof l.id === "string" &&
                typeof l.title === "string" &&
                typeof l.url === "string",
            )
          : [];
        const projs = Array.isArray(parsed.projects) ? parsed.projects : [];
        const tds = Array.isArray(parsed.todos) ? parsed.todos : [];

        const safeCfg = parsed.config ? { ...parsed.config } : undefined;
        if (safeCfg) {
          delete safeCfg.aiApiKey;
          delete safeCfg.weatherApiKey;
        }

        const saveRes = await fetch("/api/user/data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categories: cats,
            links: lnks,
            projects: projs,
            todos: tds,
            config: safeCfg,
          }),
        });

        if (!saveRes.ok) {
          throw new Error("保存数据到服务器失败");
        }

        if (parsed.localStorageData) {
          const ls = parsed.localStorageData;
          if (ls.focusTracker) {
            localStorage.setItem("navelix.focus.tracker.v1", JSON.stringify(ls.focusTracker));
          }
          if (ls.quickNotes) {
            localStorage.setItem("navelix.quick.notes", JSON.stringify(ls.quickNotes));
          }
          if (ls.linkUsage) {
            localStorage.setItem("navelix.link.usage", JSON.stringify(ls.linkUsage));
          }
        }

        if (safeCfg) {
          updateConfig(safeCfg);
        }
        importData(cats, lnks);

        notify(
          "数据管理",
          `全网全量配置导入成功：恢复 ${lnks.length} 链接、${cats.length} 分组、${projs.length} 项目、${tds.length} 日程`,
        );

        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } catch {
        flash("导入失败：无效或损坏的 JSON 配置文件");
      }
      if (fileRef.current) fileRef.current.value = "";
    };
    reader.readAsText(file);
  };

  // ── Handler: Bookmarks import ──
  const handleBookmarksImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { categories: cats, links: lnks } = parseBookmarksHTML(
          String(reader.result),
        );
        mergeBookmarks(cats, lnks);
        notify("数据管理", `书签导入成功：合并添加 ${lnks.length} 个链接`);
      } catch {
        flash("导入失败：无效的书签文件");
      }
      if (bookmarkFileRef.current) bookmarkFileRef.current.value = "";
    };
    reader.readAsText(file);
  };

  // ── Handler: Sun-Panel import ──
  const handleSunPanelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { categories: cats, links: lnks } = parseSunPanelJSON(
          String(reader.result),
        );
        mergeBookmarks(cats, lnks);
        notify(
          "数据管理",
          `☀️ Sun-Panel 配置导入成功：解析并合并导入 ${lnks.length} 个链接与 ${cats.length} 个分组`,
        );
      } catch {
        flash("导入失败：无效的 Sun-Panel JSON 文件");
      }
      if (sunPanelFileRef.current) sunPanelFileRef.current.value = "";
    };
    reader.readAsText(file);
  };

  // ── Auto-check update on mount ──
  useEffect(() => {
    if (autoCheckedUpdateRef.current) return;
    autoCheckedUpdateRef.current = true;
    let cancelled = false;
    fetch("/api/update-check")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setUpdateResult(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {notice && (
          <div className="lg:col-span-12 mb-4 rounded-xl border border-[#00C776]/30 bg-[#00C776]/10 px-4 py-2.5 text-xs font-semibold text-[#009a5a] shadow-2xs">
            {notice}
          </div>
        )}
        {/* 左栏：站点品牌、搜索引擎、访问控制策略、自定义脚本与样式 (6 cols) */}
      <div className="lg:col-span-6 space-y-6">
        {/* 块 1：站点标题、LOGO 显示文本内容与图标 */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
              <span>🏷️</span>
              <span>站点与品牌 LOGO</span>
            </h3>
            <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
              设置浏览器标签页标题及侧边栏与头部展示的品牌 LOGO 文本/图标
            </p>
          </div>
          <div className="space-y-3.5">
            <div>
              <label
                htmlFor="admin-site-title"
                className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1"
              >
                站点标题（浏览器标签页）
              </label>
              <input
                id="admin-site-title"
                name="siteTitle"
                type="text"
                value={config.siteTitle || ""}
                onChange={(e) => updateConfig({ siteTitle: e.target.value })}
                placeholder="Navelix · Personal Digital Hub"
                className="w-full h-9 border border-gray-200 dark:border-slate-700 rounded-lg px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label
                htmlFor="admin-logo"
                className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1"
              >
                LOGO 显示文本内容
              </label>
              <input
                id="admin-logo"
                name="logoText"
                type="text"
                value={config.logoText}
                onChange={(e) => updateConfig({ logoText: e.target.value })}
                placeholder="例如 Navelix"
                className="w-full h-9 border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-medium"
              />
              <p className="text-[10px] text-gray-400 dark:text-slate-400 mt-0.5">
                自定义侧边栏与头部等位置显示的品牌名称文本
              </p>
            </div>

            <div>
              <label
                htmlFor="admin-logo-upload"
                className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1"
              >
                LOGO 图标（可选）
              </label>
              <div className="flex items-center gap-3">
                <LogoMark size="md" />
                <input
                  id="admin-logo-upload"
                  type="file"
                  name="logo-upload"
                  accept="image/*"
                  aria-label="上传 LOGO 图片"
                  onChange={handleLogoUpload}
                  className="min-w-0 flex-1 text-xs text-gray-500 dark:text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#00C776]/10 file:text-[#009a5a] file:text-xs file:font-semibold file:cursor-pointer cursor-pointer"
                />
                {config.logoImage && (
                  <button
                    type="button"
                    onClick={() => updateConfig({ logoImage: "" })}
                    className="shrink-0 text-[11px] text-red-400 hover:text-red-600 cursor-pointer"
                  >
                    清除
                  </button>
                )}
              </div>
              <p className="text-[10px] text-gray-400 dark:text-slate-400 mt-0.5">
                支持 PNG / JPG / SVG，上传后替代默认字母 Logo，留空使用默认样式
              </p>
            </div>
          </div>
        </div>

        {/* 块 2：🔍 首页搜索栏（仅系统内搜索，无需配置搜索引擎） */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
              <span>🔍</span>
              <span>首页搜索栏</span>
            </h3>
            <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
              首页搜索仅限系统内（书签、日程、项目、消息），无需配置外部搜索引擎
            </p>
          </div>
          <div className="space-y-3.5">
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700">
              <div>
                <p className="text-xs font-bold text-gray-800 dark:text-slate-200">
                  搜索栏组件显示状态
                </p>
                <p className="text-[10px] text-gray-400 dark:text-slate-400 mt-0.5">
                  {config.showSearchBar ? "当前状态：已显示搜索栏" : "当前状态：已隐藏搜索栏"}
                </p>
              </div>
              <button
                id="admin-searchbar-toggle"
                type="button"
                onClick={() => updateConfig({ showSearchBar: !config.showSearchBar })}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  config.showSearchBar ? "bg-[#00C776] text-white" : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
                }`}
              >
                {config.showSearchBar ? "隐藏" : "显示"}
              </button>
            </div>
          </div>
        </div>

        {/* 块 3：🔒 访问控制与注册策略 */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
              <span>🔒</span>
              <span>访问与安全策略控制</span>
            </h3>
            <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
              管理未登录访客公开访问权限与新用户开放注册策略
            </p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700">
              <div>
                <p className="text-xs font-bold text-gray-800 dark:text-slate-200">
                  未登录访客公开访问主页
                </p>
                <p className="text-[10px] text-gray-400 dark:text-slate-400 mt-0.5">
                  {config.allowPublicAccess !== false
                    ? "开启：访客无需登录即可浏览导航主页（适合个人公开主页）"
                    : "关闭（私有模式）：未登录者访问首页将直接强制跳转登录页"}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  updateConfig({
                    allowPublicAccess: config.allowPublicAccess === false,
                    securitySetupDone: true,
                  })
                }
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  config.allowPublicAccess !== false
                    ? "bg-[#00C776] text-white"
                    : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
                }`}
              >
                {config.allowPublicAccess !== false ? "已开启" : "私有模式"}
              </button>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700">
              <div>
                <p className="text-xs font-bold text-gray-800 dark:text-slate-200">
                  开放新用户注册
                </p>
                <p className="text-[10px] text-gray-400 dark:text-slate-400 mt-0.5">
                  {config.allowRegistration !== false
                    ? "开启：任何人均可通过 /register 页面注册新账号"
                    : "关闭：禁止公网用户自主注册，仅管理员可在后台手动添加用户"}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  updateConfig({
                    allowRegistration: config.allowRegistration === false,
                    securitySetupDone: true,
                  })
                }
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  config.allowRegistration !== false
                    ? "bg-[#00C776] text-white"
                    : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
                }`}
              >
                {config.allowRegistration !== false ? "已开放" : "已关闭"}
              </button>
            </div>
          </div>
        </div>

        {/* 块 4：⚡ 自定义脚本与统计探针注入 */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
              <span>⚡</span>
              <span>自定义代码与统计探针注入</span>
            </h3>
            <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
              支持接入 Umami / Google Analytics / 百度统计探针及自定义全局 CSS
            </p>
          </div>
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
                自定义 HTML / 统计脚本代码 (如 &lt;script&gt; 统计探针)
              </label>
              <textarea
                name="customHeadScripts"
                rows={3}
                value={config.customHeadScripts || ""}
                onChange={(e) => updateConfig({ customHeadScripts: e.target.value })}
                placeholder="<!-- 粘贴 Umami / Google Analytics / 百度统计等探针代码 -->&#10;<script defer src='https://analytics.example.com/script.js' data-website-id='...'></script>"
                className="w-full border border-gray-200 dark:border-slate-700 rounded-lg p-2.5 text-xs font-mono bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
                自定义全局 CSS 样式
              </label>
              <textarea
                name="customCss"
                rows={3}
                value={config.customCss || ""}
                onChange={(e) => updateConfig({ customCss: e.target.value })}
                placeholder="/* 输入你想要覆盖的自定义 CSS 样式 */&#10;body { font-family: sans-serif; }"
                className="w-full border border-gray-200 dark:border-slate-700 rounded-lg p-2.5 text-xs font-mono bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 右栏：数据库快照备份与还原、数据导入导出、系统运维清理、链接巡检与版本更新 (6 cols) */}
      <div className="lg:col-span-6 space-y-6">
        {/* 块 5：💾 数据库物理快照与备份还原 */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-emerald-100 dark:border-emerald-950/80 shadow-2xs space-y-4 transition-colors">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
              <span>💾</span>
              <span>数据库物理快照与备份还原</span>
            </h3>
            <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
              一键下载当前 SQLite 数据库文件（.db），或上传历史快照无缝恢复全量数据
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="bg-emerald-50/40 dark:bg-emerald-950/30 rounded-2xl p-4 border border-emerald-200/60 dark:border-emerald-900/60 space-y-2.5 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                  <span>📥</span>
                  <span>下载 SQLite 数据库备份</span>
                </h4>
                <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-1 leading-relaxed">
                  在线无锁生成当前完整数据库物理文件（.db），换机、迁移或容灾备份首选。
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadDbBackup}
                className="w-full py-2 bg-[#00C776] hover:bg-[#009a5a] text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <span>📥</span>
                <span>下载数据库备份 (.db)</span>
              </button>
            </div>

            <div className="bg-gray-50/60 dark:bg-slate-900/40 rounded-2xl p-4 border border-gray-200 dark:border-slate-700 space-y-2.5 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <span>📤</span>
                  <span>上传还原数据库</span>
                </h4>
                <p className="text-[11px] text-gray-400 dark:text-slate-400 mt-1 leading-relaxed">
                  选择先前导出的 .db 文件一键还原（还原后自动重新校验数据库版本）。
                </p>
              </div>
              <input
                ref={dbRestoreFileRef}
                type="file"
                accept=".db,application/x-sqlite3"
                className="hidden"
                onChange={handleUploadDbRestore} name="dbRestoreFile"
              />
              <button
                type="button"
                disabled={isRestoringDb}
                onClick={() => dbRestoreFileRef.current?.click()}
                className="w-full py-2 bg-gray-900 dark:bg-slate-700 hover:bg-black dark:hover:bg-slate-600 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <span>📤</span>
                <span>{isRestoringDb ? "正在还原中..." : "选择 .db 备份并还原"}</span>
              </button>
            </div>
          </div>

          {backupNotice && (
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-900/80 border border-gray-200 dark:border-slate-700 text-xs font-semibold text-gray-800 dark:text-slate-200 animate-fadeIn">
              {backupNotice}
            </div>
          )}
        </div>

        {/* 块 6：📦 配置与数据导入导出 */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
              <span>📦</span>
              <span>配置与数据导入导出</span>
            </h3>
            <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
              支持一键导出 Navelix 全量配置，或从 Sun-Panel / Chrome HTML 书签导入数据
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Card 1: Sun-Panel JSON 兼容导入 */}
            <div className="bg-gray-50/50 dark:bg-slate-900/40 rounded-2xl p-4 border border-teal-100 dark:border-teal-900/60 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="text-base">☀️</span>
                <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                  导入 Sun-Panel 配置文件
                </h4>
              </div>
              <p className="text-[11px] text-gray-400 dark:text-slate-400 leading-relaxed">
                无缝兼容 Sun-Panel 导出的 JSON 配置文件，自动解析分类与网址并合并。
              </p>
              <input
                ref={sunPanelFileRef}
                type="file"
                name="sun-panel-file"
                accept=".json,application/json"
                aria-label="选择 Sun-Panel JSON 文件"
                className="hidden"
                onChange={handleSunPanelImport}
              />
              <button
                onClick={() => sunPanelFileRef.current?.click()}
                className="w-full py-1.5 bg-[#00C776] hover:bg-[#009a5a] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>☀️</span>
                <span>选择 JSON 文件</span>
              </button>
            </div>

            {/* Card 2: Chrome / 浏览器 HTML 书签导入 */}
            <div className="bg-gray-50/50 dark:bg-slate-900/40 rounded-2xl p-4 border border-gray-100 dark:border-slate-700 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="text-base">🌐</span>
                <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                  导入 Chrome / HTML 书签
                </h4>
              </div>
              <p className="text-[11px] text-gray-400 dark:text-slate-400 leading-relaxed">
                解析 Chrome、Edge 或 Safari 导出的 HTML 书签文件并智能归类。
              </p>
              <input
                ref={bookmarkFileRef}
                type="file"
                name="bookmark-file"
                accept=".html,text/html"
                aria-label="选择 HTML 书签文件"
                className="hidden"
                onChange={handleBookmarksImport}
              />
              <button
                onClick={() => bookmarkFileRef.current?.click()}
                className="w-full py-1.5 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-600 dark:text-sky-400 text-xs font-semibold rounded-xl border border-sky-200 dark:border-sky-900 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>🌐</span>
                <span>选择 HTML 文件</span>
              </button>
            </div>

            {/* Card 3: 导出全量 Navelix JSON */}
            <div className="bg-gray-50/50 dark:bg-slate-900/40 rounded-2xl p-4 border border-gray-100 dark:border-slate-700 space-y-2.5">
              <h4 className="text-xs font-bold text-gray-900 dark:text-white">导出全量配置 JSON</h4>
              <p className="text-[11px] text-gray-400 dark:text-slate-400 leading-relaxed">
                导出包含全量书签、分组与个性化外观在内的 Navelix JSON 文件。
              </p>
              <button
                onClick={handleExport}
                className="w-full py-1.5 bg-gray-900 dark:bg-slate-700 hover:bg-black dark:hover:bg-slate-600 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                导出 Navelix JSON
              </button>
            </div>

            {/* Card 4: 导入全量 Navelix JSON */}
            <div className="bg-gray-50/50 dark:bg-slate-900/40 rounded-2xl p-4 border border-gray-100 dark:border-slate-700 space-y-2.5">
              <h4 className="text-xs font-bold text-gray-900 dark:text-white">导入全量 Navelix JSON</h4>
              <p className="text-[11px] text-gray-400 dark:text-slate-400 leading-relaxed">
                选择 Navelix 导出的 JSON 文件一键还原书签与外观配置。
              </p>
              <input
                ref={fileRef}
                type="file"
                name="navelix-config-file"
                accept=".json,application/json"
                aria-label="选择 Navelix JSON 文件"
                className="hidden"
                onChange={handleImport}
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full py-1.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                选择 Navelix JSON
              </button>
            </div>
          </div>
        </div>

        {/* 块 7：🧹 缓存与系统存储清理 */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
              <span>🧹</span>
              <span>系统存储与缓存运维</span>
            </h3>
            <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
              一键清空过期的历史操作通知，执行 SQLite 数据库碎片整理与深度优化
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              disabled={isPurgingCache}
              onClick={() => handlePurgeCache("notifications")}
              className="px-3.5 py-2 rounded-xl bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
            >
              清空 7 天前已读操作日志
            </button>
            <button
              type="button"
              disabled={isPurgingCache}
              onClick={() => handlePurgeCache("vacuum")}
              className="px-3.5 py-2 rounded-xl bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
            >
              数据库 VACUUM 碎片整理
            </button>
            <button
              type="button"
              disabled={isPurgingCache}
              onClick={() => handlePurgeCache("all")}
              className="px-3.5 py-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
            >
              一键全量深度优化
            </button>
          </div>

          {purgeNotice && (
            <p className="text-xs font-medium text-teal-600 dark:text-teal-400 animate-fadeIn">
              {purgeNotice}
            </p>
          )}
        </div>

        {/* 块 8：🔗 链接状态检测与控制 */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
              <span>🔗</span>
              <span>链接状态检测</span>
            </h3>
            <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
              开启后系统在后台定时巡检所有网址书签的可访问性与在线状态
            </p>
          </div>

          <div className="space-y-3.5">
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700">
              <div>
                <p className="text-xs font-bold text-gray-800 dark:text-slate-200">
                  定时检测开关
                </p>
                <p className="text-[10px] text-gray-400 dark:text-slate-400 mt-0.5">
                  自动巡检书签响应状态
                </p>
              </div>
              <button
                onClick={() =>
                  updateConfig({
                    linkStatusEnabled: !config.linkStatusEnabled,
                  })
                }
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  config.linkStatusEnabled
                    ? "bg-[#00C776] text-white"
                    : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
                }`}
              >
                {config.linkStatusEnabled ? "已开启" : "已关闭"}
              </button>
            </div>

            <div>
              <label
                htmlFor="admin-link-status-interval"
                className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1"
              >
                检测时间间隔
              </label>
              <select
                id="admin-link-status-interval"
                name="linkStatusInterval"
                value={config.linkStatusInterval || 60}
                onChange={(e) =>
                  updateConfig({
                    linkStatusInterval: Number(e.target.value),
                  })
                }
                className="w-full h-9 border border-gray-200 dark:border-slate-700 rounded-lg px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
              >
                <option value={30}>每 30 秒</option>
                <option value={60}>每 60 秒（推荐）</option>
                <option value={120}>每 2 分钟</option>
                <option value={300}>每 5 分钟</option>
              </select>
            </div>

            <div className="pt-2 border-t border-gray-100 dark:border-slate-700/60 flex items-center gap-2">
              <button
                onClick={handleClearNotifications}
                className="px-3 py-1.5 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg text-xs font-semibold cursor-pointer"
              >
                清空操作记录
              </button>
              <button
                onClick={handleResetDefault}
                className="px-3 py-1.5 border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-lg text-xs font-semibold cursor-pointer"
              >
                重置默认状态
              </button>
            </div>
          </div>
        </div>

        {/* 块 9：🔐 反重力 OAuth 配置 */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
              <span>🔐</span>
              <span>反重力 OAuth 配置</span>
            </h3>
            <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
              模型账号监控面板授权反重力账号时使用的 Google OAuth 客户端密钥，保存在数据库中
            </p>
          </div>

          <div className="space-y-3.5">
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700">
              <div>
                <p className="text-xs font-bold text-gray-800 dark:text-slate-200">客户端密钥状态</p>
                <p className="text-[10px] text-gray-400 dark:text-slate-400 mt-0.5">
                  当前{antigravityConfigured ? "已配置（已隐藏，重新输入可覆盖）" : "未配置"}
                </p>
              </div>
              <span
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold ${
                  antigravityConfigured
                    ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400"
                    : "bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400"
                }`}
              >
                {antigravityConfigured ? "已配置" : "未配置"}
              </span>
            </div>

            <div>
              <label
                htmlFor="admin-antigravity-client-secret"
                className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1"
              >
                Google OAuth 客户端密钥
              </label>
              <input
                id="admin-antigravity-client-secret"
                type="password"
                value={antigravitySecret}
                onChange={(e) => setAntigravitySecret(e.target.value)}
                placeholder="粘贴 Client Secret（GOCSPX-…）"
                autoComplete="off"
                className="w-full h-9 border border-gray-200 dark:border-slate-700 rounded-lg px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={savingAntigravitySecret || !antigravitySecret.trim()}
                onClick={handleSaveAntigravitySecret}
                className="px-4 py-2 rounded-lg bg-[#14B8A6] hover:bg-[#0D9488] text-white text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                {savingAntigravitySecret ? "保存中…" : "保存密钥"}
              </button>
              {antigravityNotice && (
                <p className="text-xs font-medium text-teal-600 dark:text-teal-400">
                  {antigravityNotice}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 块 10：🔄 版本与更新 */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-2xs transition-colors">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🔄</span>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                版本与更新
              </h3>
              <p className="text-xs text-gray-400 dark:text-slate-400">
                对比 Docker Hub 的 latest 镜像，应用内自检更新
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleCheckUpdate}
              disabled={checkingUpdate}
              className="h-9 px-4 rounded-lg bg-[#14B8A6] hover:bg-[#0D9488] text-white text-xs font-semibold transition-colors disabled:opacity-60 cursor-pointer"
            >
              {checkingUpdate ? "检查中…" : "检查更新"}
            </button>
            {updateResult?.local?.isDockerBuild && (
              <span className="text-[11px] text-gray-400 dark:text-slate-400">
                当前版本：
                {updateResult.local.version
                  ? updateResult.local.version
                  : updateResult.local.sourceSha
                  ? updateResult.local.sourceSha.slice(0, 7)
                  : "unknown"}
                {updateResult.local.buildDate
                  ? ` · ${new Date(updateResult.local.buildDate).toLocaleString("zh-CN")}`
                  : ""}
              </span>
            )}
          </div>

          {updateResult && (
            <div className="mt-3">
              {updateResult.error && (
                <p className="text-xs text-red-500">{updateResult.error}</p>
              )}
              {!updateResult.error &&
                updateResult.updateAvailable === false && (
                  <p className="text-xs text-emerald-600">
                    ✅ 已是最新版本
                    {updateResult.remote?.versionTag
                      ? `（最新 ${updateResult.remote.versionTag}）`
                      : updateResult.remote?.lastUpdated
                      ? `（${new Date(updateResult.remote.lastUpdated).toLocaleString("zh-CN")} 构建）`
                      : ""}
                  </p>
                )}
              {!updateResult.error &&
                updateResult.updateAvailable === true && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 p-3">
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                      🚀 检测到新版本
                      {updateResult.remote?.versionTag
                        ? `（${updateResult.remote.versionTag}）`
                        : updateResult.remote?.lastUpdated
                        ? `（${new Date(updateResult.remote.lastUpdated).toLocaleString("zh-CN")}）`
                        : ""}
                    </p>
                    <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-500/80">
                      请拉取最新镜像并重启容器。
                    </p>
                  </div>
                )}
              {!updateResult.error &&
                updateResult.updateAvailable === null &&
                !updateResult.local.isDockerBuild && (
                  <p className="text-xs text-gray-400">
                    当前不是 Docker 构建（开发环境），无法对比版本。
                  </p>
                )}
              {!updateResult.error &&
                updateResult.updateAvailable === null &&
                updateResult.local.isDockerBuild && (
                  <p className="text-xs text-gray-400">
                    当前镜像为旧版本，缺少构建元数据，无法自动对比；请先升级到带自检能力的镜像后重试。
                  </p>
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}