"use client";

import React from "react";
import Link from "next/link";
import { useNavelixData } from "@/hooks/use-navelix-data";
import { useNavelixConfig } from "@/hooks/use-navelix-config";

export default function SecuritySetupBanner() {
  const { user } = useNavelixData();
  const { config, updateConfig } = useNavelixConfig();

  // 仅对管理员展示；已完成安全设置引导或非管理员不展示
  if (!user || user.role !== "admin" || config.securitySetupDone) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-4 sm:p-5 shadow-2xs animate-fadeIn">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <span className="text-2xl leading-none">🔐</span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
              首次使用安全设置引导
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-700/90 dark:text-amber-300/80">
              为确保安全，新部署默认已关闭「未登录公开访问」与「新用户注册」。
              建议你按以下两步完成初始安全配置：
            </p>
            <ul className="mt-2 flex flex-col gap-1 text-xs text-amber-800 dark:text-amber-200/90">
              <li className="flex items-center gap-1.5">
                <span className="text-[#009a5a]">✓</span>
                <span>前往「个人账号与安全」修改初始登录密码</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-[#009a5a]">✓</span>
                <span>前往「系统与数据管理」按需开启公开访问或开放注册</span>
              </li>
            </ul>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link
            href="/admin?tab=profile"
            className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white shadow-2xs transition-colors hover:bg-amber-600 cursor-pointer"
          >
            修改初始密码
          </Link>
          <Link
            href="/admin?tab=system"
            className="rounded-xl bg-[#00C776] px-4 py-2 text-xs font-bold text-white shadow-2xs transition-colors hover:bg-[#009a5a] cursor-pointer"
          >
            配置访问策略
          </Link>
          <button
            type="button"
            onClick={() => updateConfig({ securitySetupDone: true })}
            className="rounded-xl border border-amber-300 dark:border-amber-800 px-4 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300 transition-colors hover:bg-amber-100 dark:hover:bg-amber-900/40 cursor-pointer"
          >
            我已了解
          </button>
        </div>
      </div>
    </div>
  );
}
