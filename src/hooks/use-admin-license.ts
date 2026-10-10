"use client";

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
  // ── License 授权状态 ──
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus>({
    isPro: false,
    isEE: true,
  });
  const [machineFingerprint, setMachineFingerprint] = useState("");
  const [licenseInput, setLicenseInput] = useState("");
  const [isActivatingLicense, setIsActivatingLicense] = useState(false);
  const [licenseModalOpen, setLicenseModalOpen] = useState(false);

  const fetchLicense = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/license");
      if (res.ok) {
        const data = await res.json();
        const parsed = parseLicenseStatus(data);
        if (parsed) {
          setLicenseStatus(parsed.status);
          if (parsed.machineFingerprint) {
            setMachineFingerprint(parsed.machineFingerprint);
          }
        }
      }
    } catch {}
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
    flash("已复制机器指纹到剪贴板");
  }, [machineFingerprint, flash]);

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
          flash("🎉 Navelix Pro 商业许可证激活成功！全站 Pro 特权已解锁。");
        } else {
          flash(outcome.message);
        }
      } catch {
        flash("❌ 激活请求失败，请检查网络");
      } finally {
        setIsActivatingLicense(false);
      }
    },
    [licenseInput, flash],
  );

  const removeLicense = useCallback(async () => {
    const okToRemove = await confirm({
      title: "注销许可证",
      message: "确定要注销当前商业许可证吗？系统将切回开源社区版。",
      confirmLabel: "注销",
    });
    if (!okToRemove) return;
    try {
      const res = await fetch("/api/admin/license", { method: "DELETE" });
      if (res.ok) {
        setLicenseStatus({ isPro: false });
        flash("已切换为开源社区版");
      }
    } catch {
      flash("注销失败");
    }
  }, [confirm, flash]);

  return {
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
