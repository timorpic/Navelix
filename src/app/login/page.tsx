"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import BrandLogo from "@/components/brand-logo";
import BrandLogoText from "@/components/brand-logo-text";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "登录失败，请检查用户名或密码");
      setLoading(false);
      return;
    }
    router.push(next);
    router.refresh();
  };

  const fieldClass =
    "h-11 w-full rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 shadow-sm transition-all focus:outline-none focus:ring-4 focus:ring-[#00C776]/10 focus:border-[#00C776]";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#0a2e1c] via-[#006b3a] to-[#0d4a2a] px-4 py-10">
      {/* 装饰背景：网格 + 浮动光斑 */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:44px_44px]" />
        <div className="absolute -left-24 -top-32 h-96 w-96 rounded-full bg-[#33d68a]/30 blur-3xl animate-float" />
        <div
          className="absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-[#009a5a]/40 blur-3xl animate-float"
          style={{ animationDelay: "1.5s" }}
        />
        <div
          className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[#00C776]/25 blur-3xl animate-float"
          style={{ animationDelay: "3s" }}
        />
      </div>

      <div className="relative z-10 grid w-full max-w-5xl items-center gap-12 lg:grid-cols-2">
        {/* 左侧品牌区 */}
        <div className="hidden flex-col gap-8 text-white lg:flex animate-slide-up">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gray-300 shadow-2xs overflow-hidden bg-white">
              <BrandLogo />
            </div>
            <BrandLogoText className="text-2xl font-bold tracking-tight" />
          </div>

          <div>
            <h1 className="text-4xl font-extrabold leading-tight">
              你的数字工作空间
            </h1>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-emerald-100/80">
              把常用入口、AI 助手与个人项目收进同一个首页，打开浏览器就是进入你的工作空间。
            </p>
          </div>

          <ul className="flex flex-col gap-3 text-sm text-emerald-50/90">
            <li className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 text-sm">
                🔗
              </span>
              网址导航与快捷访问
            </li>
            <li className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 text-sm">
                🤖
              </span>
              AI 智能助手
            </li>
            <li className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 text-sm">
                🎨
              </span>
              个性化个人工作台
            </li>
          </ul>

          <div className="flex items-center gap-2 text-xs text-emerald-100/60">
            <span className="h-px w-8 bg-white/30" />
            Navelix v2.0
          </div>
        </div>

        {/* 右侧登录卡片 */}
        <div className="mx-auto w-full max-w-md animate-slide-up">
          <div className="rounded-3xl border border-white/50 bg-white/85 p-8 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-10">
            {/* 移动端品牌 */}
            <div className="mb-8 flex flex-col items-center lg:hidden">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 shadow-2xs overflow-hidden bg-white">
                <BrandLogo />
              </div>
              <h1 className="text-xl font-bold text-gray-900">
                登录到 <BrandLogoText className="text-xl font-bold text-gray-900" />
              </h1>
              <p className="mt-1 text-xs text-gray-400">
                欢迎回到你的数字工作空间
              </p>
            </div>

            {/* 桌面端标题 */}
            <div className="mb-8 hidden lg:block">
              <h1 className="text-2xl font-bold text-gray-900">欢迎回来 👋</h1>
              <p className="mt-1.5 text-sm text-gray-500">
                登录后继续你的数字工作空间之旅
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="login-username"
                  className="mb-1.5 block text-xs font-medium text-gray-600"
                >
                  用户名
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg
                      className="h-4.5 w-4.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </span>
                  <input
                    id="login-username"
                    name="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="请输入用户名"
                    autoComplete="username"
                    autoFocus
                    className={`${fieldClass} pl-10 pr-4`}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="mb-1.5 block text-xs font-medium text-gray-600"
                >
                  密码
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg
                      className="h-4.5 w-4.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  </span>
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className={`${fieldClass} pl-10 pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "隐藏密码" : "显示密码"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 transition-colors hover:text-gray-600 cursor-pointer"
                  >
                    {showPassword ? (
                      <svg
                        className="h-4.5 w-4.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="h-4.5 w-4.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <p
                  key={error}
                  role="alert"
                  className="flex items-center gap-1.5 text-xs text-red-500 animate-shake"
                >
                  <svg
                    className="h-3.5 w-3.5 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="h-11 w-full rounded-xl bg-gradient-to-r from-[#009a5a] to-[#00C776] text-sm font-semibold text-white shadow-lg shadow-[#00C776]/25 transition-all hover:shadow-xl hover:shadow-[#00C776]/30 hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 cursor-pointer"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="h-4 w-4 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    正在登录…
                  </span>
                ) : (
                  "立即登录"
                )}
              </button>
            </form>

            <div className="my-6 flex items-center gap-3 text-xs text-gray-400">
              <span className="h-px flex-1 bg-gray-200" />
              或
              <span className="h-px flex-1 bg-gray-200" />
            </div>

            <p className="text-center text-sm text-gray-500">
              还没有账号？{" "}
              <Link
                href="/register"
                className="font-semibold text-[#009a5a] transition-colors hover:text-[#00C776]"
              >
                立即注册
              </Link>
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-emerald-100/60">
            © 2026 Navelix · 让每一个常用入口都在它该在的地方
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
