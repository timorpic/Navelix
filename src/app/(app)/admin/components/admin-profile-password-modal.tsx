"use client";

import { useTranslations } from "next-intl";
import Modal from "@/components/modal";
import { profileNoticeColor } from "@/lib/admin-profile";
import type { UseAdminProfileAccountResult } from "@/hooks/use-admin-profile-account";

/**
 * 「个人账号与安全」Tab 的修改登录密码弹窗。
 *
 * 从 `admin-profile-tab.tsx`（原 1219 行）抽出 —— 三个密码输入框、
 * 提示与提交逻辑全部来自 `useAdminProfileAccount()`，本组件只负责渲染。
 */
export default function AdminProfilePasswordModal({
  account,
}: {
  account: UseAdminProfileAccountResult;
}) {
  const tx = useTranslations();
  return (
    <Modal
      open={account.showChangePasswordModal}
      title={tx("change_password_ffa5f1e3")}
      onClose={account.closeChangePasswordModal}
    >
      <form onSubmit={account.handleModalPasswordSave} className="space-y-4">
        <div>
          <label htmlFor="modal-old-pwd" className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
            {tx("current_password_7de88f44")}</label>
          <input
            id="modal-old-pwd"
            name="oldPassword"
            type="password"
            autoComplete="current-password"
            value={account.modalOldPassword}
            onChange={(e) => account.setModalOldPassword(e.target.value)}
            placeholder={tx("enter_your_current_password_af9bfad9")}
            required
            className="w-full h-9 rounded-xl border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand/40 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="modal-new-pwd" className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
            {tx("new_password_at_least_6_characters_f095535c")}</label>
          <input
            id="modal-new-pwd"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            value={account.modalNewPassword}
            onChange={(e) => account.setModalNewPassword(e.target.value)}
            placeholder={tx("enter_a_new_password_at_least_6_characters_99c74898")}
            required
            className="w-full h-9 rounded-xl border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand/40 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="modal-confirm-pwd" className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
            {tx("confirm_new_password_1875f29f")}</label>
          <input
            id="modal-confirm-pwd"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={account.modalConfirmPassword}
            onChange={(e) => account.setModalConfirmPassword(e.target.value)}
            placeholder={tx("enter_the_new_password_again_322ded8b")}
            required
            className="w-full h-9 rounded-xl border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand/40 focus:outline-none"
          />
        </div>

        {account.modalPasswordNotice && (
          <p className="text-xs font-semibold pt-1" style={{ color: profileNoticeColor(account.modalPasswordNotice) }}>
            {account.modalPasswordNotice}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 dark:border-slate-700 pt-4">
          <button
            type="button"
            onClick={account.closeChangePasswordModal}
            className="h-9 rounded-lg px-4 text-xs font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer"
          >
            {tx("cancel_2cd0f3be")}</button>
          <button
            type="submit"
            className="h-9 rounded-lg bg-brand hover:bg-brand-strong px-5 text-xs font-bold text-white transition-colors cursor-pointer shadow-xs"
          >
            {tx("confirm_password_change_e9713ad6")}</button>
        </div>
      </form>
    </Modal>
  );
}
