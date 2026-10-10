import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setupDom, teardownDom, loadTsx } from "./helpers/tsx-loader.ts";
import { render, getByText, query, queryAll, click, setValue, cleanup } from "./helpers/render.ts";

/**
 * 本轮拆分出的弹窗与卡片组件的渲染测试。
 *
 * 这些组件此前是巨石文件里的内联 JSX（`calendar-view.tsx` 1456 行、
 * `recent-activities-card.tsx` 991 行等），没有任何测试覆盖；拆成独立组件后
 * 才有条件在渲染层验证「props 进 → 预期 DOM 出」。
 */

let IcalExportModal: never;
let AiScheduleModal: never;
let ScheduleEditModal: never;
let ActivityDetailModal: never;
let ActivityIcon: never;
let ProjectGanttView: never;

before(async () => {
  await setupDom();
  IcalExportModal = (await loadTsx("src/components/ical-export-modal.tsx")).default as never;
  AiScheduleModal = (await loadTsx("src/components/ai-schedule-modal.tsx")).default as never;
  ScheduleEditModal = (await loadTsx("src/components/schedule-edit-modal.tsx")).default as never;
  ActivityDetailModal = (await loadTsx("src/components/activity-detail-modal.tsx")).default as never;
  ActivityIcon = (await loadTsx("src/components/activity-icon.tsx")).default as never;
  ProjectGanttView = (await loadTsx("src/components/project-gantt-view.tsx")).default as never;
});
after(() => teardownDom());
beforeEach(() => cleanup());

describe("IcalExportModal", () => {
  it("open 为 false 时不渲染", () => {
    const r = render(IcalExportModal, { open: false, onClose: () => {} });
    assert.equal(r.container.innerHTML, "");
    r.unmount();
  });

  it("open 时渲染下载入口，href 指向导出接口", () => {
    const r = render(IcalExportModal, { open: true, onClose: () => {} });
    const link = query("a[download]") as HTMLAnchorElement;
    assert.ok(link, "应有下载链接");
    assert.equal(link.getAttribute("href"), "/api/calendar/export");
    assert.equal(link.getAttribute("download"), "navelix-schedule.ics");
    r.unmount();
  });

  it("两个关闭入口（✕ 与底部按钮）都调用 onClose", () => {
    let closed = 0;
    const r = render(IcalExportModal, { open: true, onClose: () => closed++ });
    click(getByText("✕")!);
    assert.equal(closed, 1);
    click(getByText("关闭")!);
    assert.equal(closed, 2);
    r.unmount();
  });
});

describe("AiScheduleModal", () => {
  function makeProps(over: Record<string, unknown> = {}) {
    return {
      open: true,
      onClose: () => {},
      dateLabel: "2026-10-12",
      advice: "建议上午攻坚",
      tasks: [{ title: "任务甲", priority: "high", dueDate: "2026-10-12" }],
      selectedIndices: new Set<number>([0]),
      planning: false,
      applying: false,
      warning: "",
      onToggleIndex: () => {},
      onUpdateTitle: () => {},
      onUpdatePriority: () => {},
      onDeleteTask: () => {},
      onAddCustomTask: () => {},
      onApply: () => {},
      ...over,
    };
  }

  it("open 为 false 时不渲染", () => {
    const r = render(AiScheduleModal, makeProps({ open: false }));
    assert.equal(r.container.innerHTML, "");
    r.unmount();
  });

  it("planning 时显示加载态而非任务列表", () => {
    const r = render(AiScheduleModal, makeProps({ planning: true }));
    assert.ok(getByText(/正在深度分析/));
    assert.equal(queryAll('input[name="aiTaskTitle"]').length, 0);
    r.unmount();
  });

  it("渲染建议文案、日期与「已选 N/M」", () => {
    const r = render(AiScheduleModal, makeProps());
    assert.ok(getByText("建议上午攻坚"));
    assert.ok(getByText(/针对 2026-10-12 智能规划/));
    assert.ok(getByText(/规划任务列表 \(已选 1\/1\)/));
    r.unmount();
  });

  it("warning 存在时渲染为醒目提示", () => {
    const r = render(AiScheduleModal, makeProps({ warning: "请至少勾选一项任务" }));
    assert.ok(getByText("请至少勾选一项任务"));
    r.unmount();
  });

  it("未选中任何任务时采纳按钮禁用", () => {
    const r = render(AiScheduleModal, makeProps({ selectedIndices: new Set<number>() }));
    const apply = getByText(/一键采纳并写入日历/)!.closest("button") as HTMLButtonElement;
    assert.equal(apply.disabled, true);
    r.unmount();
  });

  it("applying 时按钮文案变为「写入中...」", () => {
    const r = render(AiScheduleModal, makeProps({ applying: true }));
    assert.ok(getByText("写入中..."));
    r.unmount();
  });

  it("勾选框触发 onToggleIndex 并带上行号", () => {
    const toggled: number[] = [];
    const r = render(AiScheduleModal, makeProps({ onToggleIndex: (i: number) => toggled.push(i) }));
    click(queryAll('input[type="checkbox"]')[0]);
    assert.deepEqual(toggled, [0]);
    r.unmount();
  });

  it("改标题触发 onUpdateTitle(idx, value)", () => {
    const calls: [number, string][] = [];
    const r = render(
      AiScheduleModal,
      makeProps({ onUpdateTitle: (i: number, v: string) => calls.push([i, v]) }),
    );
    setValue(query('input[name="aiTaskTitle"]') as HTMLInputElement, "改后的标题");
    assert.deepEqual(calls, [[0, "改后的标题"]]);
    r.unmount();
  });

  it("删除按钮触发 onDeleteTask 并带上行号", () => {
    const removed: number[] = [];
    const r = render(AiScheduleModal, makeProps({ onDeleteTask: (i: number) => removed.push(i) }));
    click(queryAll('button[title="移除此项"]')[0]);
    assert.deepEqual(removed, [0]);
    r.unmount();
  });
});

