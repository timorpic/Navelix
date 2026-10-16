# 初始化与使用

> 本文件说明本仓库已接入的 Agent Handoff 工作流文件及其职责。
> 来源：`https://github.com/timorpic/agent-handoff`（`main`，提交 `e22828631d80a9617ea8fb74eefbf0a974e7fe86`）。
> 接入日期：2026-10-16；接入时的任务现场见 [.handoff/CHECKPOINT.md](../.handoff/CHECKPOINT.md)。

## 工作流文件树

以下只列出本工作流涉及的文件；Navelix 原有的 `docs/` 文档（PROJECT-SPEC、ARCHITECTURE、MODULES、DEVELOPMENT、DEPLOYMENT、REGISTRY、LOGGING 等）与 `wiki/` 保持原职责，导航见 [README](../README.md)。

~~~text
项目根目录/
├── AGENTS.md                  # 精简启动入口、任务读取路由与必守边界
├── CLAUDE.md                  # Claude Code 工具入口，引用统一规则
├── README.md                  # 项目入口；文档中心含工作流导航
├── MEMORY.md                  # 长期事实、决策与经验（随仓库分发）
├── DESIGN.md                  # 视觉与交互规范（项目原有）
├── CHANGELOG.md               # 版本变更与升级说明（项目原有）
├── TODO.md                    # 任务计划与依赖（项目原有）
├── HANDOFF.md                 # P0+P1 人工接力协议
├── PROMPTS.md                 # 初始化、交接、接管与恢复提示词
├── .handoff/
│   ├── CONTEXT.md             # 活动任务目标与验收入口
│   ├── CHECKPOINT.md          # 执行现场、验证与下一步
│   └── previous/              # 最近一次改动前的文件备份（恢复用）
├── adapters/
│   └── ENTRY.md               # 其他工具可显式使用的统一入口
└── docs/
    ├── INITIALIZATION.md      # 本文件：工作流文件职责与阅读维护路径
    └── AGENT-RULES.md         # 开发、验证、安全、图标、Release、记忆与接力详细规则
~~~

组件指南、页面结构、组件注册和 ADR 文档按需建立，
见下文“按需增加的文档”；不预先加入空目录或虚构项目内容。

## 文件职责

| 文件 | 主记录内容 |
| --- | --- |
| README.md | 项目简介、技术栈摘要和快速开始 |
| AGENTS.md | 精简启动入口、必守边界及章节读取路由 |
| docs/AGENT-RULES.md | 开发、质量、安全、图标、Release、Hindsight 与协作详细规则 |
| CLAUDE.md / adapters/ENTRY.md | 工具入口，引用统一规则 |
| MEMORY.md | 当前有效的长期知识、决策索引及共享同步索引 |
| DESIGN.md | 有 UI 的项目采用的视觉与交互规范 |
| CHANGELOG.md | 面向使用者的版本变更和升级说明 |
| TODO.md / 既有 Issue 系统 | 任务计划、依赖及计划状态 |
| docs/PROJECT-SPEC.md | 产品目标、范围、需求与验收 |
| docs/ARCHITECTURE.md | 当前系统架构、模块职责及数据流 |
| docs/DEVELOPMENT.md | 开发环境、验证及贡献流程 |
| docs/DEPLOYMENT.md | 构建、部署、发布验证与回滚 |
| HANDOFF.md | P0+P1 人工接力协议 |
| .handoff/CONTEXT.md | 活动任务目标及正式文档入口 |
| .handoff/CHECKPOINT.md | 执行现场、验证结果和最近下一步 |
| PROMPTS.md | 初始化、交接、接管与恢复提示 |

本仓库已于 2026-10-16 完成初始化：`project_id = Navelix`，长期事实写入 [MEMORY.md](../MEMORY.md)，
活动任务写入 [.handoff/CONTEXT.md](../.handoff/CONTEXT.md) 与 [.handoff/CHECKPOINT.md](../.handoff/CHECKPOINT.md)。
规则中的示例不代表本项目实际事实，冲突时以本仓库源码、配置与正式文档为准。

## 入口与详细规则

AGENTS.md 是精简启动入口；CLAUDE.md 和 adapters/ENTRY.md 引导工具读取同一入口。
详细工作规则统一保留在 docs/AGENT-RULES.md，章节编号用于稳定引用。
先读取入口规定的基础章节，再按任务补读记忆、图标、发版或接力章节。
已有同一会话内已读且未变化的规则无需重复加载。

