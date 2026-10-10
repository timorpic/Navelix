"use client";

import type { UseAdminCloudStorageResult } from "@/hooks/use-admin-cloud-storage";
import type { LicenseStatus } from "@/lib/admin-pro";
import type { CloudStorageConfig } from "@/lib/storage-provider";

/**
 * 「Pro 商业授权」Tab 的卡片 2：💾 S3 / WebDAV 异地云容灾备份与一键还原。
 *
 * 从 `admin-pro-tab.tsx`（原 1018 行）抽出 —— 该文件把商业授权、云存储备份、
 * 书签探针、品牌 LOGO 与代码注入五块设置塞在一起。本组件只负责渲染：
 * 存储类型选择、S3 / WebDAV 表单与调度操作栏；配置状态与四个接口调用
 * 全部来自 `useAdminCloudStorage()`，未激活时的降级遮罩仍由父组件保留。
 */

/** S3 / WebDAV 表单里的单个受控输入（失焦即保存整份配置）。 */
function StorageField({
  label,
  placeholder,
  type = "text",
  value,
  onLocalChange,
  onSave,
  span2 = false,
}: {
  label: string;
  placeholder: string;
  type?: "text" | "password";
  value: string;
  /** 输入时只更新本地 state */
  onLocalChange: (v: string) => void;
  /** 失焦时提交整份配置 */
  onSave: (v: string) => void;
  span2?: boolean;
}) {
  return (
    <div className={span2 ? "sm:col-span-2" : undefined}>
      <label className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
        {label}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onLocalChange(e.target.value)}
        onBlur={(e) => onSave(e.target.value)}
        className="w-full h-9 border border-gray-200 dark:border-slate-700 rounded-xl px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
      />
    </div>
  );
}

export default function AdminProStorageCard({
  storage,
  licenseStatus,
  openLicenseModal,
}: {
  storage: UseAdminCloudStorageResult;
  licenseStatus: LicenseStatus;
  /** 未激活时各处「点击激活」统一打开授权弹窗 */
  openLicenseModal: () => void;
}) {
  const { storageConfig, setStorageConfig, saveStorageConfig } = storage;

  // 输入框：本地更新 + 失焦保存（原实现为每个字段各写一遍的同一段逻辑）
  const patchField = (patch: Partial<CloudStorageConfig>) => {
    const next = { ...storageConfig, ...patch };
    setStorageConfig(next);
    saveStorageConfig(next);
  };

  return (
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
            onClick={openLicenseModal}
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
            onClick={openLicenseModal}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs shrink-0 cursor-pointer shadow-xs"
          >
            输入激活码
          </button>
        </div>
      )}

      <div className={`space-y-5 ${!licenseStatus.isPro ? "opacity-60 pointer-events-none" : ""}`}>
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
              onClick={() => storage.selectStorageType(item.id)}
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
              <StorageField
                label="S3 Endpoint (端点地址)"
                placeholder="例如 https://s3.us-east-1.amazonaws.com 或 R2 端点"
                value={storageConfig.s3Endpoint || ""}
                onLocalChange={(v) => setStorageConfig({ ...storageConfig, s3Endpoint: v })}
                onSave={(v) => patchField({ s3Endpoint: v })}
              />
              <StorageField
                label="Bucket (存储桶名称)"
                placeholder="例如 my-navelix-backups"
                value={storageConfig.s3Bucket || ""}
                onLocalChange={(v) => setStorageConfig({ ...storageConfig, s3Bucket: v })}
                onSave={(v) => patchField({ s3Bucket: v })}
              />
              <StorageField
                label="Access Key ID (访问凭证)"
                placeholder="AKIAIOSFODNN7EXAMPLE"
                value={storageConfig.s3AccessKey || ""}
                onLocalChange={(v) => setStorageConfig({ ...storageConfig, s3AccessKey: v })}
                onSave={(v) => patchField({ s3AccessKey: v })}
              />
              <StorageField
                label="Secret Access Key (私密密钥)"
                type="password"
                placeholder="••••••••••••••••"
                value={storageConfig.s3SecretKey || ""}
                onLocalChange={(v) => setStorageConfig({ ...storageConfig, s3SecretKey: v })}
                onSave={(v) => patchField({ s3SecretKey: v })}
              />
              <StorageField
                label="Region (区域，选填)"
                placeholder="auto 或 us-east-1"
                value={storageConfig.s3Region || ""}
                onLocalChange={(v) => setStorageConfig({ ...storageConfig, s3Region: v })}
                onSave={(v) => patchField({ s3Region: v })}
              />
              <StorageField
                label="Path Prefix (路径前缀，选填)"
                placeholder="navelix-backups/"
                value={storageConfig.s3PathPrefix || ""}
                onLocalChange={(v) => setStorageConfig({ ...storageConfig, s3PathPrefix: v })}
                onSave={(v) => patchField({ s3PathPrefix: v })}
              />
            </div>
          </div>
        )}

        {/* WebDAV 表单配置 */}
        {storageConfig.type === "webdav" && (
          <div className="p-4 sm:p-5 rounded-2xl bg-gray-50/80 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700 space-y-4 animate-fadeIn">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <StorageField
                label="WebDAV 服务器 URL"
                placeholder="例如 https://dav.jianguoyun.com/dav/navelix-backups/"
                span2
                value={storageConfig.webdavUrl || ""}
                onLocalChange={(v) => setStorageConfig({ ...storageConfig, webdavUrl: v })}
                onSave={(v) => patchField({ webdavUrl: v })}
              />
              <StorageField
                label="WebDAV 登录用户名"
                placeholder="用户名或邮箱"
                value={storageConfig.webdavUsername || ""}
                onLocalChange={(v) => setStorageConfig({ ...storageConfig, webdavUsername: v })}
                onSave={(v) => patchField({ webdavUsername: v })}
              />
              <StorageField
                label="WebDAV 应用密码 / 授权码"
                type="password"
                placeholder="••••••••••••••••"
                value={storageConfig.webdavPassword || ""}
                onLocalChange={(v) => setStorageConfig({ ...storageConfig, webdavPassword: v })}
                onSave={(v) => patchField({ webdavPassword: v })}
              />
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
                onChange={(e) => patchField({ autoBackupDaily: e.target.checked })}
                className="w-4 h-4 rounded text-[#00C776] focus:ring-[#00C776] cursor-pointer"
              />
              <label htmlFor="autoBackupDaily" className="text-xs font-bold text-gray-800 dark:text-slate-200 cursor-pointer">
                每日凌晨自动创建加密快照并同步至云端
              </label>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                disabled={storage.testingStorage}
                onClick={storage.testStorage}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-gray-200/80 dark:bg-slate-700 text-gray-800 dark:text-slate-200 hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors cursor-pointer"
              >
                {storage.testingStorage ? "测试中…" : "🔍 测试连通性"}
              </button>

              <button
                type="button"
                disabled={storage.backingUpNow}
                onClick={storage.backupNow}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-600 text-white transition-colors cursor-pointer shadow-xs"
              >
                {storage.backingUpNow ? "备份上传中…" : "☁️ 立即备份到云端"}
              </button>

              <button
                type="button"
                onClick={storage.openRemoteBackupList}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-colors cursor-pointer shadow-xs"
              >
                📋 云端快照列表 &amp; 一键还原
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