describe("ScheduleEditModal", () => {
  const item = {
    id: "t1",
    title: "原标题",
    priority: "medium",
    dueDate: "2026-10-20",
    projectId: "p1",
    assigneeId: "u1",
    done: false,
  };
  const projects = [{ id: "p1", name: "项目甲" }];
  const members = [{ id: "u1", username: "admin", displayName: "管理员" }];

  it("表单初值取自 item（受控输入框的 value）", () => {
    const r = render(ScheduleEditModal, {
      item,
      projects,
      members,
      defaultDateStr: "2026-10-12",
      onClose: () => {},
      onSaved: () => {},
    });
    assert.equal((query('input[name="formTitle"]') as HTMLInputElement).value, "原标题");
    assert.equal((query('input[name="formDueDate"]') as HTMLInputElement).value, "2026-10-20");
    assert.equal((query('select[name="formPriority"]') as HTMLSelectElement).value, "medium");
    assert.equal((query('select[name="formProjectId"]') as HTMLSelectElement).value, "p1");
    assert.equal((query('select[name="formAssigneeId"]') as HTMLSelectElement).value, "u1");
    r.unmount();
  });

  it("item 无截止日期时回落到 defaultDateStr", () => {
    const r = render(ScheduleEditModal, {
      item: { ...item, dueDate: "" },
      projects,
      members,
      defaultDateStr: "2026-10-12",
      onClose: () => {},
      onSaved: () => {},
    });
    assert.equal((query('input[name="formDueDate"]') as HTMLInputElement).value, "2026-10-12");
    r.unmount();
  });

  it("项目与责任人下拉包含候选项及「未关联/未指派」空选项", () => {
    const r = render(ScheduleEditModal, {
      item,
      projects,
      members,
      defaultDateStr: "2026-10-12",
      onClose: () => {},
      onSaved: () => {},
    });
    const projOpts = queryAll('select[name="formProjectId"] option') as HTMLOptionElement[];
    assert.deepEqual(projOpts.map((o) => o.textContent), ["未关联项目", "项目甲"]);
    const memOpts = queryAll('select[name="formAssigneeId"] option') as HTMLOptionElement[];
    assert.deepEqual(memOpts.map((o) => o.textContent), ["未指派 (自己)", "👤 管理员"]);
    r.unmount();
  });

  it("取消与 ✕ 都调用 onClose，不调用 onSaved", () => {
    let closed = 0;
    let saved = 0;
    const r = render(ScheduleEditModal, {
      item,
      projects,
      members,
      defaultDateStr: "2026-10-12",
      onClose: () => closed++,
      onSaved: () => saved++,
    });
    click(getByText("取消")!);
    click(getByText("✕")!);
    assert.equal(closed, 2);
    assert.equal(saved, 0);
    r.unmount();
  });
});

describe("ActivityDetailModal", () => {
  it("item 为 null 时不渲染", () => {
    const r = render(ActivityDetailModal, { item: null, onClose: () => {} });
    assert.equal(r.container.innerHTML, "");
    r.unmount();
  });

  it("渲染条目标题与关闭按钮", () => {
    const item = {
      id: "a1",
      title: "活动标题",
      content: "活动内容",
      ts: Date.now(),
      source: "api",
      sourceLabel: "API推送",
      sourceBadgeClass: "bg-sky-50",
      icon: "🌐",
      timeLabel: "刚刚",
      isNotification: true,
    };
    let closed = 0;
    const r = render(ActivityDetailModal, { item, onClose: () => closed++ });
    assert.ok(getByText("活动标题"));
    const closeBtn = queryAll("button").find((b) => /关闭|✕/.test(b.textContent || ""));
    assert.ok(closeBtn, "应有关闭入口");
    click(closeBtn!);
    assert.equal(closed, 1);
    r.unmount();
  });
});

describe("ActivityIcon", () => {
  it("渲染传入的图标字符", () => {
    const r = render(ActivityIcon, { icon: "🔔" });
    assert.equal(r.container.textContent, "🔔");
    r.unmount();
  });
});

