"use client";

import { useCallback, useEffect, useState } from "react";
import {
  parseProfileSaveResult,
  parseProfileUser,
  profileInputsFrom,
  validatePasswordChange,
  type ApiTokenRow,
  type ProfileFormInputs,
  type ProfileUser,
  type SessionRow,
} from "@/lib/admin-profile";

/**
 * 「个人账号与安全」Tab 的账号域状态：当前用户、资料表单、改密弹窗、
 * 活跃设备会话与个人 API Token。
 *
 * 从 `admin-profile-tab.tsx`（原 1219 行）抽出 —— 该文件把账号安全、
 * Telegram 通知、匿名遥测三块互不相关的设置连同 31 个 useState 塞在一起。
 * 本 hook 持有账号域的 state 与副作用；Telegram / 遥测分别见
 * `use-admin-telegram-settings` 与 `use-admin-report-settings`。
 * 提示与全局配置由调用方注入，以便三者共用同一个 Toast。
 */

interface UseAdminProfileAccountOptions {
  /** 展示 UI 提示（来自 useToast） */
  flash: (msg: string) => void;
  /** 展示 UI 提示并写入通知中心（来自 useToast） */
  notify: (title: string, msg: string) => void;
  /** 改密成功后标记安全设置已完成（来自 useNavelixConfig） */
  updateConfig: (patch: { securitySetupDone: boolean }) => void;
}

export interface UseAdminProfileAccountResult {
  currentUser: ProfileUser | null;
  // ── 资料表单（失焦即保存）──
  profileDisplayNameInput: string;
  setProfileDisplayNameInput: (v: string) => void;
  profileEmailInput: string;
  setProfileEmailInput: (v: string) => void;
  profileBioInput: string;
  setProfileBioInput: (v: string) => void;
  profilePasswordNotice: string;
  saveProfile: (patch: {
    displayName?: string;
    email?: string;
    bio?: string;
  }) => Promise<void>;
  // ── 头像 ──
  avatarDraft: string;
  setAvatarDraft: (v: string) => void;
  showAvatarModal: boolean;
  openAvatarModal: () => void;
  closeAvatarModal: () => void;
  handleAvatarSave: (avatar?: string) => Promise<void>;
  // ── 修改密码弹窗 ──
  showChangePasswordModal: boolean;
  openChangePasswordModal: () => void;
  closeChangePasswordModal: () => void;
  modalOldPassword: string;
  setModalOldPassword: (v: string) => void;
  modalNewPassword: string;
  setModalNewPassword: (v: string) => void;
  modalConfirmPassword: string;
  setModalConfirmPassword: (v: string) => void;
  modalPasswordNotice: string;
  handleModalPasswordSave: (e: React.FormEvent) => Promise<void>;
  // ── 活跃设备会话 ──
  activeSessions: SessionRow[];
  loadingSessions: boolean;
  handleRevokeSession: (tokenHash: string) => Promise<void>;
  handleRevokeOtherSessions: () => Promise<void>;
  // ── 个人 API Token ──
  apiTokens: ApiTokenRow[];
  loadingTokens: boolean;
  newTokenNameInput: string;
  setNewTokenNameInput: (v: string) => void;
  createdSecretToken: string;
  handleCreateToken: (e: React.FormEvent) => Promise<void>;
  handleRevokeToken: (id: string) => Promise<void>;
  /** 复制刚生成的密钥到剪贴板 */
  copyCreatedToken: () => void;
}

