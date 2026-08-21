"use client";

import { useNavelixConfig } from "@/hooks/use-navelix-config";

export default function AdminPersonalizationTab() {
  const { config, updateConfig } = useNavelixConfig();

  // 预览宽度图计算
  const getPreviewWidthPercent = () => {
    switch (config.maxWidth) {
      case "1000px":
        return "w-[60%]";
      case "1200px":
        return "w-[72%]";
      case "1400px":
        return "w-[84%]";
      case "full":
        return "w-full";
      default:
        return "w-[72%]";
    }
  };

  const wallpaperMode = (config.wallpaperMode as "bing" | "custom" | "none") || "bing";
  const glassmorphism = config.glassmorphism !== false;
  const sidebarState = (config.sidebarDefaultState as "expanded" | "collapsed") || "expanded";
  const clockWidgetMode = (config.clockWidgetMode as "time" | "weather" | "analog") || "time";
  const maxWidth = config.maxWidth || "1200px";
  const linkOpenTarget = config.linkOpenTarget || "_blank";

  const getWallpaperStatusText = () => {
    if (wallpaperMode === "bing") return "无线统背景 (Bing)";
    if (wallpaperMode === "custom") return "自定义 URL 背景";
    return "纯色背景";
  };

  const getBlurStatusText = () => {
    return glassmorphism ? "毛玻璃已启用" : "未开启毛玻璃";
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn select-none">
      {/* ── 顶部 Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <span className="text-xl">🔗</span>
          <div>
            <h2 className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight">
              界面与功能偏好
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              自定义你的导航体验，让 Navelix 更符合你的使用习惯
            </p>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          通栏卡片 1：链接跳转与打开偏好
         ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-gray-100/90 dark:border-slate-800 shadow-2xs transition-colors space-y-5">
        <div className="flex items-start gap-3">
          <span className="text-base shrink-0">🔗</span>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">
              链接跳转与打开偏好
            </h3>
            <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
              设置点击链接与书签时的浏览器窗口跳转行为
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div className="flex items-start gap-2.5">
            <span className="text-gray-400 dark:text-slate-500 text-sm mt-0.5">↳</span>
            <div>
              <h4 className="text-xs font-bold text-gray-800 dark:text-slate-200">
                书签链接打开方式
              </h4>
              <p className="text-[11px] text-gray-400 dark:text-slate-400 mt-0.5">
                选择在新标签页（<code className="text-gray-600 dark:text-slate-300 font-mono">target=&quot;_blank&quot;</code>）打开，还是在当前窗口直接跳转（<code className="text-gray-600 dark:text-slate-300 font-mono">target=&quot;_self&quot;</code>）
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => updateConfig({ linkOpenTarget: "_blank" })}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                linkOpenTarget === "_blank"
                  ? "bg-[#00C776] text-white shadow-xs shadow-[#00C776]/25"
                  : "bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-200/90 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/60"
              }`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              <span>在新标签页打开</span>
            </button>

            <button
              type="button"
              onClick={() => updateConfig({ linkOpenTarget: "_self" })}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                linkOpenTarget === "_self"
                  ? "bg-[#00C776] text-white shadow-xs shadow-[#00C776]/25"
                  : "bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-200/90 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/60"
              }`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>在当前页打开</span>
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          第二行：三列栅格（背景壁纸 / 侧边栏与小组件 / 内容宽度）
         ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* ── 列 1：背景壁纸与毛玻璃特效 ── */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-gray-100/90 dark:border-slate-800 shadow-2xs flex flex-col justify-between space-y-5 transition-colors">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="text-base shrink-0">🖼️</span>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">
                  背景壁纸与毛玻璃特效
                </h3>
                <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5 leading-relaxed">
                  开启 Bing 每日高清壁纸，自定义壁纸链接以及半透明水滴冰水波玻璃毛玻璃浮现感
                </p>
              </div>
            </div>

            {/* 背景壁纸模式 */}
            <div className="space-y-2.5 pt-1">
              <label className="block text-xs font-bold text-gray-800 dark:text-slate-200">
                背景壁纸模式
              </label>
              <div className="space-y-2">
                {[
                  { id: "bing", label: "无线统 (Bing 每日壁纸)" },
                  { id: "custom", label: "自定义 URL" },
                  { id: "none", label: "纯色背景" },
                ].map((item) => {
                  const isSelected = wallpaperMode === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => updateConfig({ wallpaperMode: item.id as "bing" | "custom" | "none" })}
                      className={`w-full py-2.5 px-3.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2.5 text-left border ${
                        isSelected
                          ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700/60 text-emerald-800 dark:text-emerald-300 shadow-2xs"
                          : "bg-white dark:bg-slate-900/60 border-gray-200/80 dark:border-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border ${
                        isSelected
                          ? "border-[#00C776] bg-[#00C776]"
                          : "border-gray-300 dark:border-slate-600 bg-transparent"
                      }`}>
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 自定义壁纸输入框 */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-800 dark:text-slate-200">
                自定义壁纸 URL
              </label>
              <input
                type="text"
                defaultValue={config.customWallpaperUrl || ""}
                onBlur={(e) => updateConfig({ customWallpaperUrl: e.target.value.trim() })}
                placeholder="https://example.com/wallpaper.jpg"
                className="w-full h-9 rounded-xl border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono placeholder:text-gray-400 focus:outline-hidden focus:border-[#00C776]"
              />
              <p className="text-[10px] text-gray-400 dark:text-slate-500">
                支持 JPG / PNG 格式的图片链接
              </p>
            </div>

            {/* 水晶毛玻璃开关 */}
            <div className="space-y-2 pt-1">
              <div>
                <label className="block text-xs font-bold text-gray-800 dark:text-slate-200">
                  水晶毛玻璃质感 (Backdrop Blur)
                </label>
                <p className="text-[11px] text-gray-400 dark:text-slate-400 mt-0.5">
                  开启后卡片与侧边栏呈现半透明毛玻璃质感；搭配壁纸效果更佳
                </p>
              </div>

              <button
                type="button"
                onClick={() => updateConfig({ glassmorphism: !glassmorphism })}
                className={`w-full py-2.5 px-3.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2.5 text-left border ${
                  glassmorphism
                    ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700/60 text-emerald-800 dark:text-emerald-300 shadow-2xs"
                    : "bg-white dark:bg-slate-900/60 border-gray-200/80 dark:border-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/60"
                }`}
              >
                <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border ${
                  glassmorphism
                    ? "border-[#00C776] bg-[#00C776]"
                    : "border-gray-300 dark:border-slate-600 bg-transparent"
                }`}>
                  {glassmorphism && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </span>
                <span>{glassmorphism ? "已开启" : "已关闭"}</span>
              </button>
            </div>
          </div>

          {/* 状态徽章条 */}
          <div className="p-3 rounded-2xl bg-gray-50/90 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800 flex items-center justify-between mt-4">
            <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">
              当前状态：{getWallpaperStatusText()} + {getBlurStatusText()}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
              glassmorphism
                ? "bg-emerald-100 dark:bg-emerald-950/60 text-[#00C776] dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40"
                : "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700"
            }`}>
              {glassmorphism ? "已启用" : "未启用"}
            </span>
          </div>
        </div>

        {/* ── 列 2：侧边栏形态与顶部小组件模式 ── */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-gray-100/90 dark:border-slate-800 shadow-2xs flex flex-col justify-between space-y-5 transition-colors">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="text-base shrink-0">📌</span>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">
                  侧边栏形态与顶部小组件模式
                </h3>
                <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5 leading-relaxed">
                  设置在侧面的显示形态以及顶部小组件展示模式，以适配你的使用习惯（数字时钟 / 天气 / 电量 / 快捷提示组件等）
                </p>
              </div>
            </div>

            {/* 侧边栏默认显示形态 */}
            <div className="space-y-2 pt-1">
              <label className="block text-xs font-bold text-gray-800 dark:text-slate-200">
                侧边栏默认显示形态
              </label>
              <div className="space-y-2">
                {[
                  { id: "expanded", label: "默认展开", desc: "" },
                  { id: "collapsed", label: "默认收起 / 折叠", desc: "" },
                ].map((item) => {
                  const isSelected = sidebarState === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => updateConfig({ sidebarDefaultState: item.id as "expanded" | "collapsed" })}
                      className={`w-full py-2.5 px-3.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2.5 text-left border ${
                        isSelected
                          ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700/60 text-emerald-800 dark:text-emerald-300 shadow-2xs"
                          : "bg-white dark:bg-slate-900/60 border-gray-200/80 dark:border-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border ${
                        isSelected
                          ? "border-[#00C776] bg-[#00C776]"
                          : "border-gray-300 dark:border-slate-600 bg-transparent"
                      }`}>
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-gray-400 dark:text-slate-500 pt-0.5">
                展开：完整显示所有导航项；收起：仅显示图标
              </p>
            </div>

            {/* 顶部小组件样式模式 */}
            <div className="space-y-2 pt-2">
              <label className="block text-xs font-bold text-gray-800 dark:text-slate-200">
                顶部小组件样式模式
              </label>
              <div className="space-y-2">
                {[
                  { id: "time", label: "数字时钟" },
                  { id: "weather", label: "天气面板" },
                  { id: "analog", label: "组合模式 (多组件)" },
                ].map((item) => {
                  const isSelected = clockWidgetMode === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => updateConfig({ clockWidgetMode: item.id as "time" | "weather" | "analog" })}
                      className={`w-full py-2.5 px-3.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2.5 text-left border ${
                        isSelected
                          ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700/60 text-emerald-800 dark:text-emerald-300 shadow-2xs"
                          : "bg-white dark:bg-slate-900/60 border-gray-200/80 dark:border-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border ${
                        isSelected
                          ? "border-[#00C776] bg-[#00C776]"
                          : "border-gray-300 dark:border-slate-600 bg-transparent"
                      }`}>
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-gray-400 dark:text-slate-500 pt-0.5">
                组合模式下可在顶部同时展示多个小组件
              </p>
            </div>
          </div>
        </div>

        {/* ── 列 3：中央内容区域宽度 ── */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-gray-100/90 dark:border-slate-800 shadow-2xs flex flex-col justify-between space-y-5 transition-colors">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="text-base shrink-0">🖥️</span>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">
                  中央内容区域宽度
                </h3>
                <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5 leading-relaxed">
                  调整主内容区域的最大宽度，改变布局留白与阅读密度
                </p>
              </div>
            </div>

            {/* 宽度单选列表 */}
            <div className="space-y-2 pt-1">
              {[
                { id: "1000px", label: "1000px 较窄", desc: "" },
                { id: "1200px", label: "1200px 主流", desc: "" },
                { id: "1400px", label: "1400px 大屏", desc: "" },
                { id: "full", label: "全屏铺满", desc: "适合超大屏幕，内容无最大宽度限制" },
              ].map((item) => {
                const isSelected = maxWidth === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => updateConfig({ maxWidth: item.id as "1000px" | "1200px" | "1400px" | "full" })}
                    className={`w-full py-2.5 px-3.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex flex-col gap-0.5 text-left border ${
                      isSelected
                        ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700/60 text-emerald-800 dark:text-emerald-300 shadow-2xs"
                        : "bg-white dark:bg-slate-900/60 border-gray-200/80 dark:border-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border ${
                        isSelected
                          ? "border-[#00C776] bg-[#00C776]"
                          : "border-gray-300 dark:border-slate-600 bg-transparent"
                      }`}>
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                      <span>{item.label}</span>
                    </div>
                    {item.desc && (
                      <p className="text-[10px] text-gray-400 dark:text-slate-500 pl-6">
                        {item.desc}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 效果预览可视化 Diagram */}
          <div className="space-y-2 pt-2">
            <label className="block text-xs font-bold text-gray-800 dark:text-slate-200">
              效果预览
            </label>
            <div className="p-3 bg-gray-50 dark:bg-slate-950/70 rounded-2xl border border-gray-200/80 dark:border-slate-800 flex flex-col items-center justify-center min-h-[140px]">
              <div className="w-full flex items-center justify-center gap-2 h-24 px-2">
                {maxWidth !== "full" && (
                  <div className="flex-1 h-20 bg-gray-200/60 dark:bg-slate-800/60 rounded-lg border border-dashed border-gray-300 dark:border-slate-700" />
                )}
                <div
                  className={`h-20 ${getPreviewWidthPercent()} bg-emerald-100/90 dark:bg-emerald-950/70 border border-emerald-400/80 dark:border-emerald-600/80 rounded-lg flex flex-col items-center justify-center transition-all duration-300 shadow-2xs`}
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-[#00C776]">
                    <span>|◀</span>
                    <span>{maxWidth}</span>
                    <span>▶|</span>
                  </div>
                </div>
                {maxWidth !== "full" && (
                  <div className="flex-1 h-20 bg-gray-200/60 dark:bg-slate-800/60 rounded-lg border border-dashed border-gray-300 dark:border-slate-700" />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          通栏卡片 3：右侧侧边栏组件（并排 6 个模块卡片）
         ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-gray-100/90 dark:border-slate-800 shadow-2xs transition-colors space-y-5">
        <div className="flex items-start gap-3">
          <span className="text-base shrink-0">📑</span>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">
              右侧侧边栏组件
            </h3>
            <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
              控制右侧边栏各信息模块的显示与隐藏，按需展示你关注的信息
            </p>
          </div>
        </div>

        {/* 6 个组件卡片网格 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 pt-2">
          {[
            {
              id: "aiCopilot",
              title: "AI Copilot",
              desc: "智能助手状态面板",
              icon: "🤖",
              enabled: config.aiCopilotEnabled !== false,
              toggle: () => updateConfig({ aiCopilotEnabled: config.aiCopilotEnabled === false }),
            },
            {
              id: "todayActivity",
              title: "今日动态",
              desc: "今日工作动态与事件",
              icon: "⚡",
              enabled: config.todayActivityEnabled !== false,
              toggle: () => updateConfig({ todayActivityEnabled: config.todayActivityEnabled === false }),
            },
            {
              id: "modelMonitor",
              title: "模型监控",
              desc: "账号与调用额度监控",
              icon: "🧠",
              enabled: config.modelMonitorEnabled !== false,
              toggle: () => updateConfig({ modelMonitorEnabled: config.modelMonitorEnabled === false }),
            },
            {
              id: "linkStatus",
              title: "连接状态",
              desc: "第三方服务连接状态",
              icon: "🔗",
              enabled: config.linkStatusEnabled !== false,
              toggle: () => updateConfig({ linkStatusEnabled: config.linkStatusEnabled === false }),
            },
            {
              id: "quickAccess",
              title: "快捷访问",
              desc: "常用快捷链接访问",
              icon: "⭐",
              enabled: config.recentVisitsEnabled !== false,
              toggle: () => updateConfig({ recentVisitsEnabled: config.recentVisitsEnabled === false }),
            },
            {
              id: "pendingReminders",
              title: "待处理提醒",
              desc: "待办事项与提醒",
              icon: "🔔",
              enabled: config.pendingRemindersEnabled !== false,
              toggle: () => updateConfig({ pendingRemindersEnabled: config.pendingRemindersEnabled === false }),
            },
          ].map((item) => (
            <div
              key={item.id}
              className="p-3.5 rounded-2xl bg-gray-50/80 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800 flex flex-col justify-between gap-3 transition-all hover:border-gray-200 dark:hover:border-slate-700"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">{item.icon}</span>
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate">
                    {item.title}
                  </h4>
                </div>
                <p className="text-[10px] text-gray-400 dark:text-slate-400 line-clamp-1">
                  {item.desc}
                </p>
              </div>

              {/* 胶囊 Switch 按钮 */}
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={item.toggle}
                  className={`h-6 px-2 rounded-full text-[10px] font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                    item.enabled
                      ? "bg-[#00C776] text-white shadow-2xs"
                      : "bg-gray-200 dark:bg-slate-800 text-gray-600 dark:text-slate-400"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full bg-white transition-transform ${
                      item.enabled ? "order-last" : "order-first"
                    }`}
                  />
                  <span>{item.enabled ? "显示" : "隐藏"}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}