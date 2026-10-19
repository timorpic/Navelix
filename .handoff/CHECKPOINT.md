# 当前检查点

- schema_version: 1
- project_id: Navelix
- task_id: weak-code-remediation-20261019
- context_revision: 1
- checkpoint_seq: 1
- updated_at: 2026-10-19T21:19:00+08:00
- owner: Claude Code
- status: active
- current_step: 全部代码修复与验证完成，准备提交、推送并发版 v2.10.22

## 工作区与记录边界

采集现场：仓库根目录 `/root/Navelix`，分支 `main`，HEAD `7e29ad6fe06f38feb7dfdcb48751be3d2252ccff`。暂存路径：无。未暂存：54 个文件、1354 增 / 502 删，另有多份新建文件（删除确认接口、搜索/项目状态/拆解模块及其测试）。未跟踪见 `git status --short`。

忽略路径（仅记名称）：`.claude/`、`.next/`、`.pnpm-store/`、`coverage/`、`data/`、`ee/`、`next-env.d.ts`、`node_modules/`、`test-results/`、`tsconfig.tsbuildinfo`。

`public/screenshots/sun-panel-import-*.png` 是 E2E 每次运行重写的产物，本轮已 `git checkout` 还原，不带入发布 PR。

## 本轮已完成

代码修复（对应 `/tmp/plan.md`）：

- P0-2 项目状态规范键：新增 `src/lib/project-status.ts`，读写两侧归一化，看板与统计复用 `computeProjectMetrics`。
- P0-1 实体写 revision：新增 `src/lib/workspace-revision.ts`（`readExpectedRevision` / `guardWorkspaceRevision` / `requireWorkspaceRevision` / `withWorkspaceRevision`），接入 projects、todos、rollover 路由；Provider 新增 `mutateWorkspace` 统一注入与 409 处理。
- P1-2 删除确认：`src/lib/ai-tools.ts` 状态机 + 新建 `src/app/api/ai/confirm-delete/route.ts` + 前端确认卡双按钮 + E2E 用例。
- P1-4 索引：`WORKSPACE_INDEXES_SQL` 5 个索引，`ensureSchema` 与 `ensureSchemaPostMigrations` 各执行一次。
- P1-1 搜索 T0：新增 `src/lib/search.ts`（NFKC、2-gram、加权打分、使用频次加成）。
- P1-3 拆解：新增 `src/lib/project-breakdown.ts`（带权关键词打分）。
- P2/P3：告警分类、审计原文保留、`timingSafeEqual`、里程碑一次 DELETE、`readLimitedJson` 体积上限、schema 列对齐、UUID 替换 `Date.now()+Math.random()`。
- i18n：补 13 条接口错误中英文文案，新增 `ai_delete_confirmation_invalid`，删除无引用 key，加静态扫描测试。
- 文档：`wiki/REST-API-开放接口文档.md` 补齐删除确认、revision、级联删除与 409 语义。

验证（均在本次改动后执行）：

- `pnpm typecheck` 通过。
- `pnpm lint` 通过。
- `pnpm test`：645 tests / 175 suites，全部通过，0 失败。
- `pnpm test:coverage`：退出码 0，all files 89.21 / 82.96 / 81.61。
- `pnpm build`：退出码 0，路由表含 `/api/ai/confirm-delete`。
- `pnpm test:e2e`：31 passed。

## 修复过程中发现并解决的两个回归

首次全量 E2E 有 2 个用例超时（`i18n.spec.ts:52`、`personal-schedule.spec.ts:11`），根因同一处：`mutateWorkspace` 对带 body 的写请求也在 URL 上追加 `?expectedRevision=`，而测试用 `response.url().endsWith("/api/todos")` 精确匹配，导致 `waitForResponse` 永不命中。已改为只在无 body 的 DELETE 使用查询参数，带 body 的写请求仍放在 body 里（与 `workspace-revision.ts` 文档约定一致）。修复后单跑两用例 5 passed，全量 31 passed。

## 未完成

- 提交、推送、PR、合并 main。
- Tag `v2.10.22`、Release 发布与镜像工作流核验。

## 外部操作台账

- 已执行 `node scripts/sync-version.mjs 2.10.22`：package.json、Dockerfile、`build-info.ts`、`admin-system.ts` 已改为 2.10.22。
- 已执行 `node scripts/sync-changelog.mjs` 校验：通过。
- 尚未推送、未打 Tag、未创建 Release、未触发镜像构建。
