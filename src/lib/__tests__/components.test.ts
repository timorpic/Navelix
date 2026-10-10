import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
import { setupDom, teardownDom, loadTsx } from "./helpers/tsx-loader.ts";
import { render, getByText, query, queryAll, click, cleanup } from "./helpers/render.ts";

/**
 * 展示组件渲染测试。
 *
 * 本轮把 11 个巨石组件拆成了「lib 纯函数 + hook + 展示组件 + 拼装层」，其中
 * 展示组件此前完全没有测试覆盖（仓库里 0 个 `*.test.tsx`）。纯函数部分已由
 * 各 `lib/__tests__/*.test.ts` 覆盖，这里补上**渲染层**：确认拆分后的组件
 * 在给定 props 下确实产出预期的 DOM，而不是只保证类型对得上。
 *
 * 运行方式见 helpers/tsx-loader.ts —— 测试用 `node --experimental-strip-types`
 * 跑，不转换 JSX，因此组件在运行时用 esbuild 编译后加载。
 */

let Overlay: never;
let Toast: never;
let AiBreakdownCard: never;

before(async () => {
  await setupDom();
  Overlay = (await loadTsx("src/components/overlay.tsx")).default as never;
  Toast = (await loadTsx("src/components/toast.tsx")).default as never;
  AiBreakdownCard = (await loadTsx("src/components/ai-breakdown-card.tsx")).default as never;
});
after(() => teardownDom());
beforeEach(() => cleanup());

describe("Overlay", () => {
  it("渲染为固定定位的居中遮罩，并包含子元素", () => {
    const r = render(Overlay, { children: "面板内容" });
    const root = query("div.fixed.inset-0");
    assert.ok(root, "应渲染 fixed inset-0 遮罩");
    assert.ok(root!.className.includes("items-center"));
    assert.ok(root!.className.includes("justify-center"));
    assert.ok(root!.className.includes("z-50"));
    assert.equal(getByText("面板内容")?.textContent, "面板内容");
    r.unmount();
  });

  it("不包裹额外层（子元素直接落在遮罩上）", () => {
    const r = render(Overlay, { children: "X" });
    const root = query("div.fixed.inset-0")!;
    // Overlay 刻意不引入包装 div（否则 flex 居中的对象会变成包装层而非面板本身）。
    // 传字符串 children 时 React 渲染为直接文本节点，因此 children 应为 0
    // —— 若有包装层，这里会是 1。
    assert.equal(root.children.length, 0, "不应引入包装层");
    assert.equal(root.textContent, "X");
    r.unmount();
  });

  it("传入元素时该元素成为遮罩的直接子节点", () => {
    const { createElement } = require("react") as typeof import("react");
    const panel = createElement("section", { className: "panel" }, "面板");
    const r = render(Overlay, { children: panel });
    const root = query("div.fixed.inset-0")!;
    assert.equal(root.children.length, 1);
    assert.equal(root.children[0].tagName, "SECTION");
    assert.ok((root.children[0] as HTMLElement).className.includes("panel"));
    r.unmount();
  });
});

describe("Toast", () => {
  it("message 为空时不渲染任何内容", () => {
    const r = render(Toast, { message: "" });
    assert.equal(r.container.innerHTML, "");
    r.unmount();
  });

  it("默认 banner 变体：内联绿色横幅", () => {
    const r = render(Toast, { message: "已保存" });
    const el = getByText("已保存")!;
    assert.ok(el.className.includes("rounded-xl"));
    assert.ok(el.className.includes("border-[#00C776]/30"));
    assert.equal(query("div.fixed.top-4"), null, "banner 不应固定定位");
    r.unmount();
  });

  it("toast 变体：右上角固定浮层", () => {
    const r = render(Toast, { message: "已复制", variant: "toast" });
    const el = getByText("已复制")!;
    assert.ok(el.className.includes("fixed"));
    assert.ok(el.className.includes("top-4"));
    assert.ok(el.className.includes("right-4"));
    r.unmount();
  });

  it("className 追加到 banner 外层", () => {
    const r = render(Toast, { message: "X", className: "mb-4" });
    assert.ok(getByText("X")!.className.includes("mb-4"));
    r.unmount();
  });
});

