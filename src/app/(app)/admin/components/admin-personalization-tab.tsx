"use client";

import { useEffect, useState } from "react";
import { useNavelixConfig } from "@/hooks/use-navelix-config";

export default function AdminPersonalizationTab() {
  const { config, updateConfig } = useNavelixConfig();

  // ── Draft state for text inputs (save on button click, not on keystroke) ──
  const [draftBaseUrl, setDraftBaseUrl] = useState("");
  const [draftApiKey, setDraftApiKey] = useState("");
  const [draftModel, setDraftModel] = useState("");
  const [draftWeatherKey, setDraftWeatherKey] = useState("");
  const [draftWeatherLocation, setDraftWeatherLocation] = useState("");
  const [draftWallpaperUrl, setDraftWallpaperUrl] = useState("");
  const [notice, setNotice] = useState("");

  // Sync drafts from config when hydrated
    useEffect(() => {
      const baseUrl = config.aiBaseUrl;
      if (baseUrl !== undefined) {
        queueMicrotask(() => {
          setDraftBaseUrl(baseUrl);
          setDraftApiKey(config.aiApiKey ?? "");
          setDraftModel(config.aiModel ?? "");
          setDraftWeatherKey(config.weatherApiKey ?? "");
          setDraftWeatherLocation(config.weatherLocation ?? "");
          setDraftWallpaperUrl(config.customWallpaperUrl ?? "");
        });
      }
    }, [config.aiBaseUrl, config.aiApiKey, config.aiModel, config.weatherApiKey, config.weatherLocation, config.customWallpaperUrl]);

  // ── Save all text fields at once ──
  const handleSave = () => {
    updateConfig({
      aiBaseUrl: draftBaseUrl,
      aiApiKey: draftApiKey,
      aiModel: draftModel,
      weatherApiKey: draftWeatherKey,
      weatherLocation: draftWeatherLocation,
      customWallpaperUrl: draftWallpaperUrl,
    });
    setNotice("✅ 配置已保存");
    window.setTimeout(() => setNotice(""), 2800);
  };

  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100/90 dark:border-slate-700 shadow-2xs space-y-6 transition-colors">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white">界面与功能偏好</h2>
          <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
            AI智能助手、天气预报组件、全屏背景壁纸与侧边栏指针表盘配置
          </p>
        </div>
        {notice && (
          <div className="px-3 py-1.5 rounded-lg bg-[#00C776]/10 border border-[#00C776]/30 text-xs font-semibold text-[#00C776] animate-fadeIn whitespace-nowrap">
            {notice}
          </div>
        )}
      </div>

      {/* AI Assistant API Config Section */}
      <div className="pt-5 border-t border-gray-100 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">🤖</span>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              AI 智能助手 API 配置 (BaseURL & API Key)
            </h3>
            <p className="text-xs text-gray-400 dark:text-slate-400">
              配置标准 OpenAI 兼容大模型 API，支持 DeepSeek、ChatGPT、OneAPI、Ollama、Qwen 等。
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-2">
            <label
              htmlFor="admin-ai-base-url"
              className="block text-xs font-bold text-gray-800 dark:text-slate-200"
            >
              AI BaseURL 地址
            </label>
            <input
              id="admin-ai-base-url"
              name="aiBaseUrl"
              type="text"
              value={draftBaseUrl}
              onChange={(e) => setDraftBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
              className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
            />
          </div>

          <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-2">
            <label
              htmlFor="admin-ai-api-key"
              className="block text-xs font-bold text-gray-800 dark:text-slate-200"
            >
              API Key 密钥
            </label>
            <input
              id="admin-ai-api-key"
              name="aiApiKey"
              type="password"
              value={draftApiKey}
              onChange={(e) => setDraftApiKey(e.target.value)}
              placeholder={config.aiKeyConfigured ? "已配置 - 留空则保持不变" : "sk-...（未配置）"}
              className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
            />
          </div>

          <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-2">
            <label
              htmlFor="admin-ai-model"
              className="block text-xs font-bold text-gray-800 dark:text-slate-200"
            >
              模型名称 (Model)
            </label>
            <input
              id="admin-ai-model"
              name="aiModel"
              type="text"
              value={draftModel}
              onChange={(e) => setDraftModel(e.target.value)}
              placeholder="gpt-4o-mini 或 deepseek-chat"
              className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
            />
          </div>
        </div>
      </div>

      {/* Weather API Config Section */}
      <div className="pt-5 border-t border-gray-100 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">🌤️</span>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              天气组件 API 配置 (心知天气)
            </h3>
            <p className="text-xs text-gray-400 dark:text-slate-400">
              配置心知天气 API Key 与城市位置（如 beijing 或 shanghai），启用后侧边栏将同步展示天气与气温。
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-2">
            <label
              htmlFor="admin-weather-toggle"
              className="block text-xs font-bold text-gray-800 dark:text-slate-200"
            >
              天气组件开关
            </label>
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-gray-600 dark:text-slate-300">
                {config.weatherEnabled ? "当前状态：已启用" : "当前状态：已禁用"}
              </span>
              <button
                id="admin-weather-toggle"
                type="button"
                onClick={() => updateConfig({ weatherEnabled: !config.weatherEnabled })}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  config.weatherEnabled
                    ? "bg-[#00C776] text-white"
                    : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
                }`}
              >
                {config.weatherEnabled ? "已启用" : "已禁用"}
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-2">
            <label
              htmlFor="admin-weather-api-key"
              className="block text-xs font-bold text-gray-800 dark:text-slate-200"
            >
              心知天气 API Key
            </label>
            <input
              id="admin-weather-api-key"
              name="weatherApiKey"
              type="password"
              value={draftWeatherKey}
              onChange={(e) => setDraftWeatherKey(e.target.value)}
              placeholder={config.weatherKeyConfigured ? "已配置 - 留空则保持不变" : "心知天气 Key"}
              className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
            />
          </div>

          <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-2">
            <label
              htmlFor="admin-weather-location"
              className="block text-xs font-bold text-gray-800 dark:text-slate-200"
            >
              城市 / 位置 (Location)
            </label>
            <input
              id="admin-weather-location"
              name="weatherLocation"
              type="text"
              value={draftWeatherLocation}
              onChange={(e) => setDraftWeatherLocation(e.target.value)}
              placeholder="例如 beijing 或 shanghai"
              className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
            />
          </div>
        </div>
      </div>

      {/* 🔗 链接打开方式与交互体验 */}
      <div className="pt-5 border-t border-gray-100 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">🔗</span>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              链接跳转与打开偏好
            </h3>
            <p className="text-xs text-gray-400 dark:text-slate-400">
              设置点击前台导航书签时的浏览器窗口跳转行为
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-xs font-bold text-gray-800 dark:text-slate-200">
              书签链接打开方式
            </h4>
            <p className="text-[11px] text-gray-400 dark:text-slate-400 mt-0.5">
              选择在新标签页（`target=&quot;_blank&quot;`）打开，还是在当前窗口直接跳转（`target=&quot;_self&quot;`）
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => updateConfig({ linkOpenTarget: "_blank" })}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                (config.linkOpenTarget || "_blank") === "_blank"
                  ? "bg-[#00C776] text-white shadow-2xs"
                  : "bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700"
              }`}
            >
              ↗️ 在新标签页打开
            </button>
            <button
              type="button"
              onClick={() => updateConfig({ linkOpenTarget: "_self" })}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                config.linkOpenTarget === "_self"
                  ? "bg-[#00C776] text-white shadow-2xs"
                  : "bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700"
              }`}
            >
              ↩️ 在当前页打开
            </button>
          </div>
        </div>
      </div>

      {/* 🖼️ 背景壁纸与毛玻璃特效 */}
      <div className="pt-5 border-t border-gray-100 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">🖼️</span>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              背景壁纸与冰晶毛玻璃特效
            </h3>
            <p className="text-xs text-gray-400 dark:text-slate-400">
              开启 Bing 每日高清壁纸、自定义壁纸链接以及半透明水凝膜毛玻璃悬浮质感
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <label className="block text-xs font-bold text-gray-800 dark:text-slate-200">
              背景壁纸模式
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => updateConfig({ wallpaperMode: "none" })}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  (config.wallpaperMode || "none") === "none"
                    ? "bg-[#00C776] text-white"
                    : "bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700"
                }`}
              >
                无壁纸
              </button>
              <button
                type="button"
                onClick={() => updateConfig({ wallpaperMode: "bing" })}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  config.wallpaperMode === "bing"
                    ? "bg-[#00C776] text-white"
                    : "bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700"
                }`}
              >
                Bing 每日壁纸
              </button>
              <button
                type="button"
                onClick={() => updateConfig({ wallpaperMode: "custom" })}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  config.wallpaperMode === "custom"
                    ? "bg-[#00C776] text-white"
                    : "bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700"
                }`}
              >
                自定义 URL
              </button>
            </div>

            {config.wallpaperMode === "custom" && (
              <input
                type="text"
                name="customWallpaperUrl"
                value={draftWallpaperUrl}
                onChange={(e) => setDraftWallpaperUrl(e.target.value)}
                placeholder="https://example.com/wallpaper.jpg"
                className="w-full h-8.5 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono mt-2"
              />
            )}
          </div>

          {/* 毛玻璃开关 */}
          <div className="space-y-2 border-t border-gray-200 dark:border-slate-700 pt-3 md:border-t-0 md:border-l md:pt-0 md:pl-4">
            <div>
              <h4 className="text-xs font-bold text-gray-800 dark:text-slate-200">
                冰晶毛玻璃质感 (Backdrop Blur)
              </h4>
              <p className="text-[11px] text-gray-400 dark:text-slate-400 mt-1">
                {config.wallpaperMode === "none"
                  ? "卡片与侧边栏呈现玻璃光泽感；搭配上方壁纸后有半透明模糊效果"
                  : "卡片与侧边栏呈现水凝膜半透明高斯模糊背景"}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600 dark:text-slate-300 font-semibold">
                {config.glassmorphism ? "当前状态：已启用毛玻璃" : "当前状态：经典纯色背景"}
              </span>
              <button
                type="button"
                onClick={() => updateConfig({ glassmorphism: !config.glassmorphism })}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  config.glassmorphism
                    ? "bg-[#00C776] text-white shadow-2xs"
                    : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
                }`}
              >
                {config.glassmorphism ? "已开启" : "已禁用"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 📌 侧边栏与小组件样式 */}
      <div className="pt-5 border-t border-gray-100 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">📌</span>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              侧边栏形态与顶部小组件模式
            </h3>
            <p className="text-xs text-gray-400 dark:text-slate-400">
              设置桌面端侧边栏初始展开/折叠状态、中央内容区宽度，以及顶部组件模式（数字时钟 / 天气 / 模拟指针时钟）
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 侧边栏默认状态 */}
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-2">
            <label className="block text-xs font-bold text-gray-800 dark:text-slate-200">
              侧边栏默认显示状态
            </label>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => updateConfig({ sidebarDefaultState: "expanded" })}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  (config.sidebarDefaultState || "expanded") === "expanded"
                    ? "bg-[#00C776] text-white"
                    : "bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700"
                }`}
              >
                📖 默认展开
              </button>
              <button
                type="button"
                onClick={() => updateConfig({ sidebarDefaultState: "collapsed" })}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  config.sidebarDefaultState === "collapsed"
                    ? "bg-[#00C776] text-white"
                    : "bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700"
                }`}
              >
                📁 默认收起/折叠
              </button>
            </div>
          </div>

          {/* 小组件模式 */}
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-2">
            <label className="block text-xs font-bold text-gray-800 dark:text-slate-200">
              顶部小组件样式模式
            </label>
            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={() => updateConfig({ clockWidgetMode: "time" })}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  (config.clockWidgetMode || "time") === "time"
                    ? "bg-[#00C776] text-white"
                    : "bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700"
                }`}
              >
                ⏰ 数字时钟
              </button>
              <button
                type="button"
                onClick={() => updateConfig({ clockWidgetMode: "weather" })}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  config.clockWidgetMode === "weather"
                    ? "bg-[#00C776] text-white"
                    : "bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700"
                }`}
              >
                🌤️ 天气面板
              </button>
              <button
                type="button"
                onClick={() => updateConfig({ clockWidgetMode: "analog" })}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  config.clockWidgetMode === "analog"
                    ? "bg-[#00C776] text-white"
                    : "bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700"
                }`}
              >
                🕰️ 指针表盘
              </button>
            </div>
          </div>

          {/* 内容区域宽度 */}
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-2">
            <label className="block text-xs font-bold text-gray-800 dark:text-slate-200">
              中央内容区域宽度
            </label>
            <p className="text-[11px] text-gray-400 dark:text-slate-400 pt-0.5">
              主页面为「左侧边栏 + 中央主区域 + 右侧边栏」布局，此项控制中央内容区的最大宽度
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => updateConfig({ maxWidth: "1000px" })}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  config.maxWidth === "1000px"
                    ? "bg-[#00C776] text-white"
                    : "bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700"
                }`}
              >
                1000px 较窄
              </button>
              <button
                type="button"
                onClick={() => updateConfig({ maxWidth: "1200px" })}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  (config.maxWidth || "1200px") === "1200px"
                    ? "bg-[#00C776] text-white"
                    : "bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700"
                }`}
              >
                1200px 主流
              </button>
              <button
                type="button"
                onClick={() => updateConfig({ maxWidth: "1400px" })}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  config.maxWidth === "1400px"
                    ? "bg-[#00C776] text-white"
                    : "bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700"
                }`}
              >
                1400px 大屏
              </button>
              <button
                type="button"
                onClick={() => updateConfig({ maxWidth: "full" })}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  config.maxWidth === "full"
                    ? "bg-[#00C776] text-white"
                    : "bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700"
                }`}
              >
                full 铺满
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Save Button Bar ── */}
      <div className="pt-5 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between">
        <p className="text-xs text-gray-400 dark:text-slate-400">
          修改字符输入内容后需点击「保存更改」才会生效；开关和按钮选项即时生效
        </p>
        <button
          type="button"
          onClick={handleSave}
          className="px-5 py-2 bg-[#00C776] hover:bg-[#00B368] text-white text-xs font-bold rounded-xl transition-all active:scale-[0.98] flex items-center gap-1.5 cursor-pointer"
        >
          <span>💾</span>
          <span>保存更改</span>
        </button>
      </div>
    </div>
  );
}