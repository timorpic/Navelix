"use client";

import { useText } from "@/hooks/use-text";
import { useTranslations } from "next-intl";
import { parseEEDriverStatus, type EEDriverStatus } from "@/lib/ee-driver-status";
import { useCallback, useEffect, useState } from "react";
import {
  buildLicenseActivationPayload,
  parseLicenseActivationResult,
  parseLicenseStatus,
  type LicenseStatus,
} from "@/lib/admin-pro";

/**
 * 管理后台「Pro 商业授权」Tab 的 License 状态：授权查询、激活与注销。
 *
 * 从 `admin-pro-tab.tsx`（原 1018 行）抽出 —— 该文件把商业授权、
 * S3 / WebDAV 云容灾备份、书签探针开关、品牌 LOGO 与代码注入五块
 * 互不相关的设置连同 13 个 useState 塞在一起。本 hook 只持有授权域的
 * 4 个 state 与两个接口调用；云存储见 `use-admin-cloud-storage`。
 * 提示与确认弹窗由调用方注入，以便两域共用同一个 Toast 与 ConfirmDialog。
 */

interface UseAdminLicenseOptions {
  /** 仅展示 UI 提示（来自 useToast） */
  flash: (msg: string) => void;
  /** Promise 风格的确认弹窗（来自 useConfirm） */
  confirm: (options: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
  }) => Promise<boolean>;
}

export interface UseAdminLicenseResult {
  driverStatus: EEDriverStatus | null;
  driverStatusLoading: boolean;
  driverStatusError: boolean;
  refreshStatus: () => Promise<void>;
  licenseStatus: LicenseStatus;
  machineFingerprint: string;
  licenseInput: string;
  setLicenseInput: (v: string) => void;
  isActivatingLicense: boolean;
  licenseModalOpen: boolean;
  openLicenseModal: () => void;
  closeLicenseModal: () => void;
  /** 复制机器指纹到剪贴板并提示 */
  copyFingerprint: () => void;
  /** 提交激活表单 */
  activateLicense: (e: React.FormEvent) => Promise<void>;
  /** 注销当前商业许可证（含二次确认） */
  removeLicense: () => Promise<void>;
}

export function useAdminLicense({
  flash,
  confirm,
}: UseAdminLicenseOptions): UseAdminLicenseResult {
  const tx = useTranslations();
  const text = useText();
  // ── License 授权状态 ──
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus>({
    isPro: false,
    isEE: false,
  });
  const [driverStatus, setDriverStatus] = useState<EEDriverStatus | null>(null);
  const [driverStatusLoading, setDriverStatusLoading] = useState(true);
  const [driverStatusError, setDriverStatusError] = useState(false);
  const [machineFingerprint, setMachineFingerprint] = useState("");
  const [licenseInput, setLicenseInput] = useState("");
  const [isActivatingLicense, setIsActivatingLicense] = useState(false);
  const [licenseModalOpen, setLicenseModalOpen] = useState(false);

  const fetchLicense = useCallback(async () => {
    setDriverStatusLoading(true);
    setDriverStatusError(false);
    try {
      const res = await fetch("/api/admin/license");
      if (res.ok) {
        const data = await res.json();
        const driver = parseEEDriverStatus(data.eeDriverStatus);
        setDriverStatus(driver);
        setDriverStatusError(!driver);
        const parsed = parseLicenseStatus(data);
        if (parsed) {
          setLicenseStatus(parsed.status);
          if (parsed.machineFingerprint) {
            setMachineFingerprint(parsed.machineFingerprint);
          }
        }
      } else { setDriverStatusError(true); }
    } catch { setDriverStatusError(true); }
    finally { setDriverStatusLoading(false); }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      fetchLicense();
    });
  }, [fetchLicense]);

  const openLicenseModal = useCallback(() => setLicenseModalOpen(true), []);
  const closeLicenseModal = useCallback(() => setLicenseModalOpen(false), []);

  const copyFingerprint = useCallback(() => {
    navigator.clipboard.writeText(machineFingerprint);
    flash(tx("instance_fingerprint_copied_to_clipboard_be17c988"));
  }, [machineFingerprint, flash, tx]);

  const activateLicense = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const payload = buildLicenseActivationPayload(licenseInput);
      if (!payload) return;
      setIsActivatingLicense(true);
      try {
        const res = await fetch("/api/admin/license", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        const outcome = parseLicenseActivationResult(res.ok, data);
        if (outcome.ok) {
          setLicenseStatus(outcome.status);
          setLicenseInput("");
          setLicenseModalOpen(false);
          flash(tx("navelix_pro_activated_pro_features_are_now_unloc_a8620536"));
        } else {
          flash(text(outcome.message));
        }
      } catch {
        flash(tx("activation_failed_check_your_connection_961f770f"));
      } finally {
        setIsActivatingLicense(false);
      }
    },
    [licenseInput, flash, tx, text],
  );

  const removeLicense = useCallback(async () => {
    const okToRemove = await confirm({
      title: tx("deactivate_license_7da4ac20"),
      message: tx("deactivate_this_license_licensed_pro_features_wi_a0ba8dc6"),
      confirmLabel: tx("deactivate_a48fa610"),
    });
    if (!okToRemove) return;
    try {
      const res = await fetch("/api/admin/license", { method: "DELETE" });
      if (res.ok) {
        setLicenseStatus(previous => ({ ...previous, isPro: false, payload: undefined, error: undefined }));
        flash(tx("license_deactivated_ae38ae38"));
      }
    } catch {
      flash(tx("deactivation_failed_130b4f7f"));
    }
  }, [confirm, flash, tx]);

  return {
    driverStatus, driverStatusLoading, driverStatusError, refreshStatus: fetchLicense,
    licenseStatus,
    machineFingerprint,
    licenseInput,
    setLicenseInput,
    isActivatingLicense,
    licenseModalOpen,
    openLicenseModal,
    closeLicenseModal,
    copyFingerprint,
    activateLicense,
    removeLicense,
  };
}
