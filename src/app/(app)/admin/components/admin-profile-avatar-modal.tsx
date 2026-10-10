"use client";

import Modal from "@/components/modal";
import AvatarPicker from "@/components/avatar-picker";
import type { UseAdminProfileAccountResult } from "@/hooks/use-admin-profile-account";

/**
 * 「个人账号与安全」Tab 的修改头像弹窗。
 *
 * 从 `admin-profile-tab.tsx`（原 1219 行）抽出 —— 弹窗的开关、草稿与保存
 * 全部来自 `useAdminProfileAccount()`，本组件只负责渲染。
 */
export default function AdminProfileAvatarModal({
  account,
}: {
  account: UseAdminProfileAccountResult;
}) {
  return (
    <Modal
      open={account.showAvatarModal}
      title="修改头像"
      onClose={account.closeAvatarModal}
    >
      <AvatarPicker
        value={account.avatarDraft}
        username={account.currentUser?.username}
        onChange={(v) => {
          account.setAvatarDraft(v);
          account.handleAvatarSave(v);
        }}
      />
      <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 dark:border-slate-700 pt-4">
        <button
          onClick={account.closeAvatarModal}
          className="h-9 rounded-lg px-4 text-xs font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer"
        >
          完成
        </button>
      </div>
    </Modal>
  );
}
