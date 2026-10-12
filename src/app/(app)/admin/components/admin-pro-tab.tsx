"use client";

import Toast from "@/components/toast";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ConfirmDialog from "@/components/confirm-dialog";
import { useAdminLicense } from "@/hooks/use-admin-license";
import AdminProMenuCard from "./admin-pro-menu-card";
import AdminProEEDriverCard from "./admin-pro-ee-driver-card";
import AdminProLicenseCard from "./admin-pro-license-card";
import AdminProLicenseModal from "./admin-pro-license-modal";

/**
 * 管理后台「Pro 商业授权」Tab 的组装层。
 *
 * 原文件 1018 行、13 个 useState，把商业授权（License 激活 / 注销）、
 * S3 / WebDAV 异地云容灾备份、书签探针开关、品牌 LOGO 与代码注入
 * 五块互不相关的设置曾挤在一个组件里。云容灾备份现归入系统设置独立菜单，
 * 本页只保留 Pro 菜单开关、商业授权与 EE 驱动诊断：
 *   - 状态与副作用 → `useAdminLicense`
 *   - 纯逻辑（响应解析、展示格式化）→ `@/lib/admin-pro`
 *   - 授权与驱动展示 → 同目录 `admin-pro-*-card.tsx` / `admin-pro-*-modal.tsx`
 * 本文件只保留 Toast / ConfirmDialog 与卡片编排。
 */
export default function AdminProTab() {
  // 提示保持原有 3200ms 时长（其余页面为默认 2800ms）
  const { notice, flash } = useToast(3200);
  const confirmDialog = useConfirm();

  const license = useAdminLicense({ flash, confirm: confirmDialog.confirm });

  return (
    <div className="space-y-6">
      <ConfirmDialog {...confirmDialog.dialogProps} />
      <Toast message={notice} />

      <AdminProMenuCard />

      {/* 卡片 1：💎 商业授权与 License 激活中心 */}
      <AdminProLicenseCard
        licenseStatus={license.licenseStatus}
        onRemoveLicense={license.removeLicense}
        onOpenLicenseModal={license.openLicenseModal}
      />

      <AdminProEEDriverCard status={license.driverStatus} loading={license.driverStatusLoading}
        error={license.driverStatusError} onRefresh={license.refreshStatus} />

      {/* 弹窗 1：💎 License 激活弹窗 */}
      {license.licenseModalOpen && <AdminProLicenseModal license={license} />}
    </div>
  );
}
