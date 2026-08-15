"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useNavelixConfig } from "@/hooks/use-navelix-config";

interface SenseNovaModelUsage {
  name: string;
  remaining_pct: number;
  remaining_label: string;
}

interface SenseNovaUsageData {
  configured: boolean;
  enabled?: boolean;
  models: SenseNovaModelUsage[];
  timestamp: string;
  account_id: string;
  error?: boolean;
  message?: string;
}

function getBarColor(pct: number): string {
  if (pct >= 50) return "#00C776";
  if (pct >= 20) return "#FF9F00";
  return "#FF3B30";
}

export default function ModelMonitorPanel() {
  const { config, updateConfig } = useNavelixConfig();

  // ── 商汤 (SenseNova) 状态 ──
  const [sensenovaData, setSensenovaData] = useState<SenseNovaUsageData | null>(null);
  const [sensenovaLoading, setSensenovaLoading] = useState(true);
  const [sensenovaRefreshing, setSensenovaRefreshing] = useState(false);
  const [sensenovaLastUpdated, setSensenovaLastUpdated] = useState<Date | null>(null);
  const [snUsername, setSnUsername] = useState(config.sensenovaUsername || "");
  const [snPassword, setSnPassword] = useState("");
  const [snAccountId, setSnAccountId] = useState(config.sensenovaAccountId || "");
  const [snTokenKey, setSnTokenKey] = useState("");
  const [snEnabled, setSnEnabled] = useState(Boolean(config.sensenovaEnabled));
  const [snSavedNotice, setSnSavedNotice] = useState("");

  // 跨设备与加载时同步最新已存配置
  useEffect(() => {
    if (config.sensenovaUsername !== undefined) setSnUsername(config.sensenovaUsername || "");
    if (config.sensenovaAccountId !== undefined) setSnAccountId(config.sensenovaAccountId || "");
    if (config.sensenovaEnabled !== undefined) setSnEnabled(Boolean(config.sensenovaEnabled));
  }, [config.sensenovaUsername, config.sensenovaAccountId, config.sensenovaEnabled]);

  // 拉取商汤用量数据
  const fetchSenseNovaData = useCallback(async (isManual = false) => {
    if (isManual) setSensenovaRefreshing(true);
    else setSensenovaLoading(true);
    try {
      const res = await fetch("/api/sensenova/usage", { cache: "no-store" });
      const json = (await res.json()) as SenseNovaUsageData;
      if (res.ok) {
        setSensenovaData(json);
        setSensenovaLastUpdated(new Date());
      } else if (res.status === 401) {
        setSensenovaData({
          configured: true,
          models: [],
          timestamp: "",
          account_id: "",
          error: true,
          message: "未登录，无法加载",
        });
      } else {
        setSensenovaData({
          configured: true,
          models: [],
          timestamp: "",
          account_id: "",
          error: true,
          message: json.message || "加载失败",
        });
      }
    } catch {
      setSensenovaData({
        configured: true,
        models: [],
        timestamp: "",
        account_id: "",
        error: true,
        message: "网络请求失败，请稍后重试",
      });
    } finally {
      setSensenovaLoading(false);
      setSensenovaRefreshing(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      fetchSenseNovaData();
    });
  }, [fetchSenseNovaData]);

  // 保存商汤配置
  const handleSaveSenseNovaConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateConfig({
      sensenovaEnabled: snEnabled,
      sensenovaUsername: snUsername,
      sensenovaPassword: snPassword,
      sensenovaAccountId: snAccountId,
      sensenovaTokenKey: snTokenKey,
    });
    setSnSavedNotice("商汤配置已保存，正在刷新用量...");
    setTimeout(() => setSnSavedNotice(""), 3500);
    fetchSenseNovaData(true);
  };

  return (
    <div className="space-y-6">
      {/* ── 商汤 (SenseNova) 模型用量与凭据配置面板 ── */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-2xs transition-colors space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100 dark:border-slate-700/60">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-[#00C776] text-lg flex items-center justify-center">
              🧠
            </span>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span>商汤 (SenseNova) 模型用量面板</span>
                {sensenovaLastUpdated && (
                  <span className="text-[11px] font-normal text-gray-400 dark:text-slate-500 font-mono">
                    (更新于 {sensenovaLastUpdated.toLocaleTimeString("zh-CN")})
                  </span>
                )}
              </h3>
              <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
                实时展示商汤各模型当前 5 小时计费窗口剩余调用余量（前台侧边栏每 5 分钟自动刷新）
              </p>
            </div>
          </div>

          <button
            onClick={() => fetchSenseNovaData(true)}
            disabled={sensenovaRefreshing}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-800 dark:text-slate-100 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <span className={sensenovaRefreshing ? "animate-spin" : ""}>🔄</span>
            <span>{sensenovaRefreshing ? "正在刷新..." : "立即刷新余量"}</span>
          </button>
        </div>

        {/* 商汤模型用量卡片网格 */}
        {sensenovaLoading ? (
          <div className="py-8 text-center text-xs text-gray-400 dark:text-slate-500">
            正在读取商汤各模型计费窗口剩余调用余量...
          </div>
        ) : sensenovaData?.error ? (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300 flex items-center justify-between">
            <span>⚠️ 商汤用量读取异常: {sensenovaData.message || "请检查下方账号密码与网络配置"}</span>
            <button
              onClick={() => fetchSenseNovaData(true)}
              className="font-bold underline cursor-pointer hover:text-red-900"
            >
              重试
            </button>
          </div>
        ) : !sensenovaData?.configured || sensenovaData?.models.length === 0 ? (
          <div className="p-6 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 text-center space-y-2">
            <span className="text-xl">⚠️</span>
            <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
              尚未配置商汤账号密码，或当前未启用监控面板
            </p>
            <p className="text-[11px] text-amber-600 dark:text-amber-400 max-w-md mx-auto">
              请在下方填入您的商汤账号、登录密码及账号 ID，保存后即可开启实时计费窗口调用余量监控。
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {sensenovaData.models.map((m) => (
              <div
                key={m.name}
                className="p-4 rounded-xl bg-gray-50/80 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800 flex flex-col justify-between gap-3 shadow-2xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono font-bold text-xs text-gray-900 dark:text-white truncate" title={m.name}>
                    {m.name}
                  </span>
                  <span
                    className="font-mono text-xs font-black shrink-0 px-2 py-0.5 rounded-md"
                    style={{
                      backgroundColor: `${getBarColor(m.remaining_pct)}15`,
                      color: getBarColor(m.remaining_pct),
                    }}
                  >
                    {m.remaining_label}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="h-2 w-full bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${Math.min(Math.max(m.remaining_pct, 0), 100)}%`,
                        backgroundColor: getBarColor(m.remaining_pct),
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-slate-500">
                    <span>5h 窗口配额余量</span>
                    <span className={m.remaining_pct >= 20 ? "text-[#00C776] font-bold" : "text-red-500 font-bold"}>
                      {m.remaining_pct >= 50 ? "余量充足" : m.remaining_pct >= 20 ? "余量适中" : "余量紧张"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 商汤账号与凭据配置表单 */}
        <div className="pt-4 border-t border-gray-100 dark:border-slate-700/60">
          <h4 className="text-xs font-bold text-gray-800 dark:text-slate-200 mb-3 flex items-center gap-1.5">
            <span>⚙️</span>
            <span>商汤账号凭据与前台显隐设置</span>
          </h4>

          <form onSubmit={handleSaveSenseNovaConfig} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-600 dark:text-slate-300 mb-1">
                  商汤账号 (Username)
                </label>
                <input
                  type="text"
                  value={snUsername}
                  onChange={(e) => setSnUsername(e.target.value)}
                  placeholder="商汤用户名 / 手机号"
                  className="w-full h-9 px-2.5 text-xs bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-600 dark:text-slate-300 mb-1">
                  <span>商汤密码 (Password)</span>
                  {config.sensenovaConfigured && (
                    <span className="ml-1 text-[10px] text-[#00C776] font-normal">
                      (✓ 服务端已保存)
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  value={snPassword}
                  onChange={(e) => setSnPassword(e.target.value)}
                  placeholder={config.sensenovaConfigured ? "已安全保存 · 留空保持不变" : "商汤登录密码"}
                  className="w-full h-9 px-2.5 text-xs bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-600 dark:text-slate-300 mb-1">
                  账号 ID (Account ID)
                </label>
                <input
                  type="text"
                  value={snAccountId}
                  onChange={(e) => setSnAccountId(e.target.value)}
                  placeholder="留空则用默认账号 ID"
                  className="w-full h-9 px-2.5 text-xs bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-600 dark:text-slate-300 mb-1">
                  Token 密钥 (可选)
                </label>
                <input
                  type="password"
                  value={snTokenKey}
                  onChange={(e) => setSnTokenKey(e.target.value)}
                  placeholder="留空使用默认密钥"
                  className="w-full h-9 px-2.5 text-xs bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-600 dark:text-slate-300 mb-1">
                  前台显隐开关
                </label>
                <div className="flex items-center gap-2 h-9">
                  <button
                    type="button"
                    onClick={() => setSnEnabled(!snEnabled)}
                    className={`w-full h-9 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      snEnabled
                        ? "bg-[#00C776] text-white shadow-2xs"
                        : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
                    }`}
                  >
                    {snEnabled ? "已启用 (前台展示)" : "已禁用 (前台隐藏)"}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                {snSavedNotice}
              </span>
              <button
                type="submit"
                className="px-4 py-2 bg-[#00C776] hover:bg-[#00B068] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                💾 保存商汤配置
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
