"use client";

import { useTranslations } from "next-intl";
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
  isAdmin = false,
}: {
  tg: UseAdminTelegramSettingsResult;
  isAdmin?: boolean;
}) {
  const tx = useTranslations();
  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors">
      <div>
        <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
          <span>📮</span>
          <span>{tx("telegram_bot_notifications_95d4e070")}</span>
        </h3>
        <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
          {tx("this_channel_belongs_to_your_account_only_person_a2aa1f3a")}</p>
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
              {tg.tgBotTokenConfigured ? tx("configured_de8184da") : tx("not_configured_80a57e03")}
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
            placeholder={tg.tgBotTokenConfigured ? tx("saved_enter_a_new_token_to_replace_it_leave_blan_be84c7dd") : tx("123456_abc_def_get_it_from_botfather_595865f0")}
            className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
          />
        </div>

        <button type="button" onClick={() => tg.tgSave({ clearBotToken: true })} className="text-xs text-rose-600">{tx("clear_bot_token_89747480")}</button>
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
              {tg.tgChatIdConfigured ? tx("configured_de8184da") : tx("not_configured_80a57e03")}
            </span>
          </div>
          <input
            type="text"
            value={tg.tgChatId}
            onChange={(e) => tg.setTgChatId(e.target.value)}
            onBlur={() => tg.tgSave({ chatId: tg.tgChatId.trim() })}
            placeholder={tx("e_g_123456789_ask_userinfobot_for_your_id_06f33bb9")}
            className="w-full h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
          />
        </div>

        {/* 总开关 */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700">
          <div>
            <p className="text-xs font-bold text-gray-800 dark:text-slate-200">
              {tx("enable_telegram_notifications_15c3e4e2")}</p>
            <p className="text-[10px] text-gray-400 dark:text-slate-400 mt-0.5">
              {tx("when_off_no_telegram_notifications_are_sent_for__283a03ea")}</p>
          </div>
          <button
            type="button"
            onClick={tg.toggleTgEnabled}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              tg.tgEnabled
                ? "bg-brand text-white"
                : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
            }`}
          >
            {tg.tgEnabled ? tx("on_8a4ef3e4") : tx("off_6744b4c6")}
          </button>
        </div>

        <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-3">
          <p className="text-xs font-bold text-gray-800 dark:text-slate-200">{tx("personal_notifications_a8273278")}</p>
          {([
            ["notifyTodo", tx("todo_calendar_due_reminders_effb0102"), tx("once_after_09_00_on_the_due_date_in_the_server_s_161750b6")],
            ["notifyAssignment", tx("task_assignments_7b9f0879"), tx("tasks_created_or_reassigned_to_you_by_another_us_1ca58eae")],
            ["notifyDataTransfer", tx("personal_data_import_export_6753412e"), tx("personal_json_import_completed_or_export_file_ge_8b33ca70")],
          ] as const).map(([key, label, description]) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] text-gray-600 dark:text-slate-300">{label}</p>
                <p className="text-[10px] text-gray-400 dark:text-slate-400">{description}</p>
              </div>
              <button type="button" aria-label={label} aria-pressed={tg.personalSubscriptions[key]}
                onClick={() => tg.togglePersonalSubscription(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${tg.personalSubscriptions[key] ? "bg-brand text-white" : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300"}`}>
                {tg.personalSubscriptions[key] ? tx("on_8a4ef3e4") : tx("off_6744b4c6")}
              </button>
            </div>
          ))}
        </div>

        {isAdmin && <>
        {/* 场景开关 */}
        <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-2">
          <p className="text-xs font-bold text-gray-800 dark:text-slate-200">
            {tx("system_notifications_administrators_only_85c2ff0d")}</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-gray-600 dark:text-slate-300">{tx("backup_results_bce1d1d1")}</p>
              <p className="text-[10px] text-gray-400 dark:text-slate-400">{tx("local_cloud_backup_successes_and_failures_c81a7e88")}</p>
            </div>
            <button
              type="button"
              onClick={tg.toggleTgNotifyBackup}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                tg.tgNotifyBackup
                  ? "bg-brand text-white"
                  : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
              }`}
            >
              {tg.tgNotifyBackup ? tx("on_8a4ef3e4") : tx("off_6744b4c6")}
            </button>
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t border-gray-200/80 dark:border-slate-700">
            <div>
              <p className="text-[11px] text-gray-600 dark:text-slate-300">{tx("system_alerts_bf8c7903")}</p>
              <p className="text-[10px] text-gray-400 dark:text-slate-400">{tx("service_restart_disk_usage_sign_in_alerts_dbf0af71")}</p>
            </div>
            <button
              type="button"
              onClick={tg.toggleTgNotifySystem}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                tg.tgNotifySystem
                  ? "bg-brand text-white"
                  : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
              }`}
            >
              {tg.tgNotifySystem ? tx("on_8a4ef3e4") : tx("off_6744b4c6")}
            </button>
          </div>
        </div>

        </>}
        {/* 操作按钮 */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            type="button"
            disabled={tg.tgTesting}
            onClick={tg.tgTest}
            className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
          >
            {tg.tgTesting ? tx("sending_364970d8") : tx("send_test_message_d90631d2")}
          </button>
        </div>

        {!tg.tgBotTokenConfigured && (
          <p className="text-[10px] text-gray-400 dark:text-slate-500">
            {tx("create_a_bot_with_botfather_to_get_a_token_ask_u_19b4615a")}</p>
        )}
      </div>
    </div>
  );
}
