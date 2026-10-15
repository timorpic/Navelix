"use client";

import { useText } from "@/hooks/use-text";
import LanguageSwitcher from "@/components/language-switcher";
import { useTranslations } from "next-intl";
import AdminProfileSearchBarCard from "./admin-profile-search-bar-card";
import { useNavelixConfig } from "@/context/navelix-context";
import {
  blurStatusText,
  buildWidgetToggles,
  isGlassmorphismEnabled,
  previewWidthClass,
  resolveWallpaperMode,
  wallpaperStatusText,
} from "@/lib/admin-personalization";

export default function AdminPersonalizationTab() {
  const text = useText();
  const tx = useTranslations();
  const { config, updateConfig } = useNavelixConfig();

  // 派生值统一由 lib/admin-personalization.ts 提供（纯函数，可单测）
  const getPreviewWidthPercent = () => previewWidthClass(config.maxWidth);
  const wallpaperMode = resolveWallpaperMode(config);
  const glassmorphism = isGlassmorphismEnabled(config);
  const getWallpaperStatusText = () => text(wallpaperStatusText(wallpaperMode));
  const getBlurStatusText = () => text(blurStatusText(glassmorphism));
  const widgetToggles = buildWidgetToggles(config);

  const sidebarState = (config.sidebarDefaultState as "expanded" | "collapsed") || "expanded";
  const clockWidgetMode = (config.clockWidgetMode as "time" | "weather" | "analog") || "time";
  const maxWidth = config.maxWidth || "1200px";
  const linkOpenTarget = config.linkOpenTarget || "_blank";

  return (
    <div className="space-y-6 pb-12 animate-fadeIn select-none">
      {/* ── 顶部 Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <span className="text-xl">🔗</span>
          <div>
            <h2 className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight">
              {tx("appearance_preferences_f9f62e45")}</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              {tx("customize_your_navigation_experience_to_fit_the__516eb4b2")}</p>
          </div>
        </div>
      </div>

      <AdminProfileSearchBarCard />

      {/* ── 通栏卡片：界面语言（个人偏好，跨设备生效） ── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-gray-100/90 dark:border-slate-800 shadow-2xs transition-colors space-y-4">
        <div className="flex items-start gap-3">
          <span className="text-base shrink-0">🌐</span>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">
              {tx("interface_language_3d138685")}</h3>
            <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
              {tx("choose_the_interface_language_signed_in_preference_347798d3")}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div className="flex items-start gap-2.5">
            <span className="text-gray-400 dark:text-slate-500 text-sm mt-0.5">↳</span>
            <p className="text-[11px] text-gray-400 dark:text-slate-400 mt-0.5">
              简体中文 / English</p>
          </div>
          <div className="shrink-0">
            <LanguageSwitcher showLabel={false} />
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
              {tx("link_navigation_preferences_8f701c21")}</h3>
            <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
              {tx("choose_how_links_and_bookmarks_open_in_your_brow_7b6da23e")}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div className="flex items-start gap-2.5">
            <span className="text-gray-400 dark:text-slate-500 text-sm mt-0.5">↳</span>
            <div>
              <h4 className="text-xs font-bold text-gray-800 dark:text-slate-200">
                {tx("open_bookmark_links_ae19007b")}</h4>
              <p className="text-[11px] text-gray-400 dark:text-slate-400 mt-0.5">
                {tx("open_in_a_new_tab_c64771c5")}<code className="text-gray-600 dark:text-slate-300 font-mono">target=&quot;_blank&quot;</code>{tx("or_navigate_in_the_current_tab_c2b56c10")}<code className="text-gray-600 dark:text-slate-300 font-mono">target=&quot;_self&quot;</code>）
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
              <span>{tx("open_in_new_tab_79c5e0ba")}</span>
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
              <span>{tx("open_in_current_tab_475acb22")}</span>
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
                  {tx("wallpaper_frosted_glass_0e791adc")}</h3>
                <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5 leading-relaxed">
                  {tx("use_bing_daily_wallpapers_or_a_custom_image_with_011fb895")}</p>
              </div>
            </div>

            {/* 背景壁纸模式 */}
            <div className="space-y-2.5 pt-1">
              <label className="block text-xs font-bold text-gray-800 dark:text-slate-200">
                {tx("wallpaper_mode_fa6e6da5")}</label>
              <div className="space-y-2">
                {[
                  { id: "bing", label: tx("bing_daily_wallpaper_e2f3ee79") },
                  { id: "custom", label: tx("custom_url_a2c3e5c5") },
                  { id: "none", label: tx("solid_background_773ab07d") },
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
                      <span>{text(item.label)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 自定义壁纸输入框 */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-800 dark:text-slate-200">
                {tx("custom_wallpaper_url_b392094c")}</label>
              <input
                type="text"
                defaultValue={config.customWallpaperUrl || ""}
                onBlur={(e) => updateConfig({ customWallpaperUrl: e.target.value.trim() })}
                placeholder="https://example.com/wallpaper.jpg"
                className="w-full h-9 rounded-xl border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono placeholder:text-gray-400 focus:outline-hidden focus:border-[#00C776]"
              />
              <p className="text-[10px] text-gray-400 dark:text-slate-500">
                {tx("supports_jpg_and_png_image_urls_f33c2a4b")}</p>
            </div>

            {/* 水晶毛玻璃开关 */}
            <div className="space-y-2 pt-1">
              <div>
                <label className="block text-xs font-bold text-gray-800 dark:text-slate-200">
                  {tx("frosted_glass_backdrop_blur_fe6820a3")}</label>
                <p className="text-[11px] text-gray-400 dark:text-slate-400 mt-0.5">
                  {tx("give_cards_and_sidebars_a_translucent_look_works_ab31f74f")}</p>
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
                <span>{glassmorphism ? tx("on_8a4ef3e4") : tx("off_6744b4c6")}</span>
              </button>
            </div>
          </div>

          {/* 状态徽章条 */}
          <div className="p-3 rounded-2xl bg-gray-50/90 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800 flex items-center justify-between mt-4">
            <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">
              {tx("current_status_09bb6d0d")}{getWallpaperStatusText()} + {getBlurStatusText()}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
              glassmorphism
                ? "bg-emerald-100 dark:bg-emerald-950/60 text-[#00C776] dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40"
                : "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700"
            }`}>
              {glassmorphism ? tx("enabled_dfb80223") : tx("not_enabled_f95ea7f4")}
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
                  {tx("sidebar_widget_layout_0f82f7e2")}</h3>
                <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5 leading-relaxed">
                  {tx("choose_your_sidebar_layout_and_widget_display_mo_97c147a9")}</p>
              </div>
            </div>

            {/* 侧边栏默认显示形态 */}
            <div className="space-y-2 pt-1">
              <label className="block text-xs font-bold text-gray-800 dark:text-slate-200">
                {tx("default_sidebar_layout_cab10c04")}</label>
              <div className="space-y-2">
                {[
                  { id: "expanded", label: tx("expanded_3fb24a9b"), desc: "" },
                  { id: "collapsed", label: tx("collapsed_c17ae2f8"), desc: "" },
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
                      <span>{text(item.label)}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-gray-400 dark:text-slate-500 pt-0.5">
                {tx("expanded_show_all_navigation_items_collapsed_sho_42ff782e")}</p>
            </div>

            {/* 顶部小组件样式模式 */}
            <div className="space-y-2 pt-2">
              <label className="block text-xs font-bold text-gray-800 dark:text-slate-200">
                {tx("top_widget_display_mode_9da5baa6")}</label>
              <div className="space-y-2">
                {[
                  { id: "time", label: tx("digital_clock_c5322236") },
                  { id: "weather", label: tx("weather_panel_3f85c072") },
                  { id: "analog", label: tx("combined_widgets_959c476a") },
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
                      <span>{text(item.label)}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-gray-400 dark:text-slate-500 pt-0.5">
                {tx("show_multiple_widgets_together_at_the_top_a592b743")}</p>
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
                  {tx("main_content_width_e0a6cdae")}</h3>
                <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5 leading-relaxed">
                  {tx("set_the_maximum_content_width_to_adjust_whitespa_bcd2247f")}</p>
              </div>
            </div>

            {/* 宽度单选列表 */}
            <div className="space-y-2 pt-1">
              {[
                { id: "1000px", label: tx("1000px_narrow_c8ebb21a"), desc: "" },
                { id: "1200px", label: tx("1200px_standard_90cb8d22"), desc: "" },
                { id: "1400px", label: tx("1400px_wide_72c2b9fe"), desc: "" },
                { id: "full", label: tx("full_width_c9db6cb4"), desc: tx("for_large_screens_with_no_maximum_content_width_19cebbba") },
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
                      <span>{text(item.label)}</span>
                    </div>
                    {item.desc && (
                      <p className="text-[10px] text-gray-400 dark:text-slate-500 pl-6">
                        {item.id === "aiCopilot" ? tx("workspace_assistant_toggle") : text(item.desc)}
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
              {tx("preview_e8bd157d")}</label>
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
          通栏卡片 3：工作区组件（并排 6 个模块卡片）
         ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-gray-100/90 dark:border-slate-800 shadow-2xs transition-colors space-y-5">
        <div className="flex items-start gap-3">
          <span className="text-base shrink-0">📑</span>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">
              {tx("workspace_widgets")}</h3>
            <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
              {tx("workspace_widgets_description")}</p>
          </div>
        </div>

        {/* 6 个组件卡片网格 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 pt-2">
          {widgetToggles.map((item) => (
            <div
              key={item.id}
              className="p-3.5 rounded-2xl bg-gray-50/80 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800 flex flex-col justify-between gap-3 transition-all hover:border-gray-200 dark:hover:border-slate-700"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">{item.icon}</span>
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate">
                    {text(item.title)}
                  </h4>
                </div>
                <p className="text-[10px] text-gray-400 dark:text-slate-400 line-clamp-1">
                  {item.id === "aiCopilot" ? tx("workspace_assistant_toggle") : text(item.desc)}
                </p>
              </div>

              {/* 胶囊 Switch 按钮 */}
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() =>
                    updateConfig({ [item.configKey]: item.toggleValue })
                  }
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
                  <span>{item.enabled ? tx("show_4e1449e7") : tx("hide_145219e7")}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}