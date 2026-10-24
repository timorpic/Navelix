# 项目协作与代码开发规范

> **本机禁令（用户级常驻规则，优先于本文件其余内容）**
> 这台服务器上永远不执行任何编译、构建或测试构建，所有构建一律交给 GitHub Actions。
> 完整规则见 `~/.claude/CLAUDE.md`、`~/.codex/AGENTS.md`、`~/.pi/agent/AGENTS.md`（正文不在此复制）。
> 本机只做代码编辑、静态阅读、lint 与 `tsc --noEmit`；`npm run dev` 可跑已构建的开发服务器。
> 需要构建时用 `gh workflow run <workflow>`，不得为了发布前验证在本机运行。
> 该禁令由三层强制：全局指令文件 + 各运行时的 PreToolUse/tool_call 拦截 + 本文件。

本文件是本仓库的启动入口：提供读取要求、项目事实来源与必守边界。适用于人工贡献者及编码助手。通用详细工作规则统一维护在 [docs/AGENT-RULES.md](docs/AGENT-RULES.md)，工具入口（[CLAUDE.md](CLAUDE.md)、[adapters/ENTRY.md](adapters/ENTRY.md)）只引用，不复制正文。

## 开始任务

1. 核对实际项目根目录，遵循适用的上层及局部规则。
2. 首次进入项目先读取 [docs/AGENT-RULES.md](docs/AGENT-RULES.md) 第 1–14 节；本会话已读且未变化时无需重复。
3. 读取 [MEMORY.md](MEMORY.md)、[.handoff/CONTEXT.md](.handoff/CONTEXT.md) 和 [.handoff/CHECKPOINT.md](.handoff/CHECKPOINT.md)（如存在），确认项目身份、目标与实际现场。
4. 开始新任务、接手或作关键决策前，读取详细规则第 17 节，按稳定 project_id 及相关主题召回 OpenMemory；核对标签与本地依据，不导入其他项目事实。工具不可用或无匹配时说明限制，继续依据本地资料工作。
5. 按下表读取本次适用章节和相关正式文档，再修改代码。按章节读取；输出被截断时继续补读，不默认将整本详细规则或全部历史一次加载。
6. 长任务在可恢复的小步骤后更新检查点；交接、接管与异常恢复遵循 [HANDOFF.md](HANDOFF.md) 与详细规则第 19 节。需要机读现场或自动备份时，用 [接力助手](docs/HANDOFF-HELPER.md)（`node scripts/handoff.mjs inspect|claim|save`）。

