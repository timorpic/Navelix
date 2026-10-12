"use client";

import Toast from "@/components/toast";
import { useNavelixConfig } from "@/context/navelix-context";
import { useToast } from "@/hooks/use-toast";
import { useAdminProfileAccount } from "@/hooks/use-admin-profile-account";
import AdminProfileBasicsCard from "./admin-profile-basics-card";
import AdminProfileSessionsCard from "./admin-profile-sessions-card";
import AdminProfileTokensCard from "./admin-profile-tokens-card";
import AdminProfileAvatarModal from "./admin-profile-avatar-modal";
import AdminProfilePasswordModal from "./admin-profile-password-modal";

export default function AdminProfileTab({ section = "profile" }: { section?: "profile" | "account" }) {
  const { updateConfig } = useNavelixConfig();

  // Flash / notify helpers
  const { notice, flash, notify } = useToast();

  // 两块设置各自的状态与接口调用
  const account = useAdminProfileAccount({ flash, notify, updateConfig });

  return (
    <>
      <Toast message={notice} className="mb-4" />

      <div className="max-w-full space-y-6">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-sky-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            <span>{section === "profile" ? "个人资料" : "账号与安全"}</span>
          </h2>
          <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
            管理当前账号的资料与登录安全
          </p>
        </div>

        {section === "profile" ? <AdminProfileBasicsCard account={account} /> : (
          <div className="space-y-6">
            <button type="button" onClick={account.openChangePasswordModal} className="px-4 py-2 rounded-xl bg-emerald-600 text-white cursor-pointer">修改密码</button>
            <AdminProfileSessionsCard account={account} />
            <AdminProfileTokensCard account={account} />
          </div>
        )}
      </div>

      {/* Avatar Picker Modal */}
      <AdminProfileAvatarModal account={account} />

      {/* Dedicated Change Password Modal */}
      <AdminProfilePasswordModal account={account} />
    </>
  );
}