describe("AiBreakdownCard", () => {
  const members = [
    { id: "u1", username: "admin", displayName: "管理员" },
    { id: "u2", username: "bob" },
  ];

  function makeAi(over: Record<string, unknown> = {}) {
    return {
      loading: false,
      notice: "",
      warning: "",
      clearWarning: () => {},
      tasks: [{ title: "阶段一", priority: "high", dueDate: "2026-10-12" }],
      syncToCalendar: true,
      setSyncToCalendar: () => {},
      generate: async () => {},
      updateTitle: () => {},
      updatePriority: () => {},
      updateDueDate: () => {},
      updateAssignee: () => {},
      removeTask: () => {},
      addTask: () => {},
      loadDraft: () => {},
      reset: () => {},
      ...over,
    };
  }

  it("tasks 为空时整卡不渲染", () => {
    const r = render(AiBreakdownCard, { ai: makeAi({ tasks: [] }), members, isEditing: false });
    assert.equal(r.container.innerHTML, "");
    r.unmount();
  });

  it("新建模式标题为「拆解与团队指派预览」，编辑模式为「追加阶段任务」", () => {
    const a = render(AiBreakdownCard, { ai: makeAi(), members, isEditing: false });
    assert.ok(getByText(/AI 里程碑任务拆解与团队指派预览/), "新建模式标题");
    a.unmount();
    cleanup();

    const b = render(AiBreakdownCard, { ai: makeAi(), members, isEditing: true });
    assert.ok(getByText(/AI 为当前项目追加阶段任务与排期/), "编辑模式标题");
    b.unmount();
  });

  it("渲染任务标题（受控输入框的 value）、序号与阶段计数", () => {
    const r = render(AiBreakdownCard, {
      ai: makeAi({
        tasks: [
          { title: "阶段一", priority: "high", dueDate: "2026-10-12" },
          { title: "阶段二", priority: "low", dueDate: "2026-10-15" },
        ],
      }),
      members,
      isEditing: false,
    });
    const titles = queryAll('input[name="projectTaskTitle"]') as HTMLInputElement[];
    assert.equal(titles.length, 2);
    assert.deepEqual(titles.map((i) => i.value), ["阶段一", "阶段二"]);

    // 序号徽标
    assert.ok(getByText("1"));
    assert.ok(getByText("2"));

    // 阶段计数
    assert.ok(getByText("(共 2 个阶段)"));

    // 优先级与截止日期也按任务渲染
    assert.equal(queryAll('select[name="projectTaskPriority"]').length, 2);
    assert.equal(queryAll('input[name="projectTaskDueDate"]').length, 2);
    r.unmount();
  });

  it("members 为空时不渲染责任人下拉", () => {
    const r = render(AiBreakdownCard, { ai: makeAi(), members: [], isEditing: false });
    assert.equal(queryAll('select[name="projectTaskAssignee"]').length, 0);
    // 优先级下拉仍应存在
    assert.equal(queryAll('select[name="projectTaskPriority"]').length, 1);
    r.unmount();
  });

  it("warning 与 notice 同时存在时两者都渲染", () => {
    const r = render(AiBreakdownCard, {
      ai: makeAi({ warning: "请先输入项目名称", notice: "已为您规划" }),
      members,
      isEditing: false,
    });
    assert.ok(getByText("请先输入项目名称"));
    assert.ok(getByText("已为您规划"));
    r.unmount();
  });

  it("点「+ 补充任务」触发 addTask", () => {
    let called = 0;
    const r = render(AiBreakdownCard, {
      ai: makeAi({ addTask: () => called++ }),
      members,
      isEditing: false,
    });
    const btn = getByText("添加自定义阶段任务")!;
    click(btn);
    assert.equal(called, 1);
    r.unmount();
  });

  it("点删除按钮触发 removeTask 并带上行号", () => {
    const removed: number[] = [];
    const r = render(AiBreakdownCard, {
      ai: makeAi({
        tasks: [
          { title: "A", priority: "high", dueDate: "" },
          { title: "B", priority: "low", dueDate: "" },
        ],
        removeTask: (i: number) => removed.push(i),
      }),
      members,
      isEditing: false,
    });
    const buttons = queryAll('button[title="删除此项"]');
    assert.equal(buttons.length, 2);
    click(buttons[1]);
    assert.deepEqual(removed, [1]);
    r.unmount();
  });

  it("勾选同步日历开关触发 setSyncToCalendar(false)", () => {
    const seen: boolean[] = [];
    const r = render(AiBreakdownCard, {
      ai: makeAi({ setSyncToCalendar: (v: boolean) => seen.push(v) }),
      members,
      isEditing: false,
    });
    const checkbox = queryAll('input[type="checkbox"]')[0] as HTMLInputElement;
    click(checkbox);
    assert.deepEqual(seen, [false]);
    r.unmount();
  });
});