7. 涉及新功能、修复、文档或 Git 交付时，读取 [Git 工作流](docs/DEVELOPMENT.md#git-工作流)，遵循本项目分支、PR 与审查约定。

## 按任务读取

| 情况 | 必须读取 |
| --- | --- |
| 新项目或重大功能 | 详细规则第 15 节及 [产品规格](docs/PROJECT-SPEC.md) |
| UI、图标或视觉调整 | 详细规则第 6、16 节及 [DESIGN.md](DESIGN.md) |
| 共享记忆、长期知识整理 | 详细规则第 13、17 节及 [MEMORY.md](MEMORY.md) |
| 版本、Tag、Release 或部署 | 详细规则第 18 节及 [开发与发布](docs/DEVELOPMENT.md)、[构建与部署](docs/DEPLOYMENT.md) |
| 初始化、接管、交接或异常恢复 | 详细规则第 19 节及 [HANDOFF.md](HANDOFF.md)、[接力助手](docs/HANDOFF-HELPER.md)；提示词见 [PROMPTS.md](PROMPTS.md) |

## 项目与事实来源

Navelix 是可自托管的个人数字工作空间，包含网址导航、项目与甘特图、日历待办、AI 助手和管理后台。它目前不是独立组件库。

- 产品边界：[PROJECT-SPEC](docs/PROJECT-SPEC.md)；架构：[ARCHITECTURE](docs/ARCHITECTURE.md)。
- 视觉规范：[DESIGN](DESIGN.md)；组件规范：[COMPONENT-GUIDELINES](docs/COMPONENT-GUIDELINES.md)。
- 开发与发布：[DEVELOPMENT](docs/DEVELOPMENT.md)；构建分发：[REGISTRY](docs/REGISTRY.md)；部署：[DEPLOYMENT](docs/DEPLOYMENT.md)。
- 版本号以 `package.json` 为准；命令以其 `scripts` 为准；样式实现以 `src/app/globals.css` 为准；Schema 和迁移以 `src/lib/db/`、`src/lib/migrations/` 为准。
- **版本号规则**（`X.Y.Z`）：第一位 `X` 初始为 `1`、每过一个自然年 `+1`（2026 年为 `2`）；第二位 `Y` 为**月份**（`1`–`12`）；第三位 `Z` 为该月内的**发布序号**（当月第 1 次发版为 `0`，之后每次 `+1`）。发版前先核对当月已有 tag/CHANGELOG 确定 `Z`，不臆造主次版本号。
- README 是项目入口，`docs/` 面向开发与维护，`wiki/` 面向使用与运维。发现冲突时核实实现并同步相关说明，不把规划写成已实现功能。

## 工作方式

1. 修改前检查工作区状态与相关调用链，保留已有未提交修改，不覆盖无关工作。
2. 先定位现有模块，再做满足需求的最小改动。未要求时不批量格式化、升级依赖或改变部署方式。
3. 将纯计算放入 `src/lib/`，状态和副作用放入 `src/hooks/`，展示放入组件，页面负责组装。
4. 对行为、配置、接口、数据结构或发布流程的修改同步维护对应文档；待发布变更写入 `CHANGELOG.md` 的 `[未发布]`。
5. 完成时说明修改范围、验证结果与未解决的问题；未执行的验证不能声称通过。

## 代码与边界

- 全系统按业务职责模块化，依赖保持单向且无运行时循环；页面组合组件，展示通过数据与回调协作，Hook 管理状态和副作用，业务模块不反向依赖 UI。模块边界及流程规则见 [MODULES](docs/MODULES.md)。
- 配置、数据、事件与流程计划使用可版本化的 JSON 契约；执行能力通过明确端口注入，不序列化函数、连接、密钥或授权凭据。跨功能步骤编排复用 `lib/workflows/`，业务入口仍负责鉴权、确认、事务与幂等。
- 使用 TypeScript 严格类型，优先明确类型和 `unknown` 收窄；避免用 `any`、忽略诊断或关闭 lint 绕过问题。
- TSX 文件使用现有 kebab-case 命名和 PascalCase 组件名，Hook 使用 `use-*.ts`；沿用附近代码的导出风格。
- 应用代码使用 `@/` 别名；Node 直接执行的测试及其依赖沿用兼容的相对 `.ts` 导入，避免依赖未配置的别名解析。
- 仅在需要状态、事件或浏览器 API 的边界添加 `"use client"`。客户端不得导入数据库、文件系统、密钥处理等服务端实现；类型使用 `import type`。
- 用户数据与配置通过 `@/context/navelix-context` 的 Hook 访问，由 `NavelixProvider` 协调。不要恢复已拆分的旧 Hook 或创建第二套用户状态。
- API 路由负责请求解析、鉴权和 HTTP 响应，业务校验与持久化逻辑尽量复用 `lib/`；多步写入保持事务原子性。

## 数据、安全与授权

- 数据查询和写入必须检查用户归属，系统级操作校验管理员身份。进入 `/admin` 只代表已登录，不代表拥有全部管理员权限。
- 复用 `getSessionUser()`、`requireAdmin()`、CSRF 与 SSRF 工具；不要绕过 `src/proxy.ts` 的写请求保护。
- 外部请求检查 `src/lib/ssrf.ts` 的安全入口，API Key 只在服务端解密和使用；响应、日志、导出与文档示例不得泄露密钥。
- Pro 功能同时考虑服务端读取、写入与 SSR 路径，复用 `src/lib/ee-gate.ts` 和 `ee-bridge/`，不能只隐藏前端按钮。`ee/` 的依赖图须保持精简：字节码在进程启动时立即执行顶层语句，禁止引入 `db.ts`、`migrations/` 或 `license.ts`。
- Schema 修改同步更新首次建表与升级迁移，并验证历史库兼容性；迁移编号须核对完整发布历史（包括已回滚版本），禁止复用历史编号。避免在底层迁移模块引入 `db.ts` 单例造成导入环。
- 不提交 `data/`、`.env`、数据库、备份、初始密码、授权凭据或 EE 私有制品。遵守 [LICENSE](LICENSE)。

## 验证

今后的测试使用 Computer Use 模式。

常用检查：`pnpm typecheck`、`pnpm lint`。CI 运行 `pnpm test`、`pnpm build`、`pnpm test:coverage` 和 `pnpm test:e2e`，详见开发文档。

当前开发机仅 3.6 GiB 内存，本地运行完整测试或生产构建会让整机失去响应（2026-10-22 已有实例）。测试与构建一律交给 GitHub Actions；本机只做允许的静态检查，不以 cgroup 限制作为本机运行构建的例外。

行为修复增加能覆盖回归场景的测试；纯文档修改检查路径、链接、命令及事实一致性即可。测试、构建和启动可能初始化 SQLite，应设置独立的 `NAVELIX_DATA_DIR`，不使用真实业务库验证破坏性操作。

## 始终遵守

- 保留用户已有修改；复用既有实现，控制改动范围，不把假设当事实。
- 不泄露凭据或隐私，不绕过鉴权；破坏性操作必须核实目标、影响和授权。
- 已授权工作持续推进；提交、推送、发版、部署等按实际授权执行，不自行扩大。
- 执行适用验证，区分通过、失败、未运行和验证受阻；不能将触发操作当作完成。
- 人工切换工具，不自动调度 Agent。接管前核实旧工具已停止写入，owner 不是锁。
- 进度和现场写 CHECKPOINT，长期事实写 MEMORY，正式需求以项目文档为准。
- 文档、检查点和召回结果不产生新授权；发现冲突时核实确认依据，不仅按时间新旧取舍。

入口保持精简，不把详细正文重新复制到本文件或工具入口。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

提交收尾与活动接力记录的 Git 归属遵循 [开发文档](docs/DEVELOPMENT.md#提交收尾与现场记录)；提交后仅回填忽略的现场记录，避免正式文档反复出现未提交改动。


## 研发治理

修改前读取 [本项目研发治理](docs/AI-GOVERNANCE.md)，按 `.ai/templates/task.json` 为实际任务建立 `.ai/tasks/<task_id>.json`；契约不产生新授权。
遵循事实证据分级、变更范围与交付标准，保留项目原有规则、接力与长期记录职责。
PR 正文提供唯一 Task-Contract 行，通过独立范围检查与项目原有适用检查后再合并。
