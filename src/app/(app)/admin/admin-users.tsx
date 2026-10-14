"use client";
import { useLocale } from "next-intl";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import Modal from "@/components/modal";
import ConfirmDialog from "@/components/confirm-dialog";
import Toast from "@/components/toast";
import { useNavelixData } from "@/context/navelix-context";
import { useAdminUserStatus } from "@/hooks/use-admin-user-status";
import { useToast } from "@/hooks/use-toast";

interface ManagedUser {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "user";
  avatar?: string;
  createdAt: number;
  disabled: boolean;
}

export default function AdminUsersPanel() {
  const locale = useLocale();
  const tx = useTranslations();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [userToDelete, setUserToDelete] = useState<ManagedUser | null>(null);
  const [userFormError, setUserFormError] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newAvatar, setNewAvatar] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "user">("user");

  const { notice, flash, notify } = useToast();
  const { user: currentUser } = useNavelixData();

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch {
      // ignore
    }
  };

  const status = useAdminUserStatus({ onUpdated: fetchUsers, flash });

  useEffect(() => {
    queueMicrotask(() => {
      fetchUsers();
    });
  }, []);

  const handleAddUser = async () => {
    if (!newUsername.trim()) {
      setUserFormError(tx("username_is_required_390ccdec"));
      return;
    }
    if (!editingUser && !newPassword) {
      setUserFormError(tx("a_password_is_required_for_a_new_account_30e9a5e3"));
      return;
    }
    if (newPassword && newPassword.length < 6) {
      setUserFormError(tx("password_must_contain_at_least_6_characters_cdbb896e"));
      return;
    }
    const res = await fetch("/api/admin/users", {
      method: editingUser ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        editingUser
          ? {
              id: editingUser.id,
              username: newUsername.trim(),
              displayName: newDisplayName.trim(),
              password: newPassword ? newPassword : undefined,
              role: newRole,
              avatar: newAvatar,
            }
          : {
              username: newUsername.trim(),
              displayName: newDisplayName.trim() || newUsername.trim(),
              password: newPassword,
              role: newRole,
              avatar: newAvatar,
            },
      ),
    });
    if (res.ok) {
      notify(tx("account_management_eba54690"), editingUser ? tx("message_34c8448e067f", {v0: newUsername}) : tx("message_98b001432e15", {v0: newUsername}));
      setShowAddUser(false);
      setEditingUser(null);
      setNewUsername("");
      setNewPassword("");
      setNewDisplayName("");
      setNewAvatar("");
      setNewRole("user");
      setUserFormError("");
      fetchUsers();
    } else {
      const data = await res.json().catch(() => ({}));
      setUserFormError(data.message || data.error || tx("operation_failed_0c3b4cf7"));
    }
  };

  const handleDeleteUserConfirm = async () => {
    if (!userToDelete) return;
    const res = await fetch(`/api/admin/users?id=${userToDelete.id}`, { method: "DELETE" });
    if (res.ok) {
      notify(tx("account_management_eba54690"), tx("message_d0904e870db9", {v0: userToDelete.username}));
      setUserToDelete(null);
      fetchUsers();
    } else {
      const data = await res.json().catch(() => ({}));
      flash(tx("message_0d5ebcfa9a71", {v0: data.message || data.error || tx("unable_to_delete_user_b935ffda")}));
      setUserToDelete(null);
    }
  };

  return (
    <>
      <Toast message={notice} variant="toast" />
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100/90 dark:border-slate-700 shadow-2xs transition-colors">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              {tx("account_management_93070662")}{users.length})
            </h2>
            <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
              {tx("add_edit_disable_enable_and_delete_user_accounts_7faf8672")}</p>
          </div>
          <button
            onClick={() => {
              setEditingUser(null);
              setNewUsername("");
              setNewPassword("");
              setNewDisplayName("");
              setNewAvatar("");
              setNewRole("user");
              setUserFormError("");
              setShowAddUser(true);
            }}
            className="h-9 px-4 bg-brand hover:bg-brand-strong text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span className="text-sm">+</span>
            <span>{tx("add_account_7d76fa80")}</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-700 text-gray-400 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="pb-3 pr-4">{tx("account_311bb313")}</th>
                <th className="pb-3 pr-4">{tx("display_name_a9858587")}</th>
                <th className="pb-3 pr-4">{tx("role_e0394913")}</th>
                <th className="pb-3 pr-4">{tx("account_status_449636a1")}</th>
                <th className="pb-3 pr-4">{tx("registered_4adc3461")}</th>
                <th className="pb-3 text-right">{tx("actions_ed31fbb4")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50/60 dark:hover:bg-slate-700/50 transition-colors">
                  <td className="py-3.5 pr-4 font-bold text-gray-900 dark:text-white">@{u.username}</td>
                  <td className="py-3.5 pr-4 text-gray-700 dark:text-slate-200">{u.displayName || u.username}</td>
                  <td className="py-3.5 pr-4">
                    <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${u.role === "admin" ? "bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border border-teal-100 dark:border-teal-900" : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300"}`}>
                      {u.role === "admin" ? tx("administrator_admin_bade20be") : tx("user_597691ea")}
                    </span>
                  </td>
                  <td className="py-3.5 pr-4">
                    <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${u.disabled ? "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"}`}>
                      {u.disabled ? tx("disabled_a8c3698b") : tx("active_296de0e3")}
                    </span>
                  </td>
                  <td className="py-3.5 pr-4 text-gray-400 dark:text-slate-400">
                    {new Date(u.createdAt).toLocaleDateString(locale)}
                  </td>
                  <td className="py-3.5 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => {
                          setEditingUser(u);
                          setNewUsername(u.username);
                          setNewDisplayName(u.displayName);
                          setNewAvatar(u.avatar || "");
                          setNewRole(u.role);
                          setNewPassword("");
                          setUserFormError("");
                          setShowAddUser(true);
                        }}
                        className="text-gray-500 dark:text-slate-400 hover:text-brand font-medium transition-colors cursor-pointer"
                      >
                        {tx("edit_a2e86c4b")}</button>
                      <button type="button" disabled={status.saving || u.id === currentUser?.id}
                        title={u.id === currentUser?.id ? tx("you_cannot_disable_your_current_account_0946df8f") : undefined}
                        onClick={() => status.setTarget(u)}
                        className="text-amber-600 dark:text-amber-400 font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                        {u.disabled ? tx("enable_f4f0ead1") : tx("disable_4e6fd0e2")}
                      </button>
                      <button
                        onClick={() => setUserToDelete(u)}
                        className="text-gray-400 dark:text-slate-400 hover:text-rose-500 font-medium transition-colors cursor-pointer"
                      >
                        {tx("delete_a6c5bde8")}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit User Modal */}
      <Modal
        open={showAddUser}
        title={editingUser ? tx("message_d6ca1eba7748", {v0: editingUser.username}) : tx("add_account_7d76fa80")}
        onClose={() => setShowAddUser(false)}
      >
        <div className="flex flex-col gap-3 p-2">
          <div>
            <label htmlFor="admin-user-name-input" className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
              {tx("username_1a3f0617")}</label>
            <input
              id="admin-user-name-input"
              name="username"
              type="text"
              autoComplete="username"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder={tx("username_3_20_letters_numbers_or_underscores_88a89683")}
              className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label htmlFor="admin-user-displayname-input" className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
              {tx("display_name_a9858587")}</label>
            <input
              id="admin-user-displayname-input"
              name="displayName"
              type="text"
              autoComplete="name"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              placeholder={tx("optional_defaults_to_your_username_d3daafce")}
              className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label htmlFor="admin-user-password-input" className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
              {tx("password_a621ab60")}</label>
            <input
              id="admin-user-password-input"
              name="password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={editingUser ? tx("leave_blank_to_keep_the_current_password_5346863a") : tx("at_least_6_characters_041568c2")}
              className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label htmlFor="admin-user-role-select" className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
              {tx("role_e0394913")}</label>
            <select
              id="admin-user-role-select"
              name="role"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as "admin" | "user")}
              className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
            >
              <option value="user">{tx("user_597691ea")}</option>
              <option value="admin">{tx("administrator_5775c0be")}</option>
            </select>
          </div>
          {userFormError && (
            <p className="text-xs text-rose-500">{userFormError}</p>
          )}
          <button
            onClick={handleAddUser}
            className="h-9 rounded-lg bg-brand hover:bg-brand-strong text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            {editingUser ? tx("save_changes_991bb7cf") : tx("create_account_f48d12cf")}
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!status.target}
        title={status.target?.disabled ? tx("enable_this_account_f277ebca") : tx("disable_this_account_ae776e99")}
        message={status.target?.disabled
          ? tx("message_1e9001633562", {v0: status.target.username})
          : tx("message_0c7e6c67191f", {v0: status.target?.username || ""})}
        confirmLabel={status.target?.disabled ? tx("confirm_enable_e08a9527") : tx("confirm_disable_b6c82c2d")}
        onConfirm={status.confirm}
        onClose={() => status.setTarget(null)}
      />

      {/* Delete User Confirm */}
      <ConfirmDialog
        open={!!userToDelete}
        title={tx("delete_this_account_e33fa5d8")}
        message={tx("message_d6113d1850a6", {v0: userToDelete?.username || ""})}
        onConfirm={handleDeleteUserConfirm}
        onClose={() => setUserToDelete(null)}
      />
    </>
  );
}