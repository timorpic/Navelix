"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavelixConfig } from "@/hooks/use-navelix-config";
import { useNavelixData } from "@/hooks/use-navelix-data";
import type { AIChatMessage, Project, TodoItem } from "@/types";
import ModelMonitorWidget from "./model-monitor-widget";

export default function RightSidebar({
  collapsed = false,
  onToggle,
}: {
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const { config } = useNavelixConfig();
  const { user } = useNavelixData();

  // 1. 用户与工作区实时数据
  const userName = user?.displayName || user?.username || config.logoText || "朋友";
  const [projects, setProjects] = useState<Project[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  // 2. 加载工作区上下文
  const loadWorkspaceData = useCallback(async () => {
    try {
      const [pRes, tRes] = await Promise.all([
        fetch("/api/projects").catch(() => null),
        fetch("/api/todos").catch(() => null),
      ]);
      if (pRes && pRes.ok) {
        const p = await pRes.json();
        if (Array.isArray(p.projects)) setProjects(p.projects);
      }
      if (tRes && tRes.ok) {
        const t = await tRes.json();
        if (Array.isArray(t.todos)) setTodos(t.todos);
      }
    } catch {
      // ignore
    } finally {
      setDataLoaded(true);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      loadWorkspaceData();
    });
    const handleUpdate = () => loadWorkspaceData();
    window.addEventListener("navelix-workspace-updated", handleUpdate);
    window.addEventListener("focus", handleUpdate);
    return () => {
      window.removeEventListener("navelix-workspace-updated", handleUpdate);
      window.removeEventListener("focus", handleUpdate);
    };
  }, [loadWorkspaceData]);

  // 3. 构建 Copilot 专属主动洞察与日程建议
  const copilotInsight = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    let greet = "你好";
    if (hour >= 5 && hour < 12) greet = "早上好";
    else if (hour >= 12 && hour < 14) greet = "中午好";
    else if (hour >= 14 && hour < 19) greet = "下午好";
    else greet = "晚上好";

    const inProgressProjects = projects.filter(
      (p) =>
        (p.status || "").includes("进行") ||
        (p.status || "").includes("开发") ||
        (p.status || "").includes("研究") ||
        (p.status || "").toLowerCase().includes("progress"),
    );

    const pendingTodos = todos.filter((t) => !t.done);
    const highPrioTodos = pendingTodos.filter((t) => t.priority === "high");

    // 发现列表
    const observations: string[] = [];
    if (inProgressProjects.length > 0) {
      observations.push(`• ${inProgressProjects[0].name} 正在推进中`);
    } else if (projects.length > 0) {
      observations.push(`• 已记录 ${projects.length} 个重点项目`);
    } else {
      observations.push("• 暂无进行中的项目，适合开启新规划");
    }

    if (pendingTodos.length > 0) {
      observations.push(`• 今天还有 ${pendingTodos.length} 项待处理待办`);
    } else {
      observations.push("• 今日待办已全部完成，状态极佳");
    }

    if (highPrioTodos.length > 0) {
      observations.push(`• 其中 ${highPrioTodos.length} 项为高优先级任务`);
    }

    // 建议列表
    const suggestions: string[] = [];
    if (highPrioTodos.length > 0) {
      suggestions.push(`① ${highPrioTodos[0].title}`);
    }
    if (inProgressProjects.length > 0 && suggestions.length < 3) {
      suggestions.push(`${suggestions.length === 0 ? "①" : suggestions.length === 1 ? "②" : "③"} ${inProgressProjects[0].name}`);
    }
    if (pendingTodos.length > 0 && suggestions.length < 3) {
      const otherTodo = pendingTodos.find((t) => !highPrioTodos.includes(t));
      if (otherTodo) {
        suggestions.push(`${suggestions.length === 0 ? "①" : suggestions.length === 1 ? "②" : "③"} ${otherTodo.title}`);
      }
    }
    if (suggestions.length === 0) {
      suggestions.push("① 规划本周核心里程碑");
      suggestions.push("② 整理数字工作区与书签");
    }

    return {
      greet,
      observations,
      suggestions,
    };
  }, [projects, todos]);

  // 4. 对话状态
  const [chatMessages, setChatMessages] = useState<AIChatMessage[]>([]);
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
          <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
        </svg>
      ),
    },
    {
      key: "x",
      href: config.socialX,
      label: "X (Twitter)",
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
    <aside className={`${
      collapsed
        ? "w-10 lg:w-10"
        : "w-full lg:w-80"
    } shrink-0 flex flex-col bg-white/50 dark:bg-slate-900/90 backdrop-blur-sm border-t border-gray-100 dark:border-slate-800 lg:border-t-0 lg:border-l lg:sticky lg:top-0 lg:h-screen ${
      mounted ? "transition-all duration-300 ease-in-out" : "transition-none"
    }`}
    >
      {/* 收起时显示的切换按钮 */}
      {collapsed ? (
        <div className="flex flex-col items-center justify-start pt-4 gap-4">
          <button
            onClick={onToggle}
            className="p-2 rounded-xl transition-colors cursor-pointer hover:bg-gray-100 text-gray-400 hover:text-gray-600 dark:hover:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            title="展开侧边栏"
          >
            <svg
              className="w-4 h-4"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5l-7 7 7 7M19 5l-7 7 7 7" />
            </svg>
          </button>
          <span className="text-xs text-gray-300 dark:text-slate-600 font-medium" style={{ writingMode: "vertical-rl" }}>
            AI 助手
          </span>
        </div>
      ) : (
        <>
          {/* 展开时顶部的收起按钮 + 品牌标语 */}
          <div className="flex items-center justify-between px-3 pt-2 lg:pt-3">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00C776] animate-pulse shrink-0" />
              <span className="text-[10px] text-gray-400 dark:text-slate-500 font-black tracking-wider truncate">
                Powered By ibin_timorpic
              </span>
            </div>
            <button
              onClick={onToggle}
              className="p-1.5 rounded-xl transition-colors cursor-pointer hover:bg-gray-100 text-gray-400 hover:text-gray-600 dark:hover:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200 shrink-0"
              title="收起侧边栏"
            >
              <svg
                className="w-4 h-4"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          </div>
      {/* 可滚动内容区 */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-5 p-4 lg:p-6">
        {/* ── Widget 1: AI Copilot 数字副驾驶 ── */}
        <div className="flex flex-col bg-gradient-to-b from-[#F2FBFB] via-[#EAF8F8] to-[#E2F5F5] dark:from-[#1b1e28] dark:via-[#1f2430] dark:to-[#171a23] rounded-2xl p-4 border border-[#CEEFEF] dark:border-slate-700/80 shadow-2xs space-y-3.5 transition-colors">
          {/* Copilot Header */}
          <div className="flex items-center justify-between pb-2 border-b border-[#CEEFEF]/80 dark:border-slate-700/60">
            <div className="flex items-center gap-2">
              <span className="text-base">🤖</span>
              <div>
                <h3 className="text-xs font-black text-gray-900 dark:text-white tracking-wide flex items-center gap-1.5">
                  <span>AI Copilot</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#00C776]/15 text-[#00C776] border border-[#00C776]/30">
                    数字副驾驶
                  </span>
                </h3>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#00C776] animate-pulse" />
              <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400">
                协同在线
              </span>
            </div>
          </div>

          {/* Copilot 主动感知 Briefing 卡片（无对话或展示在顶部） */}
          {dataLoaded && chatMessages.length === 0 && (
            <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-900/70 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-2.5 text-xs">
              <div>
                <p className="font-bold text-gray-900 dark:text-white">
                  {copilotInsight.greet}，{userName}。
                </p>
                <span className="text-[11px] text-gray-500 dark:text-slate-400">
                  我已实时同步您的工作区全景状态：
                </span>
              </div>

              {/* 发现列表 */}
              <div className="space-y-1 bg-gray-50/70 dark:bg-slate-800/50 p-2 rounded-lg text-[11px] text-gray-700 dark:text-slate-300">
                <span className="font-bold text-[#00C776]">我发现：</span>
                {copilotInsight.observations.map((obs, idx) => (
                  <p key={idx} className="leading-relaxed truncate">
                    {obs}
                  </p>
                ))}
              </div>

              {/* 建议列表 */}
              <div className="space-y-1 text-[11px] text-gray-700 dark:text-slate-300">
                <span className="font-bold text-gray-800 dark:text-slate-200">
                  我建议今天先处理：
                </span>
                {copilotInsight.suggestions.map((sug, idx) => (
                  <p key={idx} className="leading-relaxed truncate text-gray-600 dark:text-slate-300">
                    {sug}
                  </p>
                ))}
              </div>

              {/* 核心副驾驶操作按钮 */}
              <button
                type="button"
                onClick={() =>
                  handleSendChat("请结合我当前的所有项目、进行中的任务和未完成待办，帮我制定一份今天最高效的行动安排与时间拆解计划。")
                }
                className="w-full py-1.5 px-3 bg-[#00C776] hover:bg-[#00B068] text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>🎯 帮我安排今天</span>
                <span>→</span>
              </button>
            </div>
          )}

          {/* 对话消息记录（如果有后续多轮对话） */}
          {chatMessages.length > 0 && (
            <div className="flex flex-col gap-2.5 max-h-56 overflow-y-auto pr-1">
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.sender === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[90%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
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
                  <div className="bg-white/90 dark:bg-slate-800 text-gray-400 dark:text-slate-400 text-xs px-3 py-2 rounded-xl rounded-bl-none shadow-2xs flex items-center gap-1.5">
                    <span className="animate-ping text-xs">•</span>
                    <span>Copilot 正在为您梳理与规划...</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 输入框 */}
          <div className="relative">
            <input
              id="right-sidebar-ai-input"
              name="ai-chat-input"
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
              aria-label="向 AI Copilot 提问或指示"
              placeholder="指示 Copilot 安排任务、拆解或检索..."
              className="w-full pl-3 pr-9 py-2 bg-white/90 dark:bg-slate-900 rounded-xl border border-gray-200/80 dark:border-slate-700 text-xs text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00C776]/40 focus:border-[#00C776]"
            />
            <button
              onClick={() => handleSendChat()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#00C776] hover:text-[#009a5a] transition-colors cursor-pointer"
              title="发送指令"
            >
              <svg className="w-4 h-4 transform rotate-90" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>


        </div>

        {/* ── Widget 1.5: 模型监控 ── */}
        {config.modelMonitorEnabled && <ModelMonitorWidget />}

        {/* ── Widget 3: Social Profile Links ── */}
        {socialLinks.length > 0 && (
          <div className="flex flex-col gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
            <span className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
              社交与联系
            </span>
            <div className="flex items-center gap-2">
              {socialLinks.map((s) => {
                const targetHref = normalizeSocialHref(s.key, s.href);
                if (!targetHref) return null;
                return (
                  <a
                    key={s.key}
                    href={targetHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-gray-50 hover:bg-gray-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-600 hover:text-[#00C776] dark:text-slate-400 dark:hover:text-[#00C776] border border-gray-200/60 dark:border-slate-700 transition-colors"
                    title={s.label}
                  >
                    {s.icon}
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Widget 4: Footer Slogan & Branding Card Block ── */}
              </div>
        </>)}
    </aside>
  );
}
