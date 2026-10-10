"use client";

import { useState } from "react";
import { useNavelixConfig } from "@/context/navelix-context";

/**
 * 「个人账号与安全」Tab 的卡片 3：🤖 AI Copilot 配置。
 *
 * 从 `admin-profile-tab.tsx`（原 1219 行）抽出 —— 地址 / 模型直接读写
 * `useNavelixConfig()`，密钥输入框是本卡片唯一的局部 state，独立成组件后
 * 父组件不必再为它保留 state。
 */
export default function AdminProfileAiCard({
  notify,
}: {
  /** 展示提示并写入通知中心（来自 useToast） */
  notify: (title: string, msg: string) => void;
}) {
  const { config, updateConfig } = useNavelixConfig();
  // 密钥不会从服务端回传；输入框仅在本次填写时保存，提交后立即清空。
  const [aiApiKeyInput, setAiApiKeyInput] = useState("");

  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
            <span>🤖</span>
            <span>AI Copilot 配置</span>
          </h3>
          <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
            配置 OpenAI 兼容接口，支持 OpenAI、DeepSeek、通义千问、Ollama 等服务。
          </p>
        </div>
        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          config.aiKeyConfigured
            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900"
            : "bg-gray-50 text-gray-500 border-gray-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700"
        }`}>
          {config.aiKeyConfigured ? "密钥已配置" : "尚未配置密钥"}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label htmlFor="admin-ai-base-url" className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
            API Base URL
          </label>
          <input
            id="admin-ai-base-url"
            name="aiBaseUrl"
            type="url"
            defaultValue={config.aiBaseUrl || "https://api.openai.com/v1"}
            onBlur={(e) => {
              const value = e.target.value.trim();
              if (value !== (config.aiBaseUrl || "")) updateConfig({ aiBaseUrl: value });
            }}
            placeholder="https://api.openai.com/v1"
            className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
          />
        </div>

        <div>
          <label htmlFor="admin-ai-model" className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
            模型名称
          </label>
          <input
            id="admin-ai-model"
            name="aiModel"
            type="text"
            defaultValue={config.aiModel || "gpt-4o-mini"}
            onBlur={(e) => {
              const value = e.target.value.trim();
              if (value !== (config.aiModel || "")) updateConfig({ aiModel: value });
            }}
            placeholder="gpt-4o-mini 或 deepseek-chat"
            className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
          />
        </div>

        <div>
          <label htmlFor="admin-ai-api-key" className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
            API Key
          </label>
          <input
            id="admin-ai-api-key"
            name="aiApiKey"
            type="password"
            value={aiApiKeyInput}
            onChange={(e) => setAiApiKeyInput(e.target.value)}
            onBlur={() => {
              const value = aiApiKeyInput.trim();
              if (!value) return;
              updateConfig({ aiApiKey: value, aiKeyConfigured: true });
              setAiApiKeyInput("");
              notify("AI Copilot", "API Key 已安全保存");
            }}
            placeholder={config.aiKeyConfigured ? "已配置；填入新值即可覆盖" : "sk-..."}
            autoComplete="new-password"
            className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
          />
        </div>
      </div>

      <p className="text-[10px] text-gray-400 dark:text-slate-500">
        地址与模型在失焦后保存；密钥仅用于提交，保存后不会再次显示。
      </p>
    </div>
  );
}
