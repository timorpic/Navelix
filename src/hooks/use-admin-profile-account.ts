"use client";

import { useText } from "@/hooks/use-text";
import { useTranslations } from "next-intl";
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
  const tx = useTranslations();
  const text = useText();
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
          notify(tx("session_management_359656f3"), tx("selected_device_signed_out_securely_afa241df"));
          fetchSessions();
        }
      } catch {
        // ignore
      }
    },
    [notify, fetchSessions, tx],
  );

  const handleRevokeOtherSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke_others" }),
      });
      if (res.ok) {
        notify(tx("session_management_359656f3"), tx("all_other_device_sessions_signed_out_f2c56300"));
        fetchSessions();
      }
    } catch {
      // ignore
    }
  }, [notify, fetchSessions, tx]);

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
          notify(tx("api_token_5f600b30"), tx("token_generated_7976e94a"));
          fetchApiTokens();
        }
      } catch {
        // ignore
      }
    },
    [newTokenNameInput, notify, fetchApiTokens, tx],
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
          notify(tx("api_token_5f600b30"), tx("token_revoked_9cd0cc0d"));
          fetchApiTokens();
        }
      } catch {
        // ignore
      }
    },
    [notify, fetchApiTokens, tx],
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
          setProfilePasswordNotice(text(outcome.notice));
          notify(tx("my_account_78c6e04f"), tx("profile_and_bio_saved_2cd7352d"));
        } else {
          setProfilePasswordNotice(text(outcome.notice));
        }
      } catch {
        setProfilePasswordNotice(tx("failed_to_update_profile_90539276"));
      }
    },
    [notify, tx, text],
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
          setModalPasswordNotice(tx("password_changed_adbcaa5a"));
          notify(tx("my_account_78c6e04f"), tx("sign_in_password_updated_successfully_aa9bf492"));
          updateConfig({ securitySetupDone: true });
          setTimeout(() => {
            setShowChangePasswordModal(false);
            setModalOldPassword("");
            setModalNewPassword("");
            setModalConfirmPassword("");
            setModalPasswordNotice("");
          }, 1000);
        } else {
          setModalPasswordNotice(`❌ ${data.message || data.error || tx("failed_to_change_password_878b622b")}`);
        }
      } catch {
        setModalPasswordNotice(tx("network_or_server_error_update_failed_0c94fbbc"));
      }
    },
    [modalOldPassword, modalNewPassword, modalConfirmPassword, notify, updateConfig, tx],
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
          notify(tx("system_settings_68ea5dd4"), tx("avatar_updated_ca41b3cb"));
        } else {
          flash(data.message || data.error || tx("failed_to_save_avatar_c88b32f6"));
        }
      } catch {
        flash(tx("failed_to_save_avatar_c88b32f6"));
      }
    },
    [avatarDraft, notify, flash, tx],
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
    notify(tx("api_token_5f600b30"), tx("token_copied_to_clipboard_dc670ce4"));
  }, [createdSecretToken, notify, tx]);

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