入口引用只是读取指令，不会自动把被引用文件全文注入上下文；
执行工具须实际读取所需章节。工具输出被截断时应补读，不能默认为已读完。
入口应持续保持精简，避免添加长篇正文；不通过修改工具全局配置提高限制来代替精简。

## 初始化记录

本次接入（2026-10-16）已完成的初始化动作，供后续核对：

1. 目标项目根目录确认为本仓库，稳定 `project_id` 取 **Navelix**（仓库名，非模板目录名或下载包名）。
2. 模板文件与 `.handoff/` 逐项与现有同名文件核对后合并，未直接覆盖；改动前原文备份在 `.handoff/previous/`。
3. README 只补充工作流导航行；`docs/PROJECT-SPEC.md`、`ARCHITECTURE.md`、`DEVELOPMENT.md`、`DEPLOYMENT.md` 等原有文档保持原职责，未被模板文件替换。
4. MEMORY 只登记本仓库已核实、长期有效的事实与决策，详细依据引用正式文档。
5. 本次任务上下文与首份检查点已建立；无新任务时保持 `draft`。
6. Claude Code 使用 CLAUDE.md，其他工具使用根目录 AGENTS.md，必要时显式使用 adapters/ENTRY.md。
   工具输出被截断时应补读，不能默认为已读完。
7. Hindsight/OpenMemory 连接已核对可用（Bank: OpenMemory）；本项目尚无已同步条目，
   连接地址与凭据不写入本仓库，操作规则见 [AGENT-RULES](AGENT-RULES.md) 第 17 节。

仍需按项目实际情况确认的项：部署平台细节以 [DEPLOYMENT](DEPLOYMENT.md) 与用户实际环境为准；
2025 年度发版历史未在本地 git 历史内，MEMORY 第 8 节已标注待确认。

## 避免重复维护

已有 PRD、架构文档、任务系统或部署手册时沿用原记录，模板文件可只提供入口。
TODO 维护计划，CHECKPOINT 维护实际现场；完成状态必须有验收证据。
MEMORY 只摘录长期约束并链接主记录，不复制完整架构、设计或需求。
CONTEXT 引用需求条款和当前任务，不复制长期知识。
Hindsight 是长期摘要的检索副本，不能替代以上主记录。

## 阅读与维护路径

1. 开始或接手任务：先读适用 AGENTS.md，按入口读取 docs/AGENT-RULES.md 对应章节，再核对 MEMORY 的现行事实、CONTEXT 和最新 CHECKPOINT。
2. 依据 CONTEXT 的精确引用读取相关需求、架构、开发或部署文档，避免遍历全部文档。
3. 只有需要核对决定理由、旧问题或恢复依据时，读取相关 ADR、经验历史或归档检查点。
4. 文件树与职责表只做导航；新增、移动、删除文档时同步更新，不记录进度和决定。
5. MEMORY 通过条目 ID 链接详细依据；历史变多时按 docs/AGENT-RULES.md 第 17.7 节整理，关键约束不能因时间较旧丢失。
6. 正常结束或交接填写检查点结果摘要，区分已完成、未完成、未验证和阻塞条件。

本套模板是可由不同工具执行的文件协议。入口读取、记忆整理和结果记录须由当前工具实际执行；
文件存在本身不能保证自动注入上下文、强制互斥或结果校验。
初始化后先用一个小任务验证实际读取和人工切换，再用于复杂工作。

## 按需增加的文档

- docs/COMPONENT-GUIDELINES.md：有复用组件体系时记录组件、样式、依赖与无障碍要求。
- docs/PAGE-STRUCTURE.md：页面较多且路由/页面职责需要专门说明时建立。
- docs/REGISTRY.md：确实存在组件注册、构建和分发机制时建立。
- docs/adr/：重要决策需要记录详细背景、备选方案和后果时建立。
- docs/knowledge/：经验说明或历史过长时按需建立，MEMORY 保留稳定条目 ID 和入口。

这些文件不要求每个项目创建；通用详细要求维护在 docs/AGENT-RULES.md，项目文档只写实际适用的约定。
部署平台、技术栈、数据库、版本基准年和发布渠道由当前项目确定。

## 人工接力

在可恢复的小步骤及关键验证后更新检查点。
切换前停止旧工具写入；接手者核对项目、上下文版本、分支、HEAD、
未提交与未跟踪文件，以及外部操作实际状态。
突然退出按 HANDOFF.md 恢复，不将未知结果写成成功。
新任务开始前将旧上下文与检查点成对归档。
不配置自动 Agent 调度、余额探测或自动工具切换。