"use client";

import { useTranslations } from "next-intl";
import type { UseAdminCloudStorageResult } from "@/hooks/use-admin-cloud-storage";
import type { LicenseStatus } from "@/lib/admin-pro";
import type { CloudStorageConfig } from "@/lib/storage-provider";

/**
 * 「系统设置 → 系统功能」的卡片 2：S3 / WebDAV 异地备份与一键还原卡片。
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
  const tx = useTranslations();
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
            <span>{tx("s3_webdav_cloud_disaster_recovery_restore_91be10fc")}</span>
          </h3>
          <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
            {tx("supports_aws_s3_cloudflare_r2_alibaba_cloud_oss__7c54853a")}</p>
        </div>
        {licenseStatus.isPro ? (
          <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            {tx("pro_features_unlocked_7f4d075c")}</span>
        ) : (
          <button
            type="button"
            onClick={openLicenseModal}
            className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800 hover:opacity-80 transition-opacity cursor-pointer"
          >
            {tx("pro_feature_activate_49c38c86")}</button>
        )}
      </div>

      {!licenseStatus.isPro && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-3">
          <span>{tx("cloud_backups_and_cross_instance_restore_are_1a82addc")}<strong>Navelix Pro</strong> {tx("premium_features_after_activation_sqlite_snapsho_7c47fb50")}</span>
          <button
            type="button"
            onClick={openLicenseModal}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs shrink-0 cursor-pointer shadow-xs"
          >
            {tx("enter_license_key_a2deadce")}</button>
        </div>
      )}

      <div className={`space-y-5 ${!licenseStatus.isPro ? "opacity-60 pointer-events-none" : ""}`}>
        {/* 存储类型选择 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { id: "none", title: tx("disable_cloud_backups_30d4d59d"), desc: tx("keep_local_sqlite_snapshots_only_16419770") },
            { id: "s3", title: tx("s3_compatible_object_storage_9ffefb8a"), desc: "AWS S3 / Cloudflare R2 / OSS / COS / MinIO" },
            { id: "webdav", title: tx("webdav_bc1baf8b"), desc: tx("jianguoyun_synology_webdav_nextcloud_90669bcf") },
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
                label={tx("s3_endpoint_a670d6c5")}
                placeholder={tx("e_g_https_s3_us_east_1_amazonaws_com_or_an_r2_en_d0dc2ef4")}
                value={storageConfig.s3Endpoint || ""}
                onLocalChange={(v) => setStorageConfig({ ...storageConfig, s3Endpoint: v })}
                onSave={(v) => patchField({ s3Endpoint: v })}
              />
              <StorageField
                label={tx("bucket_name_34b55c08")}
                placeholder={tx("e_g_my_navelix_backups_cb508137")}
                value={storageConfig.s3Bucket || ""}
                onLocalChange={(v) => setStorageConfig({ ...storageConfig, s3Bucket: v })}
                onSave={(v) => patchField({ s3Bucket: v })}
              />
              <StorageField
                label={tx("access_key_id_6fbbcaa8")}
                placeholder="AKIAIOSFODNN7EXAMPLE"
                value={storageConfig.s3AccessKey || ""}
                onLocalChange={(v) => setStorageConfig({ ...storageConfig, s3AccessKey: v })}
                onSave={(v) => patchField({ s3AccessKey: v })}
              />
              <StorageField
                label={tx("secret_access_key_392433f0")}
                type="password"
                placeholder="••••••••••••••••"
                value={storageConfig.s3SecretKey || ""}
                onLocalChange={(v) => setStorageConfig({ ...storageConfig, s3SecretKey: v })}
                onSave={(v) => patchField({ s3SecretKey: v })}
              />
              <StorageField
                label={tx("region_optional_3884edca")}
                placeholder={tx("auto_or_us_east_1_398d9caf")}
                value={storageConfig.s3Region || ""}
                onLocalChange={(v) => setStorageConfig({ ...storageConfig, s3Region: v })}
                onSave={(v) => patchField({ s3Region: v })}
              />
              <StorageField
                label={tx("path_prefix_optional_44601e5d")}
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
                label={tx("webdav_server_url_09c0f891")}
                placeholder={tx("e_g_https_dav_jianguoyun_com_dav_navelix_backups_f725d7d2")}
                span2
                value={storageConfig.webdavUrl || ""}
                onLocalChange={(v) => setStorageConfig({ ...storageConfig, webdavUrl: v })}
                onSave={(v) => patchField({ webdavUrl: v })}
              />
              <StorageField
                label={tx("webdav_username_6b55598e")}
                placeholder={tx("username_or_email_70eadbef")}
                value={storageConfig.webdavUsername || ""}
                onLocalChange={(v) => setStorageConfig({ ...storageConfig, webdavUsername: v })}
                onSave={(v) => patchField({ webdavUsername: v })}
              />
              <StorageField
                label={tx("webdav_app_password_access_code_b49739fe")}
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
                {tx("automatically_create_a_snapshot_and_sync_to_clou_d6c0a435")}</label>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                disabled={storage.testingStorage}
                onClick={storage.testStorage}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-gray-200/80 dark:bg-slate-700 text-gray-800 dark:text-slate-200 hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors cursor-pointer"
              >
                {storage.testingStorage ? tx("testing_105a9082") : tx("test_connection_acb13f2a")}
              </button>

              <button
                type="button"
                disabled={storage.backingUpNow}
                onClick={storage.backupNow}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-600 text-white transition-colors cursor-pointer shadow-xs"
              >
                {storage.backingUpNow ? tx("uploading_backup_04980811") : tx("back_up_to_cloud_now_74b497de")}
              </button>

              <button
                type="button"
                onClick={storage.openRemoteBackupList}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-colors cursor-pointer shadow-xs"
              >
                {tx("cloud_snapshots_amp_restore_52508b2e")}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
