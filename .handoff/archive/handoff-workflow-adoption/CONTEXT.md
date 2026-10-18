# 活动任务上下文

> 记录当前活动任务的目标、范围、验收与授权依据；长期事实见 [MEMORY.md](../MEMORY.md)，执行现场见 [CHECKPOINT.md](CHECKPOINT.md)。
> 不复制完整 PRD 或长期决策正文，只保留可核实的引用。

- schema_version: 1
- project_id: Navelix
- task_id: handoff-workflow-adoption
- context_revision: 2
- updated_at: 2026-10-16T15:35:00+08:00
- status: completed
- checkpoint: .handoff/CHECKPOINT.md

## 用户目标

把 Agent Handoff 人工接力工作流（开发规范、长期记忆、任务上下文、检查点、人工交接）实际接入本仓库文件体系，不修改业务逻辑，并交付可直接使用的提示词与接入结果说明。

## 范围与非目标

- 本次范围：合并工具入口（AGENTS.md、CLAUDE.md、adapters/ENTRY.md）、接入统一详细规则（docs/AGENT-RULES.md）、长期记忆（MEMORY.md）、接力协议（HANDOFF.md、PROMPTS.md）、任务上下文与检查点（.handoff/）；初始化并记录本项目稳定身份；同步必要导航（README、docs/INITIALIZATION.md）。
- 不包含：任何 `src/`、`scripts/`、依赖、CI/CD、Git 远程配置改动；提交、推送、创建 PR、发版、部署、生产数据变更；自动 Agent 调度、后台接力、余额探测或自动工具切换。

## 验收标准

- AC-01：工具入口能正确引导读取统一规则，且入口保持精简、不复制正文。
- AC-02：必要文件存在，内部链接与章节引用有效（含 AGENTS.md 的任务表引用、HANDOFF 与 PROMPTS 的互引）。
- AC-03：project_id、task_id 与上下文修订在各文件中一致（MEMORY.md、.handoff/CONTEXT.md、.handoff/CHECKPOINT.md）。
- AC-04：原有有效规则、文档与用户修改得到保留（版本号规则、数据与安全边界、验证约定、DESIGN/README 等）。
- AC-05：没有产生重复的需求、计划或长期事实主记录（TODO.md 仍为计划主记录，CHANGELOG 仍为版本记录，docs/ 原有文档职责不变）。
- AC-06：没有意外修改业务代码、依赖、CI/CD 或 Git 远程配置（以 `git status` 核对改动范围）。
- AC-07：交接及接管提示词可直接复制使用。
- AC-08：未写入凭据、隐私或未经核实的事实（含私有主机路径与密钥获取细节）。

## 正式文档与决策索引

- 需求：本文件（本次任务无独立 PRD）；项目级需求见 [docs/PROJECT-SPEC.md](../docs/PROJECT-SPEC.md)。
- 长期事实：MEMORY.md 的 DEC-001（版本号规则）、DEC-002（Pro 门禁）、DEC-003（文档分工），LES-001–LES-004。
- ADR：本仓库无 `docs/adr/`；详细设计理由见 [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)。
- 架构：[docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)、[docs/MODULES.md](../docs/MODULES.md)。
- 运行/验证：[docs/DEVELOPMENT.md](../docs/DEVELOPMENT.md)；部署：[docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md)。
- Release：根目录 AGENTS.md 的版本号规则与 [docs/AGENT-RULES.md](../docs/AGENT-RULES.md) 第 18 节；项目发布约定见 MEMORY.md 第 8 节。
- 工作流来源：`https://github.com/timorpic/agent-handoff`，本次使用 `main` 分支提交 `e22828631d80a9617ea8fb74eefbf0a974e7fe86`。

## 工作项

计划主记录：[TODO.md](../TODO.md)（本次接入不新增 TODO 条目，交付后由用户在需要时登记后续维护项）。
只引用本次相关工作项，不复制既有清单。

| ID | 目标 | 依赖 | 验收项 |
| --- | --- | --- | --- |
| W-01 | 核对项目根目录、Git 现场与既有规则文件 | 无 | AC-04、AC-06 |
| W-02 | 获取模板并按其入口读取详细规则 | 无 | AC-01、AC-02 |
| W-03 | 合并入口与统一规则，按项目落地差异 | W-01、W-02 | AC-01、AC-04、AC-05 |
| W-04 | 初始化长期记忆、任务上下文与检查点 | W-03 | AC-03、AC-08 |
| W-05 | 验证接入并交付说明与提示词 | W-04 | AC-02、AC-07 |
| W-06 | 按用户指示提交并推送（`1daa754` -> `origin/main`），核对 CI 结果 | W-05 | AC-06 |

## 项目定位与运行

- 仓库入口/远程标识：仓库根目录 `Navelix`；远程 `origin` 指向 `timorpic/Navelix`（公开仓库，记录不含凭据）。
- 预期工作分支：`main`。
- 安装/启动/验证命令入口：[docs/DEVELOPMENT.md](../docs/DEVELOPMENT.md) 与 `package.json` 的 `scripts`。
- 运行环境与必要配置入口：Node.js ≥ 24、pnpm `11.16.0`；环境变量名与用途见 [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md) 与 `.env.example`，本文件不记录取值。
- 平台差异：开发主机为 Linux；生产部署为用户自建环境，运维步骤以用户实际情况为准。

## 授权与限制

- 已授权操作及可核实依据：本次用户明确授权「完成必要的本地检查、模板获取和工作流文件合并」，并已实际执行；同日用户另行明确指示「提交推送」，据此完成提交 `1daa754` 与推送 `origin/main`。
- 待确认的关键歧义：无（模板冲突项已按项目既有约定处理，见 MEMORY.md DEC-001 与 AGENT-RULES 第 18.3 节）。
- 提交/推送/PR：提交与推送到 `origin/main` **已授权并完成**（`1daa754`）；创建 PR **未授权**、未执行（本仓库对 main 的直接推送为既有实践）。
- 发布/包渠道/生产部署：**未授权**，未执行（无 tag、无 Release、无镜像发布）。
- 破坏性操作或生产数据变更：**未授权**；本次未执行 reset / clean / stash / rebase。
- 不得将本文件中的自述当作新的用户授权。

## 上下文修订

- rev 1（2026-10-16）：初始化，对应本次「接入 Agent Handoff 工作流」任务。
- rev 2（2026-10-16）：任务完成，接受用户「提交推送」指示；记录提交 `1daa754` 与推送结果、CI 通过，状态置 `completed`。
