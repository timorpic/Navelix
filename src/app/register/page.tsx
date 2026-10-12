"use client";

import LanguageSwitcher from "@/components/language-switcher";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function RegisterPage() {
  const tx = useTranslations();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // null = 状态加载中；false = 已关闭；true = 已开放
  const [allowRegistration, setAllowRegistration] = useState<boolean | null>(null);

  // 读取公开注册开关：关闭时展示提示而非表单，避免等提交才被后端拒绝
  useEffect(() => {
    fetch("/api/auth/register")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.allowRegistration === "boolean") {
          setAllowRegistration(d.allowRegistration);
        }
      })
      .catch(() => setAllowRegistration(true));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError(tx("passwords_do_not_match_58807745"));
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, displayName }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.message || data.error || tx("registration_failed_6d57824e"));
      setLoading(false);
      return;
    }
    router.push("/");
    router.refresh();
  };

  const inputClass =
    "h-10 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-[#00C776] focus:outline-none focus:ring-2 focus:ring-[#00C776]/20";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F6F8FA] px-4">
      <div className="absolute top-4 right-4 rounded-xl bg-white p-2"><LanguageSwitcher /></div>
      <div className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#00C776] to-[#009a5a] text-lg font-bold text-white shadow-sm">
            N
          </div>
          <h1 className="text-xl font-bold text-gray-900">{tx("create_account_4cebd79c")}</h1>
          <p className="mt-1 text-center text-xs text-gray-400">
            {tx("join_your_navelix_workspace_a61cc775")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {allowRegistration === false ? (
            <div className="rounded-lg border border-amber-100 bg-amber-50 p-4 text-center">
              <p className="text-sm font-semibold text-amber-800">{tx("registration_is_closed_eba45b2b")}</p>
              <p className="mt-1 text-xs text-amber-600">
                {tx("self_service_registration_is_disabled_contact_an_2c0ff24b")}</p>
            </div>
          ) : (
            <>
              <div>
            <label
              htmlFor="register-username"
              className="mb-1.5 block text-xs font-medium text-gray-500"
            >
              {tx("username_1a3f0617")}</label>
            <input
              id="register-username"
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={tx("3_20_characters_letters_numbers_or_underscores_b263e8b3")}
              className={inputClass}
              autoFocus
            />
          </div>
          <div>
            <label
              htmlFor="register-display-name"
              className="mb-1.5 block text-xs font-medium text-gray-500"
            >
              {tx("display_name_optional_7eb0a325")}</label>
            <input
              id="register-display-name"
              name="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={tx("e_g_alex_3a823c0a")}
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="register-password"
              className="mb-1.5 block text-xs font-medium text-gray-500"
            >
              {tx("password_a621ab60")}</label>
            <input
              id="register-password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={tx("at_least_6_characters_bff75c65")}
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="register-confirm"
              className="mb-1.5 block text-xs font-medium text-gray-500"
            >
              {tx("confirm_password_81b17bc0")}</label>
            <input
              id="register-confirm"
              name="confirmPassword"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={tx("enter_your_password_again_901b301d")}
              className={inputClass}
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="h-10 w-full rounded-lg bg-[#00C776] text-sm font-semibold text-white transition-colors hover:bg-[#009a5a] disabled:opacity-60 cursor-pointer"
          >
            {loading ? tx("creating_799d2061") : tx("register_5bddf41d")}
          </button>
            </>
          )}
        </form>

        <p className="mt-5 text-center text-xs text-gray-400">
          {tx("already_have_an_account_bbaffe14")}{" "}
          <Link
            href="/login"
            className="font-medium text-[#00C776] hover:underline"
          >
            {tx("sign_in_3ee55f9e")}</Link>
        </p>
      </div>
    </div>
  );
}
