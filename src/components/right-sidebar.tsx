"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useNavelixConfig } from "@/hooks/use-navelix-config";
import { useNavelixData } from "@/hooks/use-navelix-data";
import type { AIChatMessage } from "@/types";
import TodoWidget from "./todo-widget";
import FocusStatsWidget from "./focus-stats-widget";
import ActivityFeed from "./activity-feed";

export default function RightSidebar() {
  const { config } = useNavelixConfig();
  const { links } = useNavelixData();

  // Interactive AI Chat State
  const [chatMessages, setChatMessages] = useState<AIChatMessage[]>([
    {
      id: "1",
      sender: "ai",
      text: "Hi! 👋 有什么我可以帮你的吗？",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const handleSendChat = async (textToSend?: string) => {
    const text = (textToSend || chatInput).trim();
    if (!text) return;

    const userMsg: AIChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text,
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setIsTyping(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          history: chatMessages.slice(-4),
        }),
      });

      const data = await res.json();
      const aiResponse = data.text || "无法获取 AI 响应。";

      setChatMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), sender: "ai", text: aiResponse },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: "ai",
          text: "⚠️ 网络请求失败，请稍后再试。",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const normalizeSocialHref = (key: string, value?: string): string | null => {
    const v = value?.trim();
    if (!v) return null;
    if (key === "email") {
      return /^mailto:/i.test(v) ? v : `mailto:${v}`;
    }
    return /^https?:\/\//i.test(v) ? v : `https://${v}`;
  };

  const socialLinks = [
    {
      key: "github",
      href: config.socialGithub,
      label: "GitHub",
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
        </svg>
      ),
    },
    {
      key: "x",
      href: config.socialX,
      label: "X",
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
    {
      key: "linkedin",
      href: config.socialLinkedin,
      label: "LinkedIn",
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
        </svg>
      ),
    },
    {
      key: "email",
      href: config.socialEmail,
      label: "Email",
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
        </svg>
      ),
    },
  ].filter((s) => s.href?.trim());

  return (
    <aside className="w-full lg:w-80 shrink-0 flex flex-col bg-white/50 dark:bg-slate-900/90 backdrop-blur-sm border-t border-gray-100 dark:border-slate-800 lg:border-t-0 lg:border-l lg:sticky lg:top-0 lg:h-screen transition-colors duration-200">
      {/* 可滚动内容区 */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-5 p-4 lg:p-6">
      {/* Widget 1: AI Assistant */}
      <div className="flex flex-col bg-gradient-to-b from-[#F2FBFB] to-[#E8F8F8] dark:from-[#1c1920] dark:to-[#252028] rounded-2xl p-4 border border-[#D5F2F2] dark:border-[#00c776]/30 shadow-2xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm">🤖</span>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">AI 智能助手</h3>
          </div>
          <span className="h-2 w-2 rounded-full bg-[#00C776] animate-pulse" />
        </div>

        {/* Chat Messages Log */}
        <div className="flex flex-col gap-2.5 max-h-44 overflow-y-auto pr-1 mb-3">
          {chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.sender === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[88%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                  msg.sender === "user"
                    ? "bg-[#00C776] text-white rounded-br-none"
                    : "bg-white/90 dark:bg-slate-800 text-gray-800 dark:text-slate-100 shadow-2xs border border-gray-100 dark:border-slate-700 rounded-bl-none"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white/90 dark:bg-slate-800 text-gray-400 dark:text-slate-400 text-xs px-3 py-2 rounded-xl rounded-bl-none shadow-2xs flex items-center gap-1">
                <span className="animate-ping">•</span>
                <span>AI 正在思考...</span>
              </div>
            </div>
          )}
        </div>

        {/* Chat Input */}
        <div className="relative mb-3">
          <input
            id="right-sidebar-ai-input"
            name="ai-chat-input"
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
            aria-label="请输入你的问题"
            placeholder="请输入你的问题..."
            className="w-full pl-3 pr-9 py-2 bg-white/90 dark:bg-slate-900 rounded-xl border border-gray-200/80 dark:border-slate-700 text-xs text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00C776]/40 focus:border-[#00C776]"
          />
          <button
            onClick={() => handleSendChat()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#00C776] hover:text-[#009a5a] transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4 transform rotate-90" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>

        {/* Quick Action Prompt Chips */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => handleSendChat("请帮我总结网页内容")}
            className="px-2.5 py-1 bg-white/80 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 text-[11px] font-medium text-gray-600 dark:text-slate-300 hover:text-[#00C776] rounded-lg border border-gray-200/60 dark:border-slate-700 shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
          >
            <span>💡</span> 总结网页内容
          </button>
          <button
            onClick={() => handleSendChat("请帮我生成一段文案")}
            className="px-2.5 py-1 bg-white/80 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 text-[11px] font-medium text-gray-600 dark:text-slate-300 hover:text-[#00C776] rounded-lg border border-gray-200/60 dark:border-slate-700 shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
          >
            <span>🎨</span> 生成文案
          </button>
          <button
            onClick={() => handleSendChat("请帮我进行代码优化")}
            className="px-2.5 py-1 bg-white/80 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 text-[11px] font-medium text-gray-600 dark:text-slate-300 hover:text-[#00C776] rounded-lg border border-gray-200/60 dark:border-slate-700 shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
          >
            <span>⚡</span> 代码优化
          </button>
        </div>
      </div>

      {/* Widget 1.4: Focus Stats */}
      <FocusStatsWidget />

      {/* Widget 1.5: Todo List */}
      <TodoWidget />

      {/* Widget 2: Activity Feed */}
      <ActivityFeed links={links} />

      {/* Widget 4: Inspiration Quote Card */}
      <div className="flex flex-col bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-gray-100 dark:border-slate-700 shadow-2xs transition-colors">
        <div className="text-lg text-[#00C776]/30 font-serif leading-none mb-1">
          "
        </div>
        <p className="text-xs font-semibold text-gray-800 dark:text-slate-100 leading-relaxed italic mb-2">
          持续构建，长期主义，让技术创造更多价值。
        </p>
        <p className="text-[11px] font-medium text-gray-400 dark:text-slate-400 text-right">
          Powered By ibin_timorpic
        </p>
      </div>

      </div>
      {/* Footer Social Icons */}
      <div className="flex items-center justify-between px-4 lg:px-6 py-3 text-gray-400 dark:text-slate-500 border-t border-gray-100 dark:border-slate-800">
        <span className="text-[10px]">Navelix v2.0</span>
        <div className="flex items-center gap-3">
          {socialLinks.map((s) => {
            const href = normalizeSocialHref(s.key, s.href);
            if (!href) return null;
            return (
              <a
                key={s.key}
                href={href}
                aria-label={s.label}
                target={s.key === "email" ? undefined : "_blank"}
                rel={s.key === "email" ? undefined : "noopener noreferrer"}
                className="hover:text-gray-700 dark:hover:text-white transition-colors"
              >
                {s.icon}
              </a>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
