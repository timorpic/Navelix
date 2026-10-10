"use client";

import type { UseAdminTelegramSettingsResult } from "@/hooks/use-admin-telegram-settings";

/**
 * 「个人账号与安全」Tab 的卡片 5：📮 Telegram 通知配置。
 *
 * 从 `admin-profile-tab.tsx`（原 1219 行）抽出 —— 该卡片占原文件近 160 行
 * （Token / Chat ID / 总开关 / 两个场景开关 / 测试发送），state 与保存逻辑
 * 全部来自 `useAdminTelegramSettings()`，本组件只负责渲染。
 */
export default function AdminProfileTelegramCard({
  tg,
}: {
  tg: UseAdminTelegramSettingsResult;
}) {
  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors">
      <div>
        <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
          <span>📮</span>
          <span>Telegram Bot 通知</span>
        </h3>
        <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
          通过 Telegram Bot 推送备份结果、系统异常（服务重启 / 磁盘占用 / 登录异常）等安全通知
        </p>
      </div>

      <div className="space-y-3">
        {/* Bot Token */}
        <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-bold text-gray-800 dark:text-slate-200">
              Bot Token
            </p>
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
              tg.tgBotTokenConfigured
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                : "bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-400"
            }`}>
              {tg.tgBotTokenConfigured ? "已配置" : "未配置"}
            </span>
          </div>
          <input
            type="password"
            value={tg.tgBotTokenInput}
            onChange={(e) => tg.setTgBotTokenInput(e.target.value)}
            onBlur={() => {
              const v = tg.tgBotTokenInput.trim();
              if (v) tg.tgSave({ botToken: v });
            }}
            placeholder={tg.tgBotTokenConfigured ? "已保存 - 输入新 Token 可覆盖（留空保持不变）" : "123456:ABC-DEF...（向 @BotFather 获取）"}
            className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
          />
        </div>

        {/* Chat ID */}
        <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-bold text-gray-800 dark:text-slate-200">
              Chat ID
            </p>
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
              tg.tgChatIdConfigured
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                : "bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-400"
            }`}>
              {tg.tgChatIdConfigured ? "已配置" : "未配置"}
            </span>
          </div>
          <input
            type="text"
            value={tg.tgChatId}
            onChange={(e) => tg.setTgChatId(e.target.value)}
            onBlur={() => tg.tgSave({ chatId: tg.tgChatId.trim() })}
            placeholder="例如 123456789（向 @userinfobot 查询你的 ID）"
            className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
          />
        </div>

        {/* 总开关 */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700">
          <div>
            <p className="text-xs font-bold text-gray-800 dark:text-slate-200">
              Telegram 通知总开关
            </p>
            <p className="text-[10px] text-gray-400 dark:text-slate-400 mt-0.5">
              关闭后所有 Telegram 推送不再发送
            </p>
          </div>
          <button
            type="button"
            onClick={tg.toggleTgEnabled}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              tg.tgEnabled
                ? "bg-[#00C776] text-white"
                : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
            }`}
          >
            {tg.tgEnabled ? "已开启" : "已关闭"}
          </button>
        </div>

        {/* 场景开关 */}
        <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-2">
          <p className="text-xs font-bold text-gray-800 dark:text-slate-200">
            通知场景
          </p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-gray-600 dark:text-slate-300">备份结果</p>
              <p className="text-[10px] text-gray-400 dark:text-slate-400">本地/云备份成功与失败</p>
            </div>
            <button
              type="button"
              onClick={tg.toggleTgNotifyBackup}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                tg.tgNotifyBackup
                  ? "bg-[#00C776] text-white"
                  : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
              }`}
            >
              {tg.tgNotifyBackup ? "已开启" : "已关闭"}
            </button>
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t border-gray-200/80 dark:border-slate-700">
            <div>
              <p className="text-[11px] text-gray-600 dark:text-slate-300">系统异常</p>
              <p className="text-[10px] text-gray-400 dark:text-slate-400">服务重启 / 磁盘占用 / 登录异常</p>
            </div>
            <button
              type="button"
              onClick={tg.toggleTgNotifySystem}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                tg.tgNotifySystem
                  ? "bg-[#00C776] text-white"
                  : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
              }`}
            >
              {tg.tgNotifySystem ? "已开启" : "已关闭"}
            </button>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            type="button"
            disabled={tg.tgTesting}
            onClick={tg.tgTest}
            className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
          >
            {tg.tgTesting ? "发送中…" : "📨 发送测试消息"}
          </button>
        </div>

        {!tg.tgBotTokenConfigured && (
          <p className="text-[10px] text-gray-400 dark:text-slate-500">
            💡 使用提示：通过 @BotFather 创建 Bot 获取 Token；用 @userinfobot 查询你的 Chat ID。
          </p>
        )}
      </div>
    </div>
  );
}
