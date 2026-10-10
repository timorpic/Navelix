import { test, expect, type Page } from "@playwright/test";

/**
 * 组件拆分后的回归覆盖。
 *
 * 本轮把 11 个巨石组件（projects-view / calendar-view / recent-activities-card /
 * sidebar / dashboard-view 与 6 个后台 Tab）拆成了「lib 纯函数 + hook + 展示组件 +
 * 拼装层」。单元测试只覆盖下沉到 `lib/` 的纯计算，界面拼装是否正确只有真实渲染能证明，
 * 因此在此逐一验证拆分后的入口仍可用。
 *
 * 前置条件同 core-flow.spec.ts：webServer 自动启动，独立端口 + 隔离数据目录。
 */

async function login(page: Page) {
  await page.goto("/login");
  await page.fill("#login-username", "admin");
  await page.fill("#login-password", "e2e-test-password");
  await page.getByRole("button", { name: "立即登录" }).click();
  await page.waitForURL("/");
}

/**
 * 通过页面内 fetch 播种数据。
 *
 * 不能用 `page.request` —— 它不携带 `Origin`，会被 `src/proxy.ts` 的写请求
 * CSRF 校验挡下（400），数据实际没写进去。
 */
async function seed(page: Page, path: string, data: unknown) {
  const status = await page.evaluate(
    async ([p, d]) => {
      const res = await fetch(p as string, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(d),
      });
      return res.status;
    },
    [path, data] as const,
  );
  expect(status, `播种 ${path} 失败`).toBeLessThan(400);
}

test("数据看板：拆分出的四组统计均渲染", async ({ page }) => {
  await login(page);

  // 播种一条项目与一条待办，让统计走「有数据」分支而非空态
  await seed(page, "/api/projects", {
    name: "看板回归项目",
    status: "进行中",
    color: "#00C776",
    url: "",
  });
  await seed(page, "/api/todos", {
    title: "看板回归待办",
    priority: "high",
    dueDate: "2026-12-31",
  });

  // 数据在 SSR 时注入 Provider，播种后需重新加载才能进入首屏数据
  await page.reload();
  await page.getByRole("button", { name: /数据看板/ }).click();

  // computeServiceHealth / computeTodoMetrics / computeProjectMetrics 的渲染出口
  await expect(page.getByText("基础设施与服务可用性")).toBeVisible();
  await expect(page.getByText("临近截止与高优先待办预警")).toBeVisible();
  await expect(page.getByText("项目全生命周期阶段分布")).toBeVisible();

  // computeTodoMetrics 的产物：播种的待办应出现在预警清单里
  await expect(page.getByText("看板回归待办").first()).toBeVisible();
});

test("项目视图：卡片看板与甘特图视界可切换", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: /项目管理/ }).click();

  // 卡片看板（拆分后仍由 projects-view 直接渲染）
  await expect(page.getByRole("button", { name: /项目卡片/ })).toBeVisible();

  // 甘特图视界（现由 project-gantt-view.tsx 渲染）
  await page.getByRole("button", { name: /甘特图/ }).first().click();
  await expect(page.getByText(/项目 \/ 里程碑阶段/)).toBeVisible();

  // 三种尺度的切换按钮（use-gantt 的 handleScaleChange）
  await expect(page.getByRole("button", { name: /日 \(21天\)/ })).toBeVisible();
  await page.getByRole("button", { name: /月 \(年度推进\)/ }).click();
  await expect(page.getByRole("button", { name: /月 \(年度推进\)/ })).toBeVisible();

  // 切回卡片看板
  await page.getByRole("button", { name: /项目卡片/ }).click();
  await expect(page.getByRole("button", { name: /项目卡片/ })).toBeVisible();
});

test("日历视图：AI 排程弹窗（use-ai-schedule + ai-schedule-modal）", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: /日历日程/ }).click();

  await page.getByRole("button", { name: /AI 智能排程/ }).click();

  // 弹窗（拆分后为 ai-schedule-modal.tsx）
  await expect(page.getByText("AI Copilot 智能排程建议")).toBeVisible();
  // 内置规则引擎会返回任务，等待生成完成
  await expect(page.getByText(/规划任务列表/)).toBeVisible({ timeout: 20_000 });
  // 底部操作区
  await expect(page.getByRole("button", { name: /一键采纳并写入日历/ })).toBeVisible();
  // 关闭
  await page.getByRole("button", { name: "取消" }).click();
  await expect(page.getByText("AI Copilot 智能排程建议")).toBeHidden();
});

test("侧边栏：时钟/天气/表盘小组件（clock-weather-widget）", async ({ page }) => {
  await login(page);

  // 拆分后小组件自带状态；三个 Tab 均需可切换
  const clockTab = page.getByRole("button", { name: "时钟" });
  const weatherTab = page.getByRole("button", { name: "天气" });
  const analogTab = page.getByRole("button", { name: "指针" });

  await expect(clockTab).toBeVisible();
  await weatherTab.click();
  await analogTab.click();
  // 表盘渲染秒针后回到时钟
  await clockTab.click();
  await expect(clockTab).toBeVisible();
});

test("消息通知：活动卡片筛选与详情（recent-activities-* 拆分）", async ({ page }) => {
  await login(page);

  // 先写入一条通知，保证列表非空
  await seed(page, "/api/notifications", {
    title: "拆分回归验证",
    content: "活动卡片渲染",
    source: "api",
  });

  await page.getByRole("button", { name: /消息通知/ }).click();

  // 头部（recent-activities-header.tsx）：条数应计入刚写入的那条
  await expect(page.getByRole("heading", { name: /消息通知与活动动态/ })).toBeVisible();

  // 筛选栏（recent-activities-filter-bar.tsx）：时间范围预设来自 TIME_RANGE_PRESETS
  for (const label of ["全部", "今天", "近3天", "近7天", "自定义"]) {
    await expect(page.getByRole("button", { name: label, exact: true }).first()).toBeVisible();
  }

  // 筛选交互可用：切到「近7天」再切回「全部」
  await page.getByRole("button", { name: "近7天", exact: true }).first().click();
  await page.getByRole("button", { name: "全部", exact: true }).first().click();

  // 列表（recent-activities-table.tsx）最终渲染出刚写入的条目
  await expect(page.getByText("拆分回归验证").first()).toBeVisible({ timeout: 10_000 });
});
