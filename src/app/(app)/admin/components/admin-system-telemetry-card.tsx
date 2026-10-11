"use client";

import type { UseAdminReportSettingsResult } from "@/hooks/use-admin-report-settings";

/**
 * 「系统与数据管理」Tab 的块：📡 匿名遥测（帮助改进 Navelix）。
 *
 * 这是**系统全局**设置项（`system_settings` 存储、由 `requireAdmin` 门禁），
 * 原误放在「个人账号与安全」Tab。现移回系统级配置区。
 * 开关状态与保存逻辑来自 `useAdminReportSettings()`。
 */
export default function AdminSystemTelemetryCard({
  report,
}: {
  report: UseAdminReportSettingsResult;
}) {
  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors">
      <div>
        <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
          <span>📡</span>
          <span>匿名遥测（帮助改进 Navelix）</span>
        </h3>
        <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
          每周上报一次匿名聚合统计（功能使用计数，不含任何个人信息），用于改进产品
        </p>
      </div>

      <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700">
        <div>
          <p className="text-xs font-bold text-gray-800 dark:text-slate-200">
            匿名遥测周报
          </p>
          <p className="text-[10px] text-gray-400 dark:text-slate-400 mt-0.5">
            关闭后不再发送任何匿名统计数据（仅聚合计数，无个人数据）
          </p>
          {!report.reportEndpointConfigured && report.reportEnabled && (
            <p className="text-[10px] text-amber-500 dark:text-amber-400 mt-0.5">
              ⚠️ 未配置接收端点（EE 字节码未注入或环境变量为空），实际不会外发
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => report.reportSave(!report.reportEnabled)}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            report.reportEnabled
              ? "bg-[#00C776] text-white"
              : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
          }`}
        >
          {report.reportEnabled ? "已开启" : "已关闭"}
        </button>
      </div>

      <p className="text-[10px] text-gray-400 dark:text-slate-500 leading-relaxed">
        🔒 隐私承诺：匿名遥测<b>仅上报聚合计数与枚举值</b>，绝不包含用户 ID、IP、URL、
        对话内容、Token 或 API Key。接收端点由 EE 字节码注入，公共源码不含任何默认端点；
        可通过环境变量 <code className="font-mono">NAVELIX_ANALYTICS_ENDPOINT</code> 自建接收端。
      </p>
    </div>
  );
}
