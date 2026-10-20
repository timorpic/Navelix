# 活动任务上下文

- schema_version: 1
- project_id: Navelix
- task_id: cleanup-invalid-refs-20261020
- context_revision: 1
- updated_at: 2026-10-20T12:00:00+08:00
- release_version: 2.10.24
- status: handoff_ready

## 用户目标与授权

用户要求「无效引用、代码、注释清理」。经确认范围为**全仓库代码 + 文档**（`src/`、`e2e/`、`scripts/`、`extension/`、`public/`、`messages/`、`docs/`、`wiki/`、根目录 Markdown、配置、CI 与 Dockerfile），归档目录 `.handoff/previous`、`.handoff/archive` 不动；交付方式为**分批提交到分支**，每批过 typecheck / lint / test。

已授权：本地分支提交。**未授权**：推送、开 PR、合并、发版、部署。

## 范围与判定标准

只清理「确定无读取方 / 确定不可达 / 与实现明确不符」的内容。以下一律保留，不作为清理对象：

- `ee/` 私有商业驱动（gitignored 的 bytenode 字节码），仅作为运行时可达性证据来源；
- 防御性配置（`.dockerignore` 的 `.pnpm-store-tmp`、`.workbuddy`、`.gemini`）；
- 模块内自用的 `export`（如 `validateUrl`、`matchesFilter`）、公共类型与对外契约；
- CHANGELOG 历史条目（记录过去版本的事实，不复写）；
- 已被删除但仍有历史意义的归档文档。

先例：下线 UI 开关时从 `buildWidgetToggles` / `defaultConfig` 移除，但保留 DB 列与 `SystemConfig` 的 `@deprecated` 字段（依据 commit `b65b7ad` 移除 `todayActivity` 的做法）。

## 入口与现场

分支 `chore/cleanup-invalid-refs-20261020`。实现与发现清单见 CHECKPOINT.md；上一任务上下文及检查点已归档至 `archive/cleanup-invalid-refs-20261020/`。

验证命令：`pnpm typecheck`、`pnpm lint`、`pnpm test`（必须走 `pnpm test`，裸 `node --test` 会因共享临时库报 `database is locked`）。

## 待用户决策（不在清理范围）

1. `src/components/sidebar.tsx:53` 的 `showProfileModal` 自 v2.8.1 引入起就没有任何 `setShowProfileModal(true)`，整个「我的信息」Modal 与 `AccountSocialLinks` 不可达 —— 是补入口还是删除？
2. `recentVisitsEnabled` 在后台「快捷访问」开关上可切换，但 `page.tsx:288` 无条件渲染 `<QuickAccess>`，开关空转。
3. `notifications:new` 在 `RealtimeEventType` 与会话钩子中定义了消费端，但生产代码没有任何 `emitUserEvent(..., "notifications:new")`，`navelix-notifications-updated` 也无人监听。

三项都需要产品决定，不是「无效引用」。
