# 活动任务上下文

- schema_version: 1
- project_id: Navelix
- task_id: handoff-helper-adoption-20261020
- context_revision: 1
- updated_at: 2026-10-20T10:14:57.041Z
- status: active
- from_agent: Claude Code（会话 eb4f60ef）

## 用户目标与授权

用户要求参照 `https://github.com/timorpic/agent-handoff`，检查并补齐本项目已有的任务接力能力。授权范围：读取规则/记忆/现场、下载模板到临时目录对照、在现有实现上做最小必要改动、执行适用验证并更新相关记录。

明确边界：不整套覆盖、不重新初始化；保留 README、业务代码、项目身份、历史决策、活动任务、验证证据与未提交修改；不导入模板身份、维护历史、测试结果或其他项目信息；不增加自动调度或跨工具并发；不扩大提交、推送、发布授权；**不提交、不推送、不发布**。

## 范围与非目标

在范围内：

1. 新增本地助手 `scripts/handoff.mjs`（inspect / prompt / claim / save），适配本项目记录方言。
2. 新增说明 `docs/HANDOFF-HELPER.md` 与回归测试 `src/lib/__tests__/handoff-helper.test.ts`。
3. 同步 `HANDOFF.md`、`PROMPTS.md`、`AGENTS.md`、`docs/AGENT-RULES.md` 第 19 节、`docs/INITIALIZATION.md`、`README.md`、`MEMORY.md`（DEC-004）。
4. 归档上一任务、修正误名归档目录，并建立本任务现场。

不在范围内：

- 模板的 `skills/`、`docs/MULTI-AGENT.md`、`adapters/scoped/`、客户端软链与身份文件；
- 模板的 `.gitignore` 现场层规则（本项目 `.handoff/` 刻意跟踪）；
- 模板的 `check-docs.sh`（其假设与本项目 wiki/归档链接约定冲突，未导入）；
- Hindsight/OpenMemory 流程变更；
- 任何提交、推送、发布或自动调度。

## 验收标准

- AC-01：`inspect` 能识别同一任务、核对项目身份、列出未提交与未跟踪现场，并在旧检查点缺字段时给出明确错误而非静默通过。
- AC-02：`claim` 在业务修改前按精确 task/revision/handoff-id 认领，要求 `--source-stopped`；缺检查点或损坏时 `--recover` 可用且保留旧记录。
- AC-03：`save` 生成含认领状态、`owner_lease_id`、验证证据与下一步的检查点，备份到 `.handoff/previous/` 并递增 `checkpoint_seq`；不改业务文件、暂存区或历史。
- AC-04：回归测试覆盖只读性、认领门槛、恢复、完成门槛、过期判定、符号链接与敏感文件边界，并随 `pnpm test` 执行。
- AC-05：文档入口单一、无重复事实来源；`pnpm typecheck`、`pnpm lint`、`pnpm test` 通过。

## 入口与现场

- 规则入口：[AGENTS.md](../AGENTS.md) → [docs/AGENT-RULES.md](../docs/AGENT-RULES.md) 第 19 节。
- 协议：[HANDOFF.md](../HANDOFF.md)；助手用法：[docs/HANDOFF-HELPER.md](../docs/HANDOFF-HELPER.md)。
- 验证命令：`pnpm typecheck`、`pnpm lint`、`pnpm test`（必须走 `pnpm test`，隔离数据目录由 `scripts/run-isolated.mjs` 创建）。
- 模板副本仅在 `/tmp/handoff-ref/agent-handoff`（临时目录，不入库、不作为事实来源）。

## 遗留

- 模板 `scripts/check-docs.sh` 未导入；如需文档一致性自检，应另立任务按本项目的 wiki/归档约定重写，而不是直接复制。
