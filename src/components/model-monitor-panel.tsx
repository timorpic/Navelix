"use client";

import { useCallback, useEffect, useState } from "react";
import { useNavelixConfig } from "@/hooks/use-navelix-config";
import { trackClientEvent } from "@/lib/client-analytics";
import type { MonitorAccount } from "./model-monitor-types";
import { PROVIDER_META } from "./model-monitor-types";
import { AccountCard } from "./model-monitor-cards";

export default function ModelMonitorPanel() {
  const { config, updateConfig } = useNavelixConfig();
  const [accounts, setAccounts] = useState<MonitorAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<"antigravity" | "codex" | null>(null);
  const [activeSession, setActiveSession] = useState<{
    provider: "antigravity" | "codex";
    state: string;
  } | null>(null);
  const [callbackUrl, setCallbackUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<"antigravity" | "codex">("antigravity");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/monitor/accounts");
      const data = await res.json();
      if (data.accounts) setAccounts(data.accounts);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      load();
    });
    // 可选遥测：打开额度监控面板（规范 wiki/Analytics §4.7）
    trackClientEvent("monitor.quota_view", { action: "open" });
  }, [load]);

  const connect = async (provider: "antigravity" | "codex") => {
    setMessage("");
    setConnecting(provider);
    try {
      const res = await fetch("/api/monitor/oauth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "发起授权失败");
        setConnecting(null);
        return;
      }
      window.open(data.url, "_blank", "noopener,noreferrer");
      setActiveSession({ provider, state: data.state });
      setCallbackUrl("");
    } catch {
      setMessage("发起授权失败");
      setConnecting(null);
    }
  };

  const cancelConnect = () => {
    setActiveSession(null);
    setConnecting(null);
    setCallbackUrl("");
  };

  const submitCallback = async () => {
    if (!activeSession || !callbackUrl.trim()) return;
    setSubmitting(true);
    setMessage("");
    try {
      const res = await fetch("/api/monitor/oauth/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: activeSession.provider, callbackUrl: callbackUrl.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setActiveSession(null);
        setConnecting(null);
        setCallbackUrl("");
        setMessage("授权成功，账号已添加");
        window.setTimeout(() => setMessage(""), 4000);
        load();
      } else {
        setMessage(data.error || "授权处理失败");
        window.setTimeout(() => setMessage(""), 6000);
      }
    } catch {
      setMessage("提交回调地址失败，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  const refresh = async (id: string) => {
    setRefreshingId(id);
    try {
      const res = await fetch("/api/monitor/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.account) {
        setAccounts((prev) => prev.map((a) => (a.id === id ? data.account : a)));
      } else {
        setMessage(data.error || "刷新失败");
      }
      load();
    } catch {
      setMessage("刷新失败");
    } finally {
      setRefreshingId(null);
    }
  };

  const disconnect = async (id: string) => {
    try {
      const res = await fetch("/api/monitor/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setAccounts((prev) => prev.filter((a) => a.id !== id));
        setMessage("账号已断开");
        window.setTimeout(() => setMessage(""), 3000);
      }
    } catch {
      // ignore
    }
  };

  const antigravityAccounts = accounts.filter((a) => a.provider === "antigravity");
  const codexAccounts = accounts.filter((a) => a.provider === "codex");

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100/90 dark:border-slate-700 shadow-2xs transition-colors">
        <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100 dark:border-slate-700/60">
          <span className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-[#00C776] text-lg flex items-center justify-center">
            🧠
          </span>
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">模型监控</h3>
            <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
              反重力 / Codex 账号与调用额度监控
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700">
          <div>
            <p className="text-xs font-bold text-gray-800 dark:text-slate-200">前台侧边栏模型监控</p>
            <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">
              在首页右侧边栏显示模型监控小组件
            </p>
          </div>
          <button
            onClick={() => updateConfig({ modelMonitorEnabled: !config.modelMonitorEnabled })}
            role="switch"
            aria-checked={!!config.modelMonitorEnabled}
            className={`relative h-6 w-11 rounded-full transition-colors cursor-pointer shrink-0 ${
              config.modelMonitorEnabled ? "bg-[#00C776]" : "bg-gray-300 dark:bg-slate-600"
            }`}
            title={config.modelMonitorEnabled ? "点击隐藏前台侧边栏模型监控" : "点击显示前台侧边栏模型监控"}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                config.modelMonitorEnabled ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        </div>

        {message && (
          <div className="mt-4 px-3 py-2 rounded-lg bg-teal-50 dark:bg-teal-950/50 border border-teal-100 dark:border-teal-900 text-xs text-teal-700 dark:text-teal-300">
            {message}
          </div>
        )}

        <div className="mt-4 flex items-center gap-1 p-1 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700">
          {(Object.keys(PROVIDER_META) as Array<"antigravity" | "codex">).map((p) => {
            const meta = PROVIDER_META[p];
            return (
              <button
                key={p}
                onClick={() => setTab(p)}
                className={`flex-1 h-9 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  tab === p
                    ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200"
                }`}
              >
                {meta.icon} {meta.shortLabel}
              </button>
            );
          })}
        </div>

        {loading ? (
          <p className="py-8 text-center text-xs text-gray-400 dark:text-slate-400">加载账号列表中…</p>
        ) : (
          <div className="mt-4">
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-lg ${PROVIDER_META[tab].color}`}>{PROVIDER_META[tab].icon}</span>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{PROVIDER_META[tab].label}</p>
                    <p className="text-[11px] text-gray-400 dark:text-slate-400">{PROVIDER_META[tab].desc}</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => connect(tab)}
                disabled={connecting !== null}
                className="w-full h-9 rounded-xl bg-[#00C776] hover:bg-[#009a5a] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                {connecting === tab && activeSession
                  ? "等待粘贴回调地址…"
                  : tab === "antigravity"
                    ? "＋ 连接反重力账号"
                    : "＋ 连接 Codex 账号"}
              </button>

              {connecting === tab && activeSession && (
                <div className="space-y-2">
                  <p className="text-[11px] text-gray-400 dark:text-slate-400 leading-relaxed">
                    请在浏览器中完成授权。授权完成后浏览器地址栏会跳转到一个类似
                    <code className="mx-1 px-1 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-[10px] break-all">
                      localhost:{tab === "antigravity" ? 51121 : 1455}/...?code=...
                    </code>
                    的地址，请将浏览器地址栏中的完整回调地址复制并粘贴到下方：
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={callbackUrl}
                      onChange={(e) => setCallbackUrl(e.target.value)}
                      placeholder="粘贴完整回调地址（含 code= 与 state=）"
                      className="flex-1 min-w-0 h-9 px-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-600 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-[#00C776] transition-colors"
                    />
                    <button
                      onClick={submitCallback}
                      disabled={submitting || !callbackUrl.trim()}
                      className="h-9 px-4 rounded-xl bg-[#00C776] hover:bg-[#009a5a] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors cursor-pointer shrink-0"
                    >
                      {submitting ? "处理中…" : "提交"}
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-400 dark:text-slate-500">
                      提交后系统会自动读取 code 完成登录
                    </span>
                    <button
                      onClick={cancelConnect}
                      className="text-[11px] text-gray-400 hover:text-rose-500 transition-colors cursor-pointer"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4">
              {tab === "antigravity" ? (
                antigravityAccounts.length === 0 ? (
                  <p className="py-4 px-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-dashed border-gray-200 dark:border-slate-700 text-center text-xs text-gray-400 dark:text-slate-400">
                    尚未连接反重力账号
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {antigravityAccounts.map((a) => (
                      <AccountCard
                        key={a.id}
                        account={a}
                        refreshing={refreshingId === a.id}
                        onRefresh={() => refresh(a.id)}
                        onDisconnect={() => disconnect(a.id)}
                      />
                    ))}
                  </div>
                )
              ) : codexAccounts.length === 0 ? (
                <p className="py-4 px-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-dashed border-gray-200 dark:border-slate-700 text-center text-xs text-gray-400 dark:text-slate-400">
                  尚未连接 Codex 账号
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {codexAccounts.map((a) => (
                    <AccountCard
                      key={a.id}
                      account={a}
                      refreshing={refreshingId === a.id}
                      onRefresh={() => refresh(a.id)}
                      onDisconnect={() => disconnect(a.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {accounts.length === 0 && (
              <p className="mt-6 text-[11px] text-gray-400 dark:text-slate-500 leading-relaxed">
                <strong>提示：</strong>授权完成后需手动把浏览器返回的回调地址粘贴给系统。
                若 Navelix 与 CLIProxyAPI 运行在同一台机器，回调地址的端口（反重力 51121 / Codex 1455）
                会被本机其它程序监听，但浏览器地址栏中的回调地址仍可直接复制使用，不影响授权。
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
