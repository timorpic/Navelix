"use client";

import Toast from "@/components/toast";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ConfirmDialog from "@/components/confirm-dialog";
import { useAdminLicense } from "@/hooks/use-admin-license";
import { useAdminCloudStorage } from "@/hooks/use-admin-cloud-storage";
import AdminProLicenseCard from "./admin-pro-license-card";
import AdminProStorageCard from "./admin-pro-storage-card";
import AdminProLinkProbeCard from "./admin-pro-link-probe-card";
import AdminProBrandCard from "./admin-pro-brand-card";
import AdminProCodeInjectionCard from "./admin-pro-code-injection-card";
import AdminProLicenseModal from "./admin-pro-license-modal";
import AdminProBackupListModal from "./admin-pro-backup-list-modal";

/**
 * 管理后台「Pro 商业授权」Tab 的组装层。
 *
 * 原文件 1018 行、13 个 useState，把商业授权（License 激活 / 注销）、
 * S3 / WebDAV 异地云容灾备份、书签探针开关、品牌 LOGO 与代码注入
 * 五块互不相关的设置挤在一个组件里。现按功能域拆分：
 *   - 状态与副作用 → `useAdminLicense` / `useAdminCloudStorage`
 *   - 纯逻辑（响应解析、载荷组装、展示格式化）→ `@/lib/admin-pro`
 *   - 五张设置卡片 → 同目录 `admin-pro-*-card.tsx`，两个弹窗 → `admin-pro-*-modal.tsx`
 * 本文件只保留 Toast / ConfirmDialog 与卡片编排。
 */
export default function AdminProTab() {
  // 提示保持原有 3200ms 时长（其余页面为默认 2800ms）
  const { notice, flash } = useToast(3200);
  const confirmDialog = useConfirm();

  // 两块的接口调用共用同一个 Toast 与 ConfirmDialog，故由本层注入
  const license = useAdminLicense({ flash, confirm: confirmDialog.confirm });
  const storage = useAdminCloudStorage({ flash, confirm: confirmDialog.confirm });

  return (
    <div className="space-y-6">
      <ConfirmDialog {...confirmDialog.dialogProps} />
      <Toast message={notice} />

      {/* 卡片 1：💎 商业授权与 License 激活中心 */}
      <AdminProLicenseCard
        licenseStatus={license.licenseStatus}
        onRemoveLicense={license.removeLicense}
        onOpenLicenseModal={license.openLicenseModal}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* 卡片 2：💾 S3 / WebDAV 异地云容灾备份与一键还原 (12 cols) */}
        <AdminProStorageCard
          storage={storage}
          licenseStatus={license.licenseStatus}
          openLicenseModal={license.openLicenseModal}
        />

        {/* 卡片 3：🌐 书签实时网络延迟与存活探针 (6 cols) */}
        <AdminProLinkProbeCard
          licenseStatus={license.licenseStatus}
          onLockedClick={() => {
            license.openLicenseModal();
            flash("🔒 书签实时网络延迟与健康存活探针为 Pro 专享功能，请先激活 Pro 许可证");
          }}
        />

        {/* 卡片 4：🏷️ 站点与品牌 LOGO (6 cols) */}
        <AdminProBrandCard licenseStatus={license.licenseStatus} flash={flash} />

        {/* 卡片 5：⚡ 全局代码与统计探针注入 (12 cols) */}
        <AdminProCodeInjectionCard licenseStatus={license.licenseStatus} />
      </div>

      {/* 弹窗 1：💎 License 激活弹窗 */}
      {license.licenseModalOpen && <AdminProLicenseModal license={license} />}

      {/* 弹窗 2：📋 云端快照列表与一键还原弹窗 */}
      {storage.showBackupListModal && (
        <AdminProBackupListModal
          loading={storage.loadingBackups}
          backups={storage.remoteBackups}
          restoringFileName={storage.restoringFileName}
          onRestore={storage.restoreFromCloud}
          onClose={storage.closeBackupListModal}
        />
      )}
    </div>
  );
}