describe("ProjectGanttView", () => {
  const projects = [{ id: "p1", name: "项目甲", status: "进行中", color: "#00C776" }];

  function makeGantt(over: Record<string, unknown> = {}) {
    const columns = [
      { key: "2026-10-10", label: "10", subLabel: "周六", isCurrent: true, isWeekend: true },
      { key: "2026-10-11", label: "11", subLabel: "周日", isCurrent: false, isWeekend: true },
    ];
    return {
      scale: "day",
      offset: 0,
      setOffset: () => {},
      projectFilter: "all",
      setProjectFilter: () => {},
      collapsedIds: [],
      toggleCollapse: () => {},
      handleScaleChange: () => {},
      columns,
      timelineLabel: "日排期视界：2026-10-10 ~ 2026-10-11",
      prevLabel: "◀ 前移 7 天",
      nextLabel: "后移 7 天 ▶",
      stepAmount: 7,
      calculateGanttPosition: () => ({ startIdx: 0, span: 1 }),
      calculateProjectSpan: () => ({ startIdx: 0, span: 2 }),
      ...over,
    };
  }

  const todos = [{ id: "t1", title: "里程碑", done: false, priority: "high", dueDate: "2026-10-10" }];

  it("渲染时间轴标签、项目名与完成度", () => {
    const r = render(ProjectGanttView, {
      gantt: makeGantt(),
      projects,
      getProjectTodos: () => todos,
      doneCount: () => 0,
      onToggleTodo: () => {},
      onEditProject: () => {},
    });
    assert.ok(getByText("日排期视界：2026-10-10 ~ 2026-10-11"));
    assert.ok(getByText("项目甲"));
    assert.ok(getByText(/0\/1 \(0%\)/));
    r.unmount();
  });

  it("项目筛选下拉包含「全部项目」与各项目", () => {
    const r = render(ProjectGanttView, {
      gantt: makeGantt(),
      projects,
      getProjectTodos: () => [],
      doneCount: () => 0,
      onToggleTodo: () => {},
      onEditProject: () => {},
    });
    const opts = queryAll("select option") as HTMLOptionElement[];
    assert.deepEqual(opts.map((o) => o.textContent), ["全部项目", "项目甲"]);
    r.unmount();
  });

  it("三种尺度按钮都渲染", () => {
    const r = render(ProjectGanttView, {
      gantt: makeGantt(),
      projects,
      getProjectTodos: () => [],
      doneCount: () => 0,
      onToggleTodo: () => {},
      onEditProject: () => {},
    });
    for (const label of [/日 \(21天\)/, /月 \(年度推进\)/, /年 \(跨年路线图\)/]) {
      assert.ok(
        queryAll("button").some((b) => label.test(b.textContent || "")),
        `缺少尺度按钮 ${label}`,
      );
    }
    r.unmount();
  });

  it("尺度按钮触发 handleScaleChange", () => {
    const seen: string[] = [];
    const r = render(ProjectGanttView, {
      gantt: makeGantt({ handleScaleChange: (s: string) => seen.push(s) }),
      projects,
      getProjectTodos: () => [],
      doneCount: () => 0,
      onToggleTodo: () => {},
      onEditProject: () => {},
    });
    const monthBtn = queryAll("button").find((b) => /月 \(年度推进\)/.test(b.textContent || ""))!;
    click(monthBtn);
    assert.deepEqual(seen, ["month"]);
    r.unmount();
  });

  it("折叠的项目不渲染子任务行", () => {
    const r = render(ProjectGanttView, {
      gantt: makeGantt({ collapsedIds: ["p1"] }),
      projects,
      getProjectTodos: () => todos,
      doneCount: () => 0,
      onToggleTodo: () => {},
      onEditProject: () => {},
    });
    // 子任务标题不应出现（折叠状态）
    assert.equal(getByText("里程碑"), null);
    r.unmount();
  });

  it("展开状态下子任务标题可见且可勾选", () => {
    const toggled: [string, boolean][] = [];
    const r = render(ProjectGanttView, {
      gantt: makeGantt(),
      projects,
      getProjectTodos: () => todos,
      doneCount: () => 0,
      onToggleTodo: (id: string, done: boolean) => toggled.push([id, done]),
      onEditProject: () => {},
    });
    assert.ok(getByText("里程碑"));
    const cb = queryAll('input[type="checkbox"]')[0];
    click(cb);
    assert.deepEqual(toggled, [["t1", false]]);
    r.unmount();
  });

  it("项目行的 ✨ 触发 onEditProject(p, true)", () => {
    const calls: [string, boolean | undefined][] = [];
    const r = render(ProjectGanttView, {
      gantt: makeGantt(),
      projects,
      getProjectTodos: () => [],
      doneCount: () => 0,
      onToggleTodo: () => {},
      onEditProject: (p: { id: string }, ai?: boolean) => calls.push([p.id, ai]),
    });
    const starBtn = queryAll("button").find((b) => b.title === "使用 AI 拆解追加任务")!;
    click(starBtn);
    assert.deepEqual(calls, [["p1", true]]);
    r.unmount();
  });
});
