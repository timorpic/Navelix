"use client";

import React, { useState, useEffect, useCallback } from "react";
import LogoMark from "@/components/logo-mark";
import BrandLogo from "@/components/brand-logo";
import { useNavelixConfig } from "@/hooks/use-navelix-config";
import { fileToDataUrl } from "@/lib/image-utils";
import type { CloudStorageConfig, RemoteBackupItem, StorageType } from "@/lib/storage-provider";

export default function AdminProTab() {
  const { config, updateConfig } = useNavelixConfig();

  const [notice, setNotice] = useState("");
  const flash = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(""), 3200);
  };

  // ═══════════════════════════════════════════════════════════════
  // 1. License 授权状态管理
  // ═══════════════════════════════════════════════════════════════
  const [licenseStatus, setLicenseStatus] = useState<{
    isPro: boolean;
    isEE?: boolean;
    isDockerBuild?: boolean;
    payload?: {
      licenseId: string;
      customer: string;
      email: string;
      plan: string;
      features: string[];
      expiresAt: number;
      maxSeats?: number;
      fingerprint?: string;
    };
    error?: string;
  }>({ isPro: false, isEE: true });

  const [machineFingerprint, setMachineFingerprint] = useState("");
  const [licenseInput, setLicenseInput] = useState("");
  const [isActivatingLicense, setIsActivatingLicense] = useState(false);
  const [licenseModalOpen, setLicenseModalOpen] = useState(false);

  const fetchLicense = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/license");
      if (res.ok) {
        const data = await res.json();
        setLicenseStatus(data);
        if (data.machineFingerprint) {
          setMachineFingerprint(data.machineFingerprint);
        }
      }
    } catch {}
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // 2. S3 / WebDAV 云存储配置与操作管理
  // ═══════════════════════════════════════════════════════════════
  const [storageConfig, setStorageConfig] = useState<CloudStorageConfig>({
    enabled: false,
    type: "none",
    s3Endpoint: "",
    s3Region: "us-east-1",
    s3Bucket: "",
    s3AccessKey: "",
    s3SecretKey: "",
    s3PathPrefix: "navelix-backups/",
    s3ForcePathStyle: false,
    webdavUrl: "",
    webdavUsername: "",
    webdavPassword: "",
    autoBackupDaily: true,
    keepCopies: 7,
  });

  const [testingStorage, setTestingStorage] = useState(false);
  const [savingStorage, setSavingStorage] = useState(false);
  const [backingUpNow, setBackingUpNow] = useState(false);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [remoteBackups, setRemoteBackups] = useState<RemoteBackupItem[]>([]);
  const [showBackupListModal, setShowBackupListModal] = useState(false);
  const [restoringFileName, setRestoringFileName] = useState<string | null>(null);

  const fetchStorageConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/storage");
      if (res.ok) {
        const data = await res.json();
        setStorageConfig((prev) => ({ ...prev, ...data }));
      }
    } catch {}
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      fetchLicense();
      fetchStorageConfig();
    });
  }, [fetchLicense, fetchStorageConfig]);

  const handleActivateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseInput.trim()) return;
    setIsActivatingLicense(true);
    try {
      const res = await fetch("/api/admin/license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey: licenseInput.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.isPro) {
        setLicenseStatus(data);
        setLicenseInput("");
        setLicenseModalOpen(false);
        flash("🎉 Navelix Pro 商业许可证激活成功！全站 Pro 特权已解锁。");
      } else {
        flash(`❌ 激活失败：${data.error || "许可证无效"}`);
      }
    } catch {
      flash("❌ 激活请求失败，请检查网络");
    } finally {
      setIsActivatingLicense(false);
    }
  };

  const handleRemoveLicense = async () => {
    if (!confirm("确定要注销当前商业许可证吗？系统将切回开源社区版。")) return;
    try {
      const res = await fetch("/api/admin/license", { method: "DELETE" });
      if (res.ok) {
        setLicenseStatus({ isPro: false });
        flash("已切换为开源社区版");
      }
    } catch {
      flash("注销失败");
    }
  };

  const handleSaveStorageConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingStorage(true);
    try {
      const res = await fetch("/api/admin/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(storageConfig),
      });
      const data = await res.json();
      if (res.ok) {
        flash(data.message || "云存储配置保存成功！");
      } else {
        flash(`❌ 保存失败: ${data.error}`);
      }
    } catch {
      flash("❌ 请求失败");
    } finally {
      setSavingStorage(false);
    }
  };

  const handleTestStorage = async () => {
    setTestingStorage(true);
    try {
      const res = await fetch("/api/admin/storage", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", tempConfig: storageConfig }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        flash(data.message || "🎉 连接测试成功！");
      } else {
        flash(`❌ 连通性测试失败: ${data.message || data.error}`);
      }
    } catch {
      flash("❌ 测试请求超时或失败");
    } finally {
      setTestingStorage(false);
    }
  };

  const handleBackupNow = async () => {
    setBackingUpNow(true);
    try {
      const res = await fetch("/api/admin/storage", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "backup_now", tempConfig: storageConfig }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        flash(data.message || "🎉 成功备份并上传至云存储！");
      } else {
        flash(`❌ 备份失败: ${data.error}`);
      }
    } catch {
      flash("❌ 备份请求失败");
    } finally {
      setBackingUpNow(false);
    }
  };

  const handleOpenRemoteBackupList = async () => {
    setShowBackupListModal(true);
    setLoadingBackups(true);
    try {
      const res = await fetch("/api/admin/storage", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list", tempConfig: storageConfig }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.backups)) {
        setRemoteBackups(data.backups);
      }
    } catch {
      flash("获取云端快照列表失败");
    } finally {
      setLoadingBackups(false);
    }
  };

  const handleRestoreFromCloud = async (fileName: string) => {
    if (!confirm(`⚠️ 确定要从云端快照【${fileName}】还原数据库吗？\n\n系统将自动创建本地回滚保护快照，并覆盖当前数据库。`)) {
      return;
    }
    setRestoringFileName(fileName);
    try {
      const res = await fetch("/api/admin/storage", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore", fileName, tempConfig: storageConfig }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert("🎉 数据库还原成功！系统将自动刷新页面。");
        window.location.reload();
      } else {
        flash(`❌ 还原失败: ${data.error}`);
      }
    } catch {
      flash("❌ 还原请求失败");
    } finally {
      setRestoringFileName(null);
    }
  };

  // ── Handler: Logo upload ──
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file, 128);
      updateConfig({ logoImage: dataUrl });
      flash("LOGO 图标已成功更新");
    } catch {
      flash("图片读取失败");
    }
    e.target.value = "";
  };

  return (
    <div className="space-y-6">
      {notice && (
        <div className="rounded-xl border border-[#00C776]/30 bg-[#00C776]/10 px-4 py-2.5 text-xs font-semibold text-[#009a5a] shadow-2xs animate-fadeIn">
          {notice}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          卡片 1：💎 商业授权与 License 激活中心
         ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-r from-emerald-50/80 via-white to-teal-50/60 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/90 rounded-3xl p-6 sm:p-7 border border-emerald-200/90 dark:border-emerald-500/30 shadow-sm dark:shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden transition-colors">
        <div className="flex items-start sm:items-center gap-4 z-10">
          <div className="w-14 h-14 rounded-2xl bg-white dark:bg-[#080B0F] border border-emerald-200/90 dark:border-emerald-500/30 p-2.5 flex items-center justify-center shrink-0 shadow-md ring-4 ring-emerald-500/15">
            <BrandLogo />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg font-black text-gray-900 dark:text-white tracking-wide">
                {licenseStatus.isPro
                  ? "Navelix Pro 商业版"
                  : licenseStatus.isDockerBuild
                  ? "Navelix 官方镜像版"
                  : "Navelix 源码开发版"}
              </h2>
              {licenseStatus.isPro ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 dark:bg-emerald-400/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-400/40 shadow-xs">
                  ✨ 已激活 · {licenseStatus.payload?.plan === "pro_lifetime" ? "终身买断" : "高级订阅"}
                </span>
              ) : licenseStatus.isDockerBuild ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-400/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-400/30">
                  免费版 (可激活 Pro)
                </span>
              ) : licenseStatus.isEE ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-400/20 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-400/30">
                  开发版 (已挂载 EE 驱动)
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 dark:bg-sky-400/20 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-400/30">
                  源码构建 (缺少驱动)
                </span>
              )}
            </div>
            <p className="text-xs text-gray-600 dark:text-slate-300/85 mt-1.5 leading-relaxed max-w-2xl">
              {licenseStatus.isPro
                ? `授权客户：${licenseStatus.payload?.customer} (${licenseStatus.payload?.email}) · 有效期：${
                    licenseStatus.payload?.expiresAt === 0
                      ? "永久有效 (Lifetime)"
                      : new Date(licenseStatus.payload?.expiresAt || 0).toLocaleDateString()
                  } · 席位配额：${licenseStatus.payload?.maxSeats || 1} 人`
                : "当前运行在免费开源模式。激活 Navelix Pro 许可证可解锁「S3 / WebDAV 异地容灾自动备份」、「书签卡片实时网络延迟与存活探针」、「全站品牌 LOGO 自定义」及「自定义 CSS / JS 探针注入」。"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 z-10 w-full md:w-auto">
          {licenseStatus.isPro ? (
            <button
              type="button"
              onClick={handleRemoveLicense}
              className="w-full md:w-auto px-4 py-2 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-white/10 dark:hover:bg-white/20 dark:text-slate-200 border border-gray-200 dark:border-white/15 transition-all cursor-pointer"
            >
              注销授权
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setLicenseModalOpen(true)}
              className="w-full md:w-auto px-5 py-2.5 rounded-xl text-xs font-black bg-[#00C776] hover:bg-[#00B068] text-white transition-all cursor-pointer shadow-lg hover:scale-[1.02] flex items-center justify-center gap-2"
            >
              <span>💎</span>
              <span>立即输入激活码解锁 Pro</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ═══════════════════════════════════════════════════════════════
            卡片 2：💾 S3 / WebDAV 异地云容灾备份与一键还原 (12 cols)
           ═══════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-12 bg-white dark:bg-slate-800/90 rounded-3xl p-6 sm:p-7 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-5 transition-colors relative overflow-hidden">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span>💾</span>
                <span>S3 / WebDAV 异地云容灾备份与一键还原</span>
              </h3>
              <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
                支持 AWS S3、Cloudflare R2、阿里云 OSS、腾讯云 COS、MinIO 及坚果云/群晖 WebDAV
              </p>
            </div>
            {licenseStatus.isPro ? (
              <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                ✨ PRO 功能已解锁
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setLicenseModalOpen(true)}
                className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800 hover:opacity-80 transition-opacity cursor-pointer"
              >
                🔒 PRO 功能 (点击激活)
              </button>
            )}
          </div>

          {!licenseStatus.isPro && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-3">
              <span>🔒 异地云备份与一键跨机还原为 <strong>Navelix Pro</strong> 高级特性。激活后系统可自动将 SQLite 快照加密同步至云端。</span>
              <button
                type="button"
                onClick={() => setLicenseModalOpen(true)}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs shrink-0 cursor-pointer shadow-xs"
              >
                输入激活码
              </button>
            </div>
          )}

          <form onSubmit={handleSaveStorageConfig} className={`space-y-5 ${!licenseStatus.isPro ? "opacity-60 pointer-events-none" : ""}`}>
            {/* 存储类型选择 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: "none", title: "🚫 关闭云备份", desc: "仅保留本地 SQLite 物理快照" },
                { id: "s3", title: "☁️ S3 兼容对象存储", desc: "AWS S3 / Cloudflare R2 / OSS / COS / MinIO" },
                { id: "webdav", title: "📂 WebDAV 协议", desc: "坚果云 / 群晖 WebDAV / Nextcloud" },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setStorageConfig({ ...storageConfig, type: item.id as StorageType, enabled: item.id !== "none" })}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    storageConfig.type === item.id
                      ? "border-[#00C776] bg-emerald-50/50 dark:bg-emerald-950/20 text-gray-900 dark:text-white ring-2 ring-[#00C776]/20"
                      : "border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/50 text-gray-600 dark:text-slate-400 hover:border-gray-300"
                  }`}
                >
                  <p className="font-bold text-xs">{item.title}</p>
                  <p className="text-[10px] text-gray-400 dark:text-slate-400 mt-1">{item.desc}</p>
                </button>
              ))}
            </div>

            {/* S3 表单配置 */}
            {storageConfig.type === "s3" && (
              <div className="p-4 sm:p-5 rounded-2xl bg-gray-50/80 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700 space-y-4 animate-fadeIn">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
                      S3 Endpoint (端点地址)
                    </label>
                    <input
                      type="text"
                      placeholder="例如 https://s3.us-east-1.amazonaws.com 或 R2 端点"
                      value={storageConfig.s3Endpoint || ""}
                      onChange={(e) => setStorageConfig({ ...storageConfig, s3Endpoint: e.target.value })}
                      className="w-full h-9 border border-gray-200 dark:border-slate-700 rounded-xl px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
                      Bucket (存储桶名称)
                    </label>
                    <input
                      type="text"
                      placeholder="例如 my-navelix-backups"
                      value={storageConfig.s3Bucket || ""}
                      onChange={(e) => setStorageConfig({ ...storageConfig, s3Bucket: e.target.value })}
                      className="w-full h-9 border border-gray-200 dark:border-slate-700 rounded-xl px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
                      Access Key ID (访问凭证)
                    </label>
                    <input
                      type="text"
                      placeholder="AKIAIOSFODNN7EXAMPLE"
                      value={storageConfig.s3AccessKey || ""}
                      onChange={(e) => setStorageConfig({ ...storageConfig, s3AccessKey: e.target.value })}
                      className="w-full h-9 border border-gray-200 dark:border-slate-700 rounded-xl px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
                      Secret Access Key (私密密钥)
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••••••••••"
                      value={storageConfig.s3SecretKey || ""}
                      onChange={(e) => setStorageConfig({ ...storageConfig, s3SecretKey: e.target.value })}
                      className="w-full h-9 border border-gray-200 dark:border-slate-700 rounded-xl px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
                      Region (区域，选填)
                    </label>
                    <input
                      type="text"
                      placeholder="auto 或 us-east-1"
                      value={storageConfig.s3Region || ""}
                      onChange={(e) => setStorageConfig({ ...storageConfig, s3Region: e.target.value })}
                      className="w-full h-9 border border-gray-200 dark:border-slate-700 rounded-xl px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
                      Path Prefix (路径前缀，选填)
                    </label>
                    <input
                      type="text"
                      placeholder="navelix-backups/"
                      value={storageConfig.s3PathPrefix || ""}
                      onChange={(e) => setStorageConfig({ ...storageConfig, s3PathPrefix: e.target.value })}
                      className="w-full h-9 border border-gray-200 dark:border-slate-700 rounded-xl px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* WebDAV 表单配置 */}
            {storageConfig.type === "webdav" && (
              <div className="p-4 sm:p-5 rounded-2xl bg-gray-50/80 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700 space-y-4 animate-fadeIn">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
                      WebDAV 服务器 URL
                    </label>
                    <input
                      type="text"
                      placeholder="例如 https://dav.jianguoyun.com/dav/navelix-backups/"
                      value={storageConfig.webdavUrl || ""}
                      onChange={(e) => setStorageConfig({ ...storageConfig, webdavUrl: e.target.value })}
                      className="w-full h-9 border border-gray-200 dark:border-slate-700 rounded-xl px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
                      WebDAV 登录用户名
                    </label>
                    <input
                      type="text"
                      placeholder="用户名或邮箱"
                      value={storageConfig.webdavUsername || ""}
                      onChange={(e) => setStorageConfig({ ...storageConfig, webdavUsername: e.target.value })}
                      className="w-full h-9 border border-gray-200 dark:border-slate-700 rounded-xl px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
                      WebDAV 应用密码 / 授权码
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••••••••••"
                      value={storageConfig.webdavPassword || ""}
                      onChange={(e) => setStorageConfig({ ...storageConfig, webdavPassword: e.target.value })}
                      className="w-full h-9 border border-gray-200 dark:border-slate-700 rounded-xl px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 自动化调度与操作栏 */}
            {storageConfig.type !== "none" && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-gray-50/50 dark:bg-slate-900/40 border border-gray-200/80 dark:border-slate-700/80">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="autoBackupDaily"
                    checked={storageConfig.autoBackupDaily ?? true}
                    onChange={(e) => setStorageConfig({ ...storageConfig, autoBackupDaily: e.target.checked })}
                    className="w-4 h-4 rounded text-[#00C776] focus:ring-[#00C776] cursor-pointer"
                  />
                  <label htmlFor="autoBackupDaily" className="text-xs font-bold text-gray-800 dark:text-slate-200 cursor-pointer">
                    每日凌晨自动创建加密快照并同步至云端
                  </label>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    type="button"
                    disabled={testingStorage}
                    onClick={handleTestStorage}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-gray-200/80 dark:bg-slate-700 text-gray-800 dark:text-slate-200 hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors cursor-pointer"
                  >
                    {testingStorage ? "测试中…" : "🔍 测试连通性"}
                  </button>

                  <button
                    type="button"
                    disabled={backingUpNow}
                    onClick={handleBackupNow}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-600 text-white transition-colors cursor-pointer shadow-xs"
                  >
                    {backingUpNow ? "备份上传中…" : "☁️ 立即备份到云端"}
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenRemoteBackupList}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-colors cursor-pointer shadow-xs"
                  >
                    📋 云端快照列表 &amp; 一键还原
                  </button>

                  <button
                    type="submit"
                    disabled={savingStorage}
                    className="px-4 py-1.5 rounded-xl text-xs font-bold bg-[#00C776] hover:bg-[#00B068] text-white transition-all cursor-pointer shadow-md"
                  >
                    {savingStorage ? "保存中…" : "💾 保存云配置"}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            卡片 3：🌐 书签实时网络延迟与存活探针 (6 cols)
           ═══════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-800/90 rounded-3xl p-6 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <span>🌐</span>
                <span>书签实时网络延迟与健康存活探针</span>
              </h3>
              <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
                实时测量卡片网络响应延迟并以绿/黄/红状态灯展示
              </p>
            </div>
            {licenseStatus.isPro ? (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0">
                ✨ 已激活
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800 shrink-0">
                🔒 PRO 特权
              </span>
            )}
          </div>

          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-800 dark:text-slate-200">
                    开启书签实时网络延迟与健康状态灯
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-slate-400 mt-0.5">
                    在前台书签卡片右上角显示实时网络响应速度（如 🟢 24ms / 🟡 450ms / 🔴 离线）
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!licenseStatus.isPro) {
                      setLicenseModalOpen(true);
                      flash("🔒 书签实时网络延迟与健康存活探针为 Pro 专享功能，请先激活 Pro 许可证");
                      return;
                    }
                    updateConfig({ linkStatusEnabled: !config.linkStatusEnabled });
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    licenseStatus.isPro && config.linkStatusEnabled
                      ? "bg-[#00C776] text-white"
                      : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
                  }`}
                >
                  {licenseStatus.isPro && config.linkStatusEnabled ? "已开启" : "已关闭"}
                </button>
              </div>

              <div className="pt-2 border-t border-gray-200/60 dark:border-slate-800 flex items-center justify-between text-xs text-gray-600 dark:text-slate-400">
                <span>探测响应分级基准：</span>
                <div className="flex items-center gap-2 text-[11px] font-mono">
                  <span className="text-emerald-600 dark:text-emerald-400">🟢 &lt;350ms (极速)</span>
                  <span className="text-amber-500">🟡 350~1500ms</span>
                  <span className="text-rose-500">🔴 超时/离线</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            卡片 4：🏷️ 站点与品牌 LOGO (6 cols)
           ═══════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-800/90 rounded-3xl p-6 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <span>🏷️</span>
                <span>全站品牌与 LOGO 自定义</span>
              </h3>
              <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
                设置浏览器标签页标题及侧边栏展示的品牌 LOGO 文本/图标
              </p>
            </div>
            {licenseStatus.isPro ? (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0">
                ✨ 已解锁
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800 shrink-0">
                🔒 PRO 功能
              </span>
            )}
          </div>

          <div className={`space-y-3.5 ${!licenseStatus.isPro ? "opacity-60 pointer-events-none" : ""}`}>
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
                站点标题（浏览器标签页）
              </label>
              <input
                type="text"
                disabled={!licenseStatus.isPro}
                value={config.siteTitle || ""}
                onChange={(e) => updateConfig({ siteTitle: e.target.value })}
                placeholder="Navelix · Personal Digital Hub"
                className="w-full h-9 border border-gray-200 dark:border-slate-700 rounded-xl px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
                LOGO 显示文本内容
              </label>
              <input
                type="text"
                disabled={!licenseStatus.isPro}
                value={config.logoText}
                onChange={(e) => updateConfig({ logoText: e.target.value })}
                placeholder="例如 Navelix"
                className="w-full h-9 border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-medium rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
                LOGO 图标上传
              </label>
              <div className="flex items-center gap-3">
                <LogoMark size="md" />
                <input
                  type="file"
                  accept="image/*"
                  disabled={!licenseStatus.isPro}
                  onChange={handleLogoUpload}
                  className="min-w-0 flex-1 text-xs text-gray-500 dark:text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-[#00C776]/10 file:text-[#009a5a] file:text-xs file:font-semibold file:cursor-pointer cursor-pointer"
                />
                {config.logoImage && (
                  <button
                    type="button"
                    disabled={!licenseStatus.isPro}
                    onClick={() => updateConfig({ logoImage: "" })}
                    className="shrink-0 text-xs text-rose-500 hover:text-rose-600 cursor-pointer"
                  >
                    清除
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            卡片 5：⚡ 全局代码与统计探针注入 (12 cols)
           ═══════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-12 bg-white dark:bg-slate-800/90 rounded-3xl p-6 sm:p-7 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <span>⚡</span>
                <span>自定义代码与统计探针注入</span>
              </h3>
              <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
                支持接入 Umami / Google Analytics / 百度统计探针及自定义全局 CSS 样式
              </p>
            </div>
            {licenseStatus.isPro ? (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0">
                ✨ 已解锁
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800 shrink-0">
                🔒 PRO 功能
              </span>
            )}
          </div>

          <div className={`space-y-4 ${!licenseStatus.isPro ? "opacity-60 pointer-events-none" : ""}`}>
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
                自定义 HTML / 统计脚本代码 (如 &lt;script&gt; 统计探针)
              </label>
              <textarea
                rows={3}
                disabled={!licenseStatus.isPro}
                value={config.customHeadScripts || ""}
                onChange={(e) => updateConfig({ customHeadScripts: e.target.value })}
                placeholder="<!-- 粘贴 Umami / Google Analytics / 百度统计等探针代码 -->&#10;<script defer src='https://analytics.example.com/script.js' data-website-id='...'></script>"
                className="w-full border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-xs font-mono bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
                自定义全局 CSS 样式
              </label>
              <textarea
                rows={3}
                disabled={!licenseStatus.isPro}
                value={config.customCss || ""}
                onChange={(e) => updateConfig({ customCss: e.target.value })}
                placeholder="/* 输入你想要覆盖的自定义 CSS 样式 */&#10;body { font-family: sans-serif; }"
                className="w-full border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-xs font-mono bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          弹窗 1：💎 License 激活弹窗
         ═══════════════════════════════════════════════════════════════ */}
      {licenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-gray-100 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white dark:bg-[#080B0F] border border-emerald-200/90 dark:border-emerald-500/30 p-2 flex items-center justify-center shrink-0 shadow-sm ring-2 ring-emerald-500/20">
                  <BrandLogo />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    激活 Navelix Pro 高级功能
                  </h3>
                  <p className="text-xs text-gray-400 dark:text-slate-400">
                    输入您购买的 License Key 离线激活
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLicenseModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-400 hover:text-gray-700 dark:hover:text-white flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleActivateLicense} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-slate-800/90 border border-gray-200/80 dark:border-slate-700 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
                    <span>🆔</span>
                    <span>本机安装指纹 (Instance Fingerprint)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(machineFingerprint);
                      flash("已复制机器指纹到剪贴板");
                    }}
                    className="text-[11px] text-[#00C776] hover:underline font-bold cursor-pointer"
                  >
                    一键复制指纹
                  </button>
                </div>
                <div className="font-mono text-xs font-black text-gray-900 dark:text-white bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-gray-200 dark:border-slate-800 break-all select-all tracking-wider text-center">
                  {machineFingerprint || "正在计算中…"}
                </div>
                <p className="text-[10px] text-gray-400 dark:text-slate-400 leading-normal">
                  💡 获取 Pro 专属授权码时，请提供上述安装指纹。签发的密钥将与您的专属实例绑定。
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1.5">
                  商业许可证密钥 (License Key)
                </label>
                <textarea
                  rows={3}
                  required
                  value={licenseInput}
                  onChange={(e) => setLicenseInput(e.target.value)}
                  placeholder="请粘贴格式如 eyJsaWNlbnNl... 的完整 License Key 字符串"
                  className="w-full border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-xs font-mono bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00C776]/50"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/60 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <span>🛡️</span> 离线非对称密码学验签保障
                </p>
                <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 leading-relaxed">
                  Navelix 采用 Ed25519 纯离线公钥验签，验证过程无需联网、零数据上报，完全保障私有化数据隐私。
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setLicenseModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isActivatingLicense || !licenseInput.trim()}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#00C776] hover:bg-[#00B068] rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-md"
                >
                  {isActivatingLicense ? "验签激活中…" : "立即激活 Pro"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          弹窗 2：📋 云端快照列表与一键还原弹窗
         ═══════════════════════════════════════════════════════════════ */}
      {showBackupListModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl border border-gray-100 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center text-xl font-bold">
                  ☁️
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    云端物理快照列表与一键还原
                  </h3>
                  <p className="text-xs text-gray-400 dark:text-slate-400">
                    可随时拉取历史备份覆盖还原，还原前系统将自动生成安全回滚快照
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBackupListModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-400 hover:text-gray-700 dark:hover:text-white flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2.5">
              {loadingBackups ? (
                <div className="py-8 text-center text-xs text-gray-400 animate-pulse">正在连接远程存储检索快照列表中…</div>
              ) : remoteBackups.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">云存储中暂无历史备份快照</div>
              ) : (
                remoteBackups.map((b) => (
                  <div
                    key={b.name}
                    className="p-3.5 rounded-2xl bg-gray-50 dark:bg-slate-800/80 border border-gray-200/80 dark:border-slate-700 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-xs font-bold text-gray-900 dark:text-white font-mono">{b.name}</p>
                      <p className="text-[11px] text-gray-400 dark:text-slate-400 mt-0.5">
                        大小：{(b.size / 1024).toFixed(1)} KB · 备份时间：{new Date(b.lastModified).toLocaleString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={restoringFileName === b.name}
                      onClick={() => handleRestoreFromCloud(b.name)}
                      className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-bold text-xs shrink-0 cursor-pointer shadow-xs transition-colors disabled:opacity-50"
                    >
                      {restoringFileName === b.name ? "正在还原中…" : "🔄 一键还原"}
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowBackupListModal(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