export function useAdminProfileAccount({
  flash,
  notify,
  updateConfig,
}: UseAdminProfileAccountOptions): UseAdminProfileAccountResult {
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

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      const user = parseProfileUser(data);
      setCurrentUser(user);
      return user;
    } catch {
      setCurrentUser(null);
      return null;
    }
  }, []);

  const fetchSessions = useCallback(async () => {
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
  }, []);

  const handleRevokeSession = useCallback(
    async (tokenHash: string) => {
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
    },
    [notify, fetchSessions],
  );

  const handleRevokeOtherSessions = useCallback(async () => {
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
  }, [notify, fetchSessions]);

  const fetchApiTokens = useCallback(async () => {
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
  }, []);

  const handleCreateToken = useCallback(
    async (e: React.FormEvent) => {
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
    },
    [newTokenNameInput, notify, fetchApiTokens],
  );

  const handleRevokeToken = useCallback(
    async (id: string) => {
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
    },
    [notify, fetchApiTokens],
  );

  const saveProfile = useCallback(
    async (patch: { displayName?: string; email?: string; bio?: string }) => {
      try {
        const res = await fetch("/api/auth/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const data = await res.json();
        const outcome = parseProfileSaveResult(res.ok, data);
        if (outcome.ok) {
          setCurrentUser(outcome.user);
          setProfilePasswordNotice(outcome.notice);
          notify("个人账号", "个人资料与签名已保存");
        } else {
          setProfilePasswordNotice(outcome.notice);
        }
      } catch {
        setProfilePasswordNotice("❌ 更新个人资料失败");
      }
    },
    [notify],
  );

  const handleModalPasswordSave = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setModalPasswordNotice("");
      const check = validatePasswordChange({
        oldPassword: modalOldPassword,
        newPassword: modalNewPassword,
        confirmPassword: modalConfirmPassword,
      });
      if (!check.ok) {
        setModalPasswordNotice(check.message);
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
    },
    [
      modalOldPassword,
      modalNewPassword,
      modalConfirmPassword,
      notify,
      updateConfig,
    ],
  );

  const handleAvatarSave = useCallback(
    async (avatar?: string) => {
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
    },
    [avatarDraft, notify, flash],
  );

  // Initial load + sync form inputs from user
  useEffect(() => {
    queueMicrotask(() => {
      fetchUser().then((user) => {
        if (user) {
          const inputs: ProfileFormInputs = profileInputsFrom(user);
          setProfileDisplayNameInput(inputs.displayName);
          setProfileEmailInput(inputs.email);
          setProfileBioInput(inputs.bio);
        }
      });
      fetchSessions();
      fetchApiTokens();
    });
  }, [fetchUser, fetchSessions, fetchApiTokens]);

  // Session refresh + drafts when avatar modal opens
  useEffect(() => {
    if (showAvatarModal && currentUser) {
      queueMicrotask(() => {
        setAvatarDraft(currentUser.avatar || "");
      });
    }
  }, [showAvatarModal, currentUser]);

  const openAvatarModal = useCallback(() => {
    setAvatarDraft(currentUser?.avatar || "");
    setShowAvatarModal(true);
  }, [currentUser]);

  const closeAvatarModal = useCallback(() => setShowAvatarModal(false), []);

  const openChangePasswordModal = useCallback(() => {
    setModalOldPassword("");
    setModalNewPassword("");
    setModalConfirmPassword("");
    setModalPasswordNotice("");
    setShowChangePasswordModal(true);
  }, []);

  const closeChangePasswordModal = useCallback(
    () => setShowChangePasswordModal(false),
    [],
  );

  const copyCreatedToken = useCallback(() => {
    navigator.clipboard.writeText(createdSecretToken);
    notify("API 密钥", "密钥已复制到剪贴板");
  }, [createdSecretToken, notify]);

  return {
    currentUser,
    profileDisplayNameInput,
    setProfileDisplayNameInput,
    profileEmailInput,
    setProfileEmailInput,
    profileBioInput,
    setProfileBioInput,
    profilePasswordNotice,
    saveProfile,
    avatarDraft,
    setAvatarDraft,
    showAvatarModal,
    openAvatarModal,
    closeAvatarModal,
    handleAvatarSave,
    showChangePasswordModal,
    openChangePasswordModal,
    closeChangePasswordModal,
    modalOldPassword,
    setModalOldPassword,
    modalNewPassword,
    setModalNewPassword,
    modalConfirmPassword,
    setModalConfirmPassword,
    modalPasswordNotice,
    handleModalPasswordSave,
    activeSessions,
    loadingSessions,
    handleRevokeSession,
    handleRevokeOtherSessions,
    apiTokens,
    loadingTokens,
    newTokenNameInput,
    setNewTokenNameInput,
    createdSecretToken,
    handleCreateToken,
    handleRevokeToken,
    copyCreatedToken,
  };
}
