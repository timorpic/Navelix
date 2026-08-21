"use client";

import React, { useEffect, useState } from "react";
import Modal from "@/components/modal";
import AvatarPicker from "@/components/avatar-picker";
import { useNavelixConfig } from "@/hooks/use-navelix-config";
import { resolveAvatar } from "@/lib/avatars";
import { pushNotification } from "@/lib/notifications";

interface ProfileUser {
  username: string;
  displayName: string;
  role: "admin" | "user";
  avatar?: string;
  email?: string;
  bio?: string;
}

interface SessionRow {
  tokenHash: string;
  userAgent: string;
  ipAddress: string;
  lastActiveAt: number;
  createdAt: number;
  isCurrent: boolean;
}

interface ApiTokenRow {
  id: string;
  name: string;
  tokenPrefix: string;
  createdAt: number;
  lastUsedAt: number | null;
}

export default function AdminProfileTab() {
  const { config, updateConfig } = useNavelixConfig();

  // ── Current user ──
  const [currentUser, setCurrentUser] = useState<ProfileUser | null>(null);

  // ── Profile form state ──
  const [profileDisplayNameInput, setProfileDisplayNameInput] = useState("");
  const [profileEmailInput, setProfileEmailInput] = useState("");
  const [profileBioInput, setProfileBioInput] = useState("");
  const [profilePasswordNotice, setProfilePasswordNotice] = useState("");

  // ── Avatar ──
  const [avatarDraft, setAvatarDraft] = useState("");
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  // ── Password modal ──
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [modalOldPassword, setModalOldPassword] = useState("");
  const [modalNewPassword, setModalNewPassword] = useState("");
  const [modalConfirmPassword, setModalConfirmPassword] = useState("");
  const [modalPasswordNotice, setModalPasswordNotice] = useState("");

  // ── Sessions ──
  const [activeSessions, setActiveSessions] = useState<SessionRow[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // ── API Tokens ──
  const [apiTokens, setApiTokens] = useState<ApiTokenRow[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [newTokenNameInput, setNewTokenNameInput] = useState("");
  const [createdSecretToken, setCreatedSecretToken] = useState("");

  // ── Telegram 通知配置 ──
  const [tgEnabled, setTgEnabled] = useState(false);
  const [tgNotifyBackup, setTgNotifyBackup] = useState(true);
  const [tgNotifySystem, setTgNotifySystem] = useState(true);
  const [tgBotTokenConfigured, setTgBotTokenConfigured] = useState(false);
  const [tgChatId, setTgChatId] = useState("");
  const [tgChatIdConfigured, setTgChatIdConfigured] = useState(false);
  const [tgBotTokenInput, setTgBotTokenInput] = useState("");
  const [tgTesting, setTgTesting] = useState(false);

  // Flash / notify helpers
  const [notice, setNotice] = useState("");
  const flash = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(""), 2800);
  };
  const notify = (title: string, msg: string) => {
    flash(msg);
    pushNotification(title, msg);
  };

  const fetchUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      const user = data.user ?? null;
      setCurrentUser(user);
      return user;
    } catch {
      setCurrentUser(null);
      return null;
    }
  };

  const fetchSessions = async () => {
    try {
      setLoadingSessions(true);
      const res = await fetch("/api/auth/sessions");
      if (res.ok) {
        const data = await res.json();
        setActiveSessions(data.sessions || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleRevokeSession = async (tokenHash: string) => {
    try {
      const res = await fetch("/api/auth/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenHash }),
      });
      if (res.ok) {
        notify("会话管理", "已安全下线选定的设备");
        fetchSessions();
      }
    } catch {
      // ignore
    }
  };

  const handleRevokeOtherSessions = async () => {
    try {
      const res = await fetch("/api/auth/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke_others" }),
      });
      if (res.ok) {
        notify("会话管理", "已注销其他所有设备的登录会话");
        fetchSessions();
      }
    } catch {
      // ignore
    }
  };

  const fetchApiTokens = async () => {
    try {
      setLoadingTokens(true);
      const res = await fetch("/api/auth/api-tokens");
      if (res.ok) {
        const data = await res.json();
        setApiTokens(data.tokens || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingTokens(false);
    }
  };

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTokenNameInput.trim()) return;
    try {
      const res = await fetch("/api/auth/api-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTokenNameInput.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        setCreatedSecretToken(data.token);
        setNewTokenNameInput("");
        notify("API 密钥", "密钥生成成功");
        fetchApiTokens();
      }
    } catch {
      // ignore
    }
  };

  const handleRevokeToken = async (id: string) => {
    try {
      const res = await fetch("/api/auth/api-tokens", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        notify("API 密钥", "密钥已解绑撤销");
        fetchApiTokens();
      }
    } catch {
      // ignore
    }
  };

  const saveProfile = async (patch: {
    displayName?: string;
    email?: string;
    bio?: string;
  }) => {
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setCurrentUser(data.user);
        setProfilePasswordNotice(`🎉 ${data.message || "个人资料更新成功"}`);
        notify("个人账号", "个人资料与签名已保存");
      } else {
        setProfilePasswordNotice(`❌ ${data.error || "修改失败"}`);
      }
    } catch {
      setProfilePasswordNotice("❌ 更新个人资料失败");
    }
  };

  const handleModalPasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalPasswordNotice("");
    if (!modalOldPassword) {
      setModalPasswordNotice("❌ 请输入当前原密码");
      return;
    }
    if (!modalNewPassword || modalNewPassword.length < 6) {
      setModalPasswordNotice("❌ 新密码长度至少需 6 位");
      return;
    }
    if (modalNewPassword !== modalConfirmPassword) {
      setModalPasswordNotice("❌ 两次输入的二次确认新密码不一致，请重新检查");
      return;
    }
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oldPassword: modalOldPassword,
          newPassword: modalNewPassword,
        }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setCurrentUser(data.user);
        setModalPasswordNotice("🎉 密码修改成功！");
        notify("个人账号", "登录密码已成功重置");
        updateConfig({ securitySetupDone: true });
        setTimeout(() => {
          setShowChangePasswordModal(false);
          setModalOldPassword("");
          setModalNewPassword("");
          setModalConfirmPassword("");
          setModalPasswordNotice("");
        }, 1000);
      } else {
        setModalPasswordNotice(`❌ ${data.error || "密码修改失败"}`);
      }
    } catch {
      setModalPasswordNotice("❌ 网络或服务器错误，修改失败");
    }
  };

  const handleAvatarSave = async (avatar?: string) => {
    const value = avatar ?? avatarDraft;
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar: value }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setCurrentUser(data.user);
        notify("系统设置", "头像更新成功");
      } else {
        flash(data.error || "头像保存失败");
      }
    } catch {
      flash("头像保存失败");
    }
  };

  const fetchTelegramConfig = async () => {
    try {
      const res = await fetch("/api/admin/telegram");
      const data = await res.json();
      if (data) {
        setTgEnabled(data.status.enabled);
        setTgNotifyBackup(data.status.notifyBackup);
        setTgNotifySystem(data.status.notifySystem);
        setTgBotTokenConfigured(data.status.configured);
        setTgChatId(data.chatId || "");
        setTgChatIdConfigured(data.status.chatIdConfigured);
      }
    } catch {
      // ignore
    }
  };

  // Initial load + sync form inputs from user
  useEffect(() => {
    queueMicrotask(() => {
      fetchUser().then((user) => {
        if (user) {
          setProfileDisplayNameInput(user.displayName || user.username || "");
          setProfileEmailInput(user.email || "");
          setProfileBioInput(user.bio || "");
        }
      });
      fetchSessions();
      fetchApiTokens();
      fetchTelegramConfig();
    });
  }, []);

  const tgSave = async (patch?: {
    botToken?: string;
    chatId?: string;
    enabled?: boolean;
    notifyBackup?: boolean;
    notifySystem?: boolean;
  }) => {
    try {
      const res = await fetch("/api/admin/telegram", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          patch ?? {
            botToken: tgBotTokenInput,
            chatId: tgChatId,
            enabled: tgEnabled,
            notifyBackup: tgNotifyBackup,
            notifySystem: tgNotifySystem,
          },
        ),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTgBotTokenConfigured(data.status.configured);
        setTgChatIdConfigured(data.status.chatIdConfigured);
        setTgBotTokenInput("");
        flash("✅ Telegram 配置已保存");
      } else {
        flash(`❌ ${data.error || "保存失败"}`);
      }
    } catch {
      flash("❌ 网络请求失败");
    }
  };

  const tgTest = async () => {
    setTgTesting(true);
    try {
      const res = await fetch("/api/admin/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (res.ok) {
        flash("✅ 测试消息已发送，请检查 Telegram");
      } else {
        flash(`❌ ${data.error || "发送失败"}`);
      }
    } catch {
      flash("❌ 网络请求失败");
    } finally {
      setTgTesting(false);
    }
  };

  // Session refresh + drafts when avatar modal opens
  useEffect(() => {
    if (showAvatarModal && currentUser) {
      queueMicrotask(() => {
        setAvatarDraft(currentUser.avatar || "");
      });
    }
  }, [showAvatarModal, currentUser]);

  const sessionLabel = (ua: string) => {
    if (ua.includes("Chrome")) return "🌐 Chrome 浏览器";
    if (ua.includes("Safari")) return "🧭 Safari 浏览器";
    if (ua.includes("Firefox")) return "🦊 Firefox 浏览器";
    return "💻 桌面端终端设备";
  };

  return (
    <>
      {notice && (
        <div className="mb-4 rounded-xl border border-[#00C776]/30 bg-[#00C776]/10 px-4 py-2.5 text-xs font-semibold text-[#009a5a] shadow-2xs">
          {notice}
        </div>
      )}

      <div className="max-w-full space-y-6">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-sky-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            <span>个人账号与安全</span>
          </h2>
          <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
            管理您的个人基本资料、座右铭签名、社交网络主页、活跃设备会话与 API Access Token
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* 左栏：基础资料 & 社交链接 */}
          <div className="space-y-6">
            {/* 卡片 1：👤 基础资料 & 名片 */}
            <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-5 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700/80">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className="relative group cursor-pointer shrink-0"
                    onClick={() => {
                      setAvatarDraft(currentUser?.avatar || "");
                      setShowAvatarModal(true);
                    }}
                    title="点击修改头像"
                  >
                    <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#3B82F6] via-[#00C776] to-[#8B5CF6] flex items-center justify-center text-white text-xl font-bold shadow-md overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={resolveAvatar(currentUser?.avatar, currentUser?.username)}
                        alt={currentUser?.displayName || "User"}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-semibold transition-opacity">
                      修改
                    </div>
                  </div>

                  <div className="space-y-1 min-w-0">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                      {currentUser?.displayName || currentUser?.username || "Admin"}
                    </h3>
                    <p className="text-xs text-gray-400 font-mono">
                      账号: @{currentUser?.username || "admin"}
                    </p>
                    <div className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-900">
                      {currentUser?.role === "admin" ? "👑 超级系统管理员" : "👤 普通注册用户"}
                    </div>
                  </div>
                </div>

                {/* 快捷按钮 */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarDraft(currentUser?.avatar || "");
                      setShowAvatarModal(true);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-slate-700 shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                  >
                    <span>🖼️</span>
                    <span>头像</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setModalOldPassword("");
                      setModalNewPassword("");
                      setModalConfirmPassword("");
                      setModalPasswordNotice("");
                      setShowChangePasswordModal(true);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-slate-700 shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                  >
                    <span>🔐</span>
                    <span>密码</span>
                  </button>
                </div>
              </div>

              {/* 修改基本资料表单（失焦即保存） */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <label htmlFor="admin-profile-display-name" className="block text-xs font-bold text-gray-700 dark:text-slate-200">
                    显示名称 (昵称)
                  </label>
                  <input
                    id="admin-profile-display-name"
                    name="displayName"
                    type="text"
                    value={profileDisplayNameInput}
                    onChange={(e) => setProfileDisplayNameInput(e.target.value)}
                    onBlur={() => saveProfile({ displayName: profileDisplayNameInput })}
                    placeholder="例如 亚历克斯"
                    className="w-full h-9 rounded-xl border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="admin-profile-email" className="block text-xs font-bold text-gray-700 dark:text-slate-200">
                    个人邮箱地址
                  </label>
                  <input
                    id="admin-profile-email"
                    name="email"
                    type="email"
                    value={profileEmailInput}
                    onChange={(e) => setProfileEmailInput(e.target.value)}
                    onBlur={() => saveProfile({ email: profileEmailInput })}
                    placeholder="you@example.com"
                    className="w-full h-9 rounded-xl border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="admin-profile-bio" className="block text-xs font-bold text-gray-700 dark:text-slate-200">
                    个人座右铭 / 签名
                  </label>
                  <input
                    id="admin-profile-bio"
                    name="bio"
                    type="text"
                    value={profileBioInput}
                    onChange={(e) => setProfileBioInput(e.target.value)}
                    onBlur={() => saveProfile({ bio: profileBioInput })}
                    placeholder="例如：极客致远 · 构建与探索"
                    className="w-full h-9 rounded-xl border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                  />
                  <p className="text-[10px] text-gray-400 dark:text-slate-400">
                    个性签名将同步展示在侧边栏底部名片卡片上
                  </p>
                </div>

                {profilePasswordNotice && (
                  <p className="text-xs font-semibold pt-1" style={{ color: profilePasswordNotice.startsWith("🎉") ? "#00C776" : "#F43F5E" }}>
                    {profilePasswordNotice}
                  </p>
                )}
              </div>
            </div>

            {/* 卡片 2：🌐 个人社交媒体与外部主页 */}
            <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <span>🌐</span>
                  <span>个人社交与外部主页链接</span>
                </h3>
                <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
                  配置您的 GitHub / X / LinkedIn 主页链接，实时呈现在前台底部
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="admin-social-github-profile" className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
                    GitHub 主页
                  </label>
                  <input
                    id="admin-social-github-profile"
                    type="text"
                    value={config.socialGithub || ""}
                    onChange={(e) => updateConfig({ socialGithub: e.target.value })}
                    placeholder="https://github.com/username"
                    className="w-full h-8.5 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label htmlFor="admin-social-x-profile" className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
                    X (Twitter)
                  </label>
                  <input
                    id="admin-social-x-profile"
                    type="text"
                    value={config.socialX || ""}
                    onChange={(e) => updateConfig({ socialX: e.target.value })}
                    placeholder="https://x.com/username"
                    className="w-full h-8.5 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label htmlFor="admin-social-linkedin-profile" className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
                    LinkedIn 领英
                  </label>
                  <input
                    id="admin-social-linkedin-profile"
                    type="text"
                    value={config.socialLinkedin || ""}
                    onChange={(e) => updateConfig({ socialLinkedin: e.target.value })}
                    placeholder="https://linkedin.com/in/username"
                    className="w-full h-8.5 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label htmlFor="admin-social-email-profile" className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
                    公开联系邮箱
                  </label>
                  <input
                    id="admin-social-email-profile"
                    type="text"
                    value={config.socialEmail || ""}
                    onChange={(e) => updateConfig({ socialEmail: e.target.value })}
                    placeholder="mailto:you@example.com"
                    className="w-full h-8.5 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 右栏：登录安全与活跃会话 & API Token 管理 */}
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 卡片 3：🛡️ 已登录设备管理 */}
            <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <span>🛡️</span>
                    <span>已登录设备</span>
                  </h3>
                  <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
                    实时监控所有登录本账号的设备会话与 IP
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleRevokeOtherSessions}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900 transition-colors cursor-pointer shrink-0"
                >
                  踢出其他设备
                </button>
              </div>

              <div className="space-y-2.5 max-h-64 overflow-y-auto">
                {loadingSessions ? (
                  <p className="text-xs text-gray-400 py-4 text-center">加载设备会话中…</p>
                ) : activeSessions.length === 0 ? (
                  <p className="text-xs text-gray-400 py-4 text-center">暂无活动会话</p>
                ) : (
                  activeSessions.map((s) => (
                    <div
                      key={s.tokenHash}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition-colors ${
                        s.isCurrent
                          ? "bg-teal-50/50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-900/80"
                          : "bg-gray-50/50 dark:bg-slate-900/40 border-gray-100 dark:border-slate-700/60"
                      }`}
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-800 dark:text-slate-200 truncate">
                            {sessionLabel(s.userAgent)}
                          </span>
                          {s.isCurrent && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#00C776] text-white">
                              当前设备
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400 dark:text-slate-400 font-mono truncate">
                          IP: {s.ipAddress} · 活跃于 {new Date(s.lastActiveAt).toLocaleString("zh-CN")}
                        </p>
                      </div>

                      {!s.isCurrent && (
                        <button
                          type="button"
                          onClick={() => handleRevokeSession(s.tokenHash)}
                          className="text-[11px] text-red-500 hover:text-red-700 font-semibold cursor-pointer shrink-0"
                        >
                          强退
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 卡片 5：📮 Telegram 通知配置 */}
            <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <span>📮</span>
                  <span>Telegram Bot 通知</span>
                </h3>
                <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
                  通过 Telegram Bot 推送备份结果、系统异常（服务重启 / 磁盘占用 / 登录异常）等安全通知
                </p>
              </div>

              <div className="space-y-3">
                {/* Bot Token */}
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-bold text-gray-800 dark:text-slate-200">
                      Bot Token
                    </p>
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                      tgBotTokenConfigured
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : "bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-400"
                    }`}>
                      {tgBotTokenConfigured ? "已配置" : "未配置"}
                    </span>
                  </div>
                  <input
                    type="password"
                    value={tgBotTokenInput}
                    onChange={(e) => setTgBotTokenInput(e.target.value)}
                    onBlur={() => {
                      const v = tgBotTokenInput.trim();
                      if (v) tgSave({ botToken: v });
                    }}
                    placeholder={tgBotTokenConfigured ? "已保存 - 输入新 Token 可覆盖（留空保持不变）" : "123456:ABC-DEF...（向 @BotFather 获取）"}
                    className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
                  />
                </div>

                {/* Chat ID */}
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-bold text-gray-800 dark:text-slate-200">
                      Chat ID
                    </p>
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                      tgChatIdConfigured
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : "bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-400"
                    }`}>
                      {tgChatIdConfigured ? "已配置" : "未配置"}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={tgChatId}
                    onChange={(e) => setTgChatId(e.target.value)}
                    onBlur={() => tgSave({ chatId: tgChatId.trim() })}
                    placeholder="例如 123456789（向 @userinfobot 查询你的 ID）"
                    className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
                  />
                </div>

                {/* 总开关 */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700">
                  <div>
                    <p className="text-xs font-bold text-gray-800 dark:text-slate-200">
                      Telegram 通知总开关
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-slate-400 mt-0.5">
                      关闭后所有 Telegram 推送不再发送
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !tgEnabled;
                      setTgEnabled(next);
                      tgSave({ enabled: next });
                    }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      tgEnabled
                        ? "bg-[#00C776] text-white"
                        : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
                    }`}
                  >
                    {tgEnabled ? "已开启" : "已关闭"}
                  </button>
                </div>

                {/* 场景开关 */}
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-2">
                  <p className="text-xs font-bold text-gray-800 dark:text-slate-200">
                    通知场景
                  </p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-gray-600 dark:text-slate-300">备份结果</p>
                      <p className="text-[10px] text-gray-400 dark:text-slate-400">本地/云备份成功与失败</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !tgNotifyBackup;
                        setTgNotifyBackup(next);
                        tgSave({ notifyBackup: next });
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        tgNotifyBackup
                          ? "bg-[#00C776] text-white"
                          : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
                      }`}
                    >
                      {tgNotifyBackup ? "已开启" : "已关闭"}
                    </button>
                  </div>
                  <div className="flex items-center justify-between pt-1.5 border-t border-gray-200/80 dark:border-slate-700">
                    <div>
                      <p className="text-[11px] text-gray-600 dark:text-slate-300">系统异常</p>
                      <p className="text-[10px] text-gray-400 dark:text-slate-400">服务重启 / 磁盘占用 / 登录异常</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !tgNotifySystem;
                        setTgNotifySystem(next);
                        tgSave({ notifySystem: next });
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        tgNotifySystem
                          ? "bg-[#00C776] text-white"
                          : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
                      }`}
                    >
                      {tgNotifySystem ? "已开启" : "已关闭"}
                    </button>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={tgTesting}
                    onClick={tgTest}
                    className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {tgTesting ? "发送中…" : "📨 发送测试消息"}
                  </button>
                </div>

                {!tgBotTokenConfigured && (
                  <p className="text-[10px] text-gray-400 dark:text-slate-500">
                    💡 使用提示：通过 @BotFather 创建 Bot 获取 Token；用 @userinfobot 查询你的 Chat ID。
                  </p>
                )}
              </div>
            </div>
            </div>

            {/* 卡片 4：🔑 个人 API Token 密钥管理 */}
            <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <span>🔑</span>
                  <span>个人 API Access Token</span>
                </h3>
                <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
                  用于第三方快捷指令、自动化脚本或 Webhook 鉴权调用
                </p>
              </div>

              {/* 生成新 Token 表单 */}
              <form onSubmit={handleCreateToken} className="flex items-center gap-2">
                <input
                                  type="text"
                                  name="tokenName"
                                  value={newTokenNameInput}
                                  onChange={(e) => setNewTokenNameInput(e.target.value)}
                  placeholder="密钥标识 (例如：iOS 快捷指令密钥)"
                  className="flex-1 h-9 rounded-xl border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                />
                <button
                  type="submit"
                  className="h-9 px-4 bg-[#00C776] hover:bg-[#009a5a] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0"
                >
                  生成新密钥
                </button>
              </form>

              {/* 新创密钥提示框 */}
              {createdSecretToken && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs space-y-1.5">
                  <p className="font-bold text-emerald-800 dark:text-emerald-300">
                    🎉 新 API 密钥已生成（仅可复制一次）：
                  </p>
                  <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 font-mono text-[11px] text-emerald-700 dark:text-emerald-400 break-all select-all">
                    <span>{createdSecretToken}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(createdSecretToken);
                        notify("API 密钥", "密钥已复制到剪贴板");
                      }}
                      className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold shrink-0 cursor-pointer"
                    >
                      复制
                    </button>
                  </div>
                </div>
              )}

              {/* Token 列表 */}
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {loadingTokens ? (
                  <p className="text-xs text-gray-400 py-4 text-center">加载 API 密钥中…</p>
                ) : apiTokens.length === 0 ? (
                  <p className="text-xs text-gray-400 py-4 text-center">暂未创建 API Token 密钥</p>
                ) : (
                  apiTokens.map((t) => (
                    <div
                      key={t.id}
                      className="p-3 rounded-xl bg-gray-50/50 dark:bg-slate-900/40 border border-gray-100 dark:border-slate-700 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <p className="font-bold text-gray-800 dark:text-slate-200 truncate">
                          {t.name}
                        </p>
                        <p className="text-[10px] text-gray-400 dark:text-slate-400 font-mono truncate">
                          {t.tokenPrefix} · 创建于 {new Date(t.createdAt).toLocaleDateString("zh-CN")}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRevokeToken(t.id)}
                        className="text-[11px] text-rose-500 hover:text-rose-700 font-semibold cursor-pointer shrink-0"
                      >
                        撤销
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Avatar Picker Modal */}
      <Modal
        open={showAvatarModal}
        title="修改头像"
        onClose={() => setShowAvatarModal(false)}
      >
        <AvatarPicker
          value={avatarDraft}
          username={currentUser?.username}
          onChange={(v) => {
            setAvatarDraft(v);
            handleAvatarSave(v);
          }}
        />
        <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 dark:border-slate-700 pt-4">
          <button
            onClick={() => setShowAvatarModal(false)}
            className="h-9 rounded-lg px-4 text-xs font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer"
          >
            完成
          </button>
        </div>
      </Modal>

      {/* Dedicated Change Password Modal */}
      <Modal
        open={showChangePasswordModal}
        title="🔐 修改登录密码"
        onClose={() => setShowChangePasswordModal(false)}
      >
        <form onSubmit={handleModalPasswordSave} className="space-y-4">
          <div>
            <label htmlFor="modal-old-pwd" className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
              当前原密码 *
            </label>
            <input
              id="modal-old-pwd"
              name="oldPassword"
              type="password"
              autoComplete="current-password"
              value={modalOldPassword}
              onChange={(e) => setModalOldPassword(e.target.value)}
              placeholder="请输入当前使用的登录密码"
              required
              className="w-full h-9 rounded-xl border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#00C776]/40 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="modal-new-pwd" className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
              设置新密码 (至少 6 位) *
            </label>
            <input
              id="modal-new-pwd"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              value={modalNewPassword}
              onChange={(e) => setModalNewPassword(e.target.value)}
              placeholder="请输入新密码 (至少 6 位)"
              required
              className="w-full h-9 rounded-xl border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#00C776]/40 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="modal-confirm-pwd" className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
              确认新密码 *
            </label>
            <input
              id="modal-confirm-pwd"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={modalConfirmPassword}
              onChange={(e) => setModalConfirmPassword(e.target.value)}
              placeholder="请再次输入新密码"
              required
              className="w-full h-9 rounded-xl border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#00C776]/40 focus:outline-none"
            />
          </div>

          {modalPasswordNotice && (
            <p className="text-xs font-semibold pt-1" style={{ color: modalPasswordNotice.startsWith("🎉") ? "#00C776" : "#F43F5E" }}>
              {modalPasswordNotice}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 dark:border-slate-700 pt-4">
            <button
              type="button"
              onClick={() => setShowChangePasswordModal(false)}
              className="h-9 rounded-lg px-4 text-xs font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              className="h-9 rounded-lg bg-[#00C776] hover:bg-[#009a5a] px-5 text-xs font-bold text-white transition-colors cursor-pointer shadow-xs"
            >
              确认修改密码
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}