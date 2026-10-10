"use client";

import { useEffect, useState } from "react";
import Toast from "@/components/toast";
import { useToast } from "@/hooks/use-toast";
import { useAdminUpdateCheck } from "@/hooks/use-admin-update-check";
import { useAdminAntigravitySecret } from "@/hooks/use-admin-antigravity-secret";
import { useAdminDbBackup } from "@/hooks/use-admin-db-backup";
import { useAdminDataTransfer } from "@/hooks/use-admin-data-transfer";
import { useAdminCachePurge } from "@/hooks/use-admin-cache-purge";
import AdminSystemAccessCard from "./admin-system-access-card";
import AdminSystemSearchBarCard from "./admin-system-search-bar-card";
import AdminSystemAntigravityCard from "./admin-system-antigravity-card";
import AdminSystemUpdateCard from "./admin-system-update-card";
import AdminSystemDbBackupCard from "./admin-system-db-backup-card";
import AdminSystemDataTransferCard from "./admin-system-data-transfer-card";
import AdminSystemCachePurgeCard from "./admin-system-cache-purge-card";

/**
 * 管理后台「系统运维与安全」Tab 的组装层。
 *
 * 原文件 928 行，把访问策略、搜索栏、反重力 OAuth、版本自检、数据库备份还原、
 * 数据导入导出与缓存清理七块互不相关的设置挤在一个组件里。现按功能域拆分：
 *   - 状态与副作用 → `useAdminUpdateCheck` / `useAdminAntigravitySecret` /
 *     `useAdminDbBackup` / `useAdminDataTransfer` / `useAdminCachePurge`
 *   - 纯逻辑（响应解析、载荷组装、本地数据读写、提示文案）→ `@/lib/admin-system`
 *   - 各设置卡片 → 同目录 `admin-system-*-card.tsx`
 * 本文件只保留角色判定、Toast 与两栏栅格编排。
 */

interface AdminSystemTabProps {
  currentUser?: {
    role?: "admin" | "user";
    username?: string;
  } | null;
}

export default function AdminSystemTab({ currentUser }: AdminSystemTabProps = {}) {
  // ── 用户角色判定 ──
  const [fetchedRole, setFetchedRole] = useState<"admin" | "user" | null>(null);

  useEffect(() => {
    if (!currentUser?.role) {
      fetch("/api/auth/me")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.user?.role) {
            setFetchedRole(data.user.role);
          }
        })
        .catch(() => {});
    }
  }, [currentUser?.role]);

  const isAdmin = (currentUser?.role || fetchedRole) === "admin";

  const { notice, flash, notify } = useToast();

  // 五块设置各自的状态与接口调用
  const update = useAdminUpdateCheck();
  const antigravity = useAdminAntigravitySecret({ notify });
  const db = useAdminDbBackup({ notify });
  const transfer = useAdminDataTransfer({ flash, notify });
  const purge = useAdminCachePurge({ notify });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <Toast message={notice} className="lg:col-span-12 mb-2" />

      {/* 左栏：安全访问策略、搜索栏、反重力 OAuth 与系统版本更新 (6 cols) */}
      <div className="lg:col-span-6 space-y-6">
        {/* 块 1：🔒 访问控制与注册策略 */}
        <AdminSystemAccessCard isAdmin={isAdmin} />

        {/* 块 2：🔍 首页搜索栏（仅系统内搜索，无需配置搜索引擎） */}
        <AdminSystemSearchBarCard />

        {/* 块 3：🔐 反重力 OAuth 配置 */}
        <AdminSystemAntigravityCard antigravity={antigravity} />

        {/* 块 4：🔄 版本与更新 */}
        <AdminSystemUpdateCard update={update} />
      </div>

      {/* 右栏：数据库快照备份与还原、数据导入导出、系统运维清理 (6 cols) */}
      <div className="lg:col-span-6 space-y-6">
        {/* 块 5：💾 数据库物理快照与备份还原 */}
        <AdminSystemDbBackupCard db={db} />

        {/* 块 6：📦 配置与数据导入导出 */}
        <AdminSystemDataTransferCard transfer={transfer} />

        {/* 块 7：🧹 缓存与系统存储清理 */}
        <AdminSystemCachePurgeCard purge={purge} />
      </div>
    </div>
  );
}
