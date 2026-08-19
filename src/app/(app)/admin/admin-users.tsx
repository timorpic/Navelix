"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/modal";
import ConfirmDialog from "@/components/confirm-dialog";
import { pushNotification } from "@/lib/notifications";

interface ManagedUser {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "user";
  avatar?: string;
  createdAt: number;
}

export default function AdminUsersPanel() {
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

  const [notice, setNotice] = useState("");

  const flash = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(""), 2800);
  };

  const notify = (title: string, msg: string) => {
    flash(msg);
    pushNotification(title, msg);
  };

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

  useEffect(() => {
    queueMicrotask(() => {
      fetchUsers();
    });
  }, []);

  const handleAddUser = async () => {
    if (!newUsername || !newPassword) {
      setUserFormError("用户名和密码不能为空");
      return;
    }
    const res = await fetch("/api/admin/users", {
      method: editingUser ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        editingUser
          ? { id: editingUser.id, username: newUsername, displayName: newDisplayName, password: newPassword, role: newRole, avatar: newAvatar }
          : { username: newUsername, displayName: newDisplayName || newUsername, password: newPassword, role: newRole, avatar: newAvatar },
      ),
    });
    if (res.ok) {
      notify("账号管理", editingUser ? `用户 @${newUsername} 已更新` : `用户 @${newUsername} 创建成功`);
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
      setUserFormError(data.error || "操作失败");
    }
  };

  const handleDeleteUserConfirm = async () => {
    if (!userToDelete) return;
    const res = await fetch(`/api/admin/users?id=${userToDelete.id}`, { method: "DELETE" });
    if (res.ok) {
      notify("账号管理", `用户 @${userToDelete.username} 已成功删除`);
      setUserToDelete(null);
      fetchUsers();
    } else {
      const data = await res.json().catch(() => ({}));
      flash(`删除失败: ${data.error || "无法删除用户"}`);
      setUserToDelete(null);
    }
  };

  return (
    <>
      {notice && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 dark:bg-slate-700 text-white text-xs px-4 py-2 rounded-xl shadow-lg">
          {notice}
        </div>
      )}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100/90 dark:border-slate-700 shadow-2xs transition-colors">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              账号管理功能 ({users.length})
            </h2>
            <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
              添加、修改 (密码/角色/显示名) 及删除系统用户账号
            </p>
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
            className="h-9 px-4 bg-[#00C776] hover:bg-[#009a5a] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span className="text-sm">+</span>
            <span>添加新账号</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-700 text-gray-400 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="pb-3 pr-4">账号</th>
                <th className="pb-3 pr-4">显示名称</th>
                <th className="pb-3 pr-4">权限角色</th>
                <th className="pb-3 pr-4">注册时间</th>
                <th className="pb-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50/60 dark:hover:bg-slate-700/50 transition-colors">
                  <td className="py-3.5 pr-4 font-bold text-gray-900 dark:text-white">@{u.username}</td>
                  <td className="py-3.5 pr-4 text-gray-700 dark:text-slate-200">{u.displayName || u.username}</td>
                  <td className="py-3.5 pr-4">
                    <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${u.role === "admin" ? "bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border border-teal-100 dark:border-teal-900" : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300"}`}>
                      {u.role === "admin" ? "👑 管理员 (Admin)" : "👤 普通用户"}
                    </span>
                  </td>
                  <td className="py-3.5 pr-4 text-gray-400 dark:text-slate-400">
                    {new Date(u.createdAt).toLocaleDateString("zh-CN")}
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
                        className="text-gray-500 dark:text-slate-400 hover:text-[#00C776] font-medium transition-colors cursor-pointer"
                      >
                        ✏️ 修改
                      </button>
                      <button
                        onClick={() => setUserToDelete(u)}
                        className="text-gray-400 dark:text-slate-400 hover:text-rose-500 font-medium transition-colors cursor-pointer"
                      >
                        🗑️ 删除
                      </button>
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
        title={editingUser ? `编辑账号 @${editingUser.username}` : "添加新账号"}
        onClose={() => setShowAddUser(false)}
      >
        <div className="flex flex-col gap-3 p-2">
          <div>
            <label htmlFor="admin-user-name-input" className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
              用户名
            </label>
            <input
              id="admin-user-name-input"
              name="username"
              type="text"
              autoComplete="username"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="用户名 (3-20 位字母数字下划线)"
              className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label htmlFor="admin-user-displayname-input" className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
              显示名称
            </label>
            <input
              id="admin-user-displayname-input"
              name="displayName"
              type="text"
              autoComplete="name"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              placeholder="可选，默认与用户名相同"
              className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label htmlFor="admin-user-password-input" className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
              密码
            </label>
            <input
              id="admin-user-password-input"
              name="password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={editingUser ? "留空则不修改密码" : "至少 6 位"}
              className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label htmlFor="admin-user-role-select" className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
              权限角色
            </label>
            <select
              id="admin-user-role-select"
              name="role"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as "admin" | "user")}
              className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
            >
              <option value="user">👤 普通用户</option>
              <option value="admin">👑 管理员</option>
            </select>
          </div>
          {userFormError && (
            <p className="text-xs text-rose-500">{userFormError}</p>
          )}
          <button
            onClick={handleAddUser}
            className="h-9 rounded-lg bg-[#00C776] hover:bg-[#009a5a] text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            {editingUser ? "保存修改" : "创建账号"}
          </button>
        </div>
      </Modal>

      {/* Delete User Confirm */}
      <ConfirmDialog
        open={!!userToDelete}
        title="删除账号确认"
        message={`确定要彻底删除账号 "@${userToDelete?.username}" 吗？`}
        onConfirm={handleDeleteUserConfirm}
        onClose={() => setUserToDelete(null)}
      />
    </>
  );
}