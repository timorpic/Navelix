# 活动任务上下文

- schema_version: 1
- project_id: Navelix
- task_id: cleanup-invalid-refs-20261020
- context_revision: 2
- updated_at: 2026-10-20T16:12:00+08:00
- release_version: 2.10.25
- status: completed

## 用户目标与授权

用户要求「无效引用、代码、注释清理」。经确认范围为**全仓库代码 + 文档**（`src/`、`e2e/`、`scripts/`、`extension/`、`public/`、`messages/`、`docs/`、`wiki/`、根目录 Markdown、配置、CI 与 Dockerfile），归档目录 `.handoff/previous`、`.handoff/archive` 不动；交付方式为**分批提交到分支**，每批过 typecheck / lint / test。

授权演进（按时间顺序）：本地分支提交 → 推送并开 PR → 合并、清理分支、发 release。所有对外操作均已获用户明确授权后执行。

## 范围与判定标准

只清理「确定无读取方 / 确定不可达 / 与实现明确不符」的内容。以下一律保留，不作为清理对象：

- `ee/` 私有商业驱动（gitignored 的 bytenode 字节码），仅作为运行时可达性证据来源；
- 防御性配置（`.dockerignore` 的 `.pnpm-store-tmp`、`.workbuddy`、`.gemini`）；
- 模块内自用的 `export`（如 `validateUrl`、`matchesFilter`）、公共类型与对外契约；
- CHANGELOG 历史条目（记录过去版本的事实，不复写）；
- 已被删除但仍有历史意义的归档文档。

先例：下线 UI 开关时从 `buildWidgetToggles` / `defaultConfig` 移除，但保留 DB 列与 `SystemConfig` 的 `@deprecated` 字段（依据 commit `b65b7ad` 移除 `todayActivity` 的做法）。

## 入口与现场

任务已完成并发布 v2.10.25，发布提交（记录基线）为 `334bbbe`。读取时的 HEAD 与工作区以 `git rev-parse HEAD`、`git status --short --branch` 实测为准，不要直接用基线值。

实现、验证与发布证据见 CHECKPOINT.md。

验证命令：`pnpm typecheck`、`pnpm lint`、`pnpm test`（必须走 `pnpm test`，裸 `node --test` 会因共享临时库报 `database is locked`）。

## 三项产品决策（已由用户决定并实施）

1. 「我的信息」弹窗不可达 → **整个删除**，连带 `AccountSocialLinks`；社交配置字段保留，后台仍可编辑（`69b5815`）。
2. `recentVisitsEnabled` 开关空转 → **修复**，遵循其它工作区组件的「缺省即开启」约定（`6dff774`），并补 e2e 覆盖。
3. `notifications:new` 无发送方 → **整条删除**（事件类型 + SSE 分支 + Provider 转接 + 两处派发），通知行为不变（`e8e8469`）。

三项均已在 v2.10.25 交付。

## 遗留

- `e2e/sun-panel-migration.spec.ts` 直接改写仓库内受版本控制的截图，本地跑会污染工作区，建议后续单独处理。
- `wiki/` 本次改动 7 个文件；线上 wiki 停在 v2.9.5，逐文件比对后有 8 个文件与仓库不同，尚未同步到线上 GitHub wiki，需手工同步。
