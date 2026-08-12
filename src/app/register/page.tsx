"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("两次输入的密码不一致");
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
      setError(data.error || "注册失败");
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
      <div className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#00C776] to-[#009a5a] text-lg font-bold text-white shadow-sm">
            N
          </div>
          <h1 className="text-xl font-bold text-gray-900">创建新账号</h1>
          <p className="mt-1 text-center text-xs text-gray-400">
            加入 Navelix 数字工作空间
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="register-username"
              className="mb-1.5 block text-xs font-medium text-gray-500"
            >
              用户名
            </label>
            <input
              id="register-username"
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="3-20 位字符（字母、数字、下划线）"
              className={inputClass}
              autoFocus
            />
          </div>
          <div>
            <label
              htmlFor="register-display-name"
              className="mb-1.5 block text-xs font-medium text-gray-500"
            >
              显示名称（可选）
            </label>
            <input
              id="register-display-name"
              name="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="例如 小明"
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="register-password"
              className="mb-1.5 block text-xs font-medium text-gray-500"
            >
              密码
            </label>
            <input
              id="register-password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 6 位字符"
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="register-confirm"
              className="mb-1.5 block text-xs font-medium text-gray-500"
            >
              确认密码
            </label>
            <input
              id="register-confirm"
              name="confirmPassword"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="请再次输入密码"
              className={inputClass}
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="h-10 w-full rounded-lg bg-[#00C776] text-sm font-semibold text-white transition-colors hover:bg-[#009a5a] disabled:opacity-60 cursor-pointer"
          >
            {loading ? "正在创建..." : "立即注册"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-gray-400">
          已有账号？{" "}
          <Link
            href="/login"
            className="font-medium text-[#00C776] hover:underline"
          >
            直接登录
          </Link>
        </p>
      </div>
    </div>
  );
}
