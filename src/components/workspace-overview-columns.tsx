"use client";

import { useEffect, useState } from "react";
import type { Category, SiteLink } from "@/types";
import ProjectOverviewColumn from "./project-overview-column";
import ScheduleOverviewColumn from "./schedule-overview-column";

/**
 * 首页工作台双栏容器。
 *
 * 原为 811 行的单文件，内含「项目概览」与「日程概览」两个互不相关的栏目。
 * 现拆为 `project-overview-column` / `schedule-overview-column` 两个组件，
 * 共享的待办操作与派生数据下沉到 `use-workspace-todos` hook。
 * 本文件只负责布局与两栏共用的时钟节拍。
 */

interface WorkspaceOverviewColumnsProps {
  categories: Category[];
  links: SiteLink[];
  onSelectCategory: (id: string) => void;
}

export default function WorkspaceOverviewColumns({
  links,
  onSelectCategory,
}: WorkspaceOverviewColumnsProps) {
  // 动态时钟（每 30 秒刷新一次），两栏的相对时间展示共用同一节拍
  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => {
      setNowTs(Date.now());
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 my-0">
      <ProjectOverviewColumn
        links={links}
        onSelectCategory={onSelectCategory}
        nowTs={nowTs}
      />
      <ScheduleOverviewColumn onSelectCategory={onSelectCategory} />
    </div>
  );
}
