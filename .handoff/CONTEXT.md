# 活动任务上下文

- schema_version: 1
- project_id: Navelix
- task_id: weak-code-remediation-20261019
- context_revision: 1
- updated_at: 2026-10-19T21:36:00+08:00
- status: completed

## 已授权目标

用户对 Navelix 完成弱代码评审后，明确指示「按方案先执行修复，然后推送发 Release」。执行范围以 `/tmp/plan.md`（509 行修复方案）的 P0/P1/P2/P3 项为准：项目状态规范键、实体写接口接入工作区 revision、AI 删除确认状态机、全局搜索 T0、工作区索引、项目拆解打分、请求体上限与批量小修，随后提交、推送并发版 v2.10.22。

用户已明确**本项目不接入 TypeSafe/Jev**，所有相关提案不得再提出。

## 范围与非目标

- 本轮交付：代码修复 + 测试 + 文档 + `v2.10.22` 发版。
- 明确不做：P2-6 巨型组件拆分、v22 数据迁移（方案阶段 B）。这两项留待后续独立排期。
- 不直接部署生产、不修改生产数据；镜像构建在 GitHub Actions 完成。

## 验收标准

- `pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage && pnpm build && pnpm test:e2e` 全部通过。
- 覆盖率不低于门槛（行 60% / 函数 55%）；本轮实测行 89.21 / 分支 82.96 / 函数 81.61。
- main 保护下的 PR 走完两个必需检查后合并；`v2.10.22` Tag、Release 与镜像稳定标签均完成并回读。

## 关键约束

- main 受保护：必须经 PR + `Lint, Test & Build` 与 `Playwright E2E (Core UI Flow)` 两个必需检查，strict，审批人数 0。
- 提交信息中文、`<type>(<scope>): 说明`，不加任何工具署名或 Co-Authored-By。
- 仓库为 PUBLIC：推送前扫描工作区，确认无密钥、真实凭据或隐私数据。
- 测试必须经 `scripts/run-isolated.mjs` 使用一次性 `NAVELIX_DATA_DIR`；E2E 使用独立 `E2E_DATA_DIR`。
- 长期约定见 MEMORY.md；更早会话曾因打印 API key 字节被权限分类器拒绝，此后只做存在性确认。

## 当前工作项

已完成。PR #23 合并到 main，Tag `v2.10.22` 与正式 Release 已发布，main CI 与镜像流水线全部成功，六个稳定标签 digest 一致。

## 检查点位置

`.handoff/CHECKPOINT.md`（本任务），上一任务已归档至 `.handoff/archive/release-launch-hardening-20261018/`。
