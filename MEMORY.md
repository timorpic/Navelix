# MEMORY.md

> Navelix 的长期知识记录：只写已核实、对未来开发有持续价值的事实、约束与决策。
> 任务目标与现场分别见 [.handoff/CONTEXT.md](.handoff/CONTEXT.md) 与 [.handoff/CHECKPOINT.md](.handoff/CHECKPOINT.md)；
> 工作规则见 [AGENTS.md](AGENTS.md) 与 [docs/AGENT-RULES.md](docs/AGENT-RULES.md)。
> 每条结论应能追溯到代码、正式文档或已确认决策；未知项明确标注，不凭模板或直觉补全。

## 1. 项目概览

### 项目名称

Navelix（Personal Digital Hub）。

### 项目定位

面向开发者、极客与独立创作者的可自托管个人数字工作空间：把网址导航、项目与甘特图、日历待办、AI 助手和管理后台收进同一应用，本地优先、数据自持。项目为个人工作台，但仓库公开可见（`timorpic/Navelix`）。依据：[PROJECT-SPEC](docs/PROJECT-SPEC.md)。

### 核心目标

降低常用信息与行动清单之间的切换成本；以本地 SQLite 简化部署，避免强制外部数据库。多用户能力不等同于企业级协作平台。

### 阶段说明入口

进度与待办主记录：[TODO.md](TODO.md)；版本历史：[CHANGELOG.md](CHANGELOG.md)。当前无长期路线图文档。

---

## 2. 技术栈

### 前端

Next.js `16.3.8`（App Router）+ React `19.2.8`，Tailwind CSS 4（PostCSS 插件），TypeScript 5 严格模式。界面文案经 `next-intl` 管理，字典在 `messages/zh-CN.json`、`messages/en.json`。依据：`package.json`、[DEVELOPMENT](docs/DEVELOPMENT.md)。

### 后端

同一 Next.js 应用的 Route Handler 与 Node 运行时；Node.js ≥ 24（`engines`），开发与 CI 使用 Node 24。业务逻辑位于 `src/lib/`，状态与副作用位于 `src/hooks/`。

### 数据库

Node 内置 `node:sqlite`（SQLite + WAL），无外部数据库服务。Schema、首次建表与有序升级迁移在 `src/lib/db/`、`src/lib/migrations/`。迁移编号不得复用历史编号（含已回滚版本）。

### 基础设施

- 包管理与构建：pnpm `11.16.0`（`packageManager` 固定）。
- CI：GitHub Actions `ci.yml`（lint / test / coverage / build / 生产 Playwright E2E）可复用；`docker.yml` 在源码质量检查后构建候选镜像，按 digest 冒烟、升级与 UI 验证后才提升正式版本 / latest。手动运行不提升稳定标签。
- 发布：Docker Hub 镜像 `timorpic/navelix` 与 GitHub Releases。
- 生产部署：用户自建（Synology 上手工容器 + Watchtower 自动更新），不经仓库 compose 文件。

### 其他关键技术

- 商业能力经 `ee/` 私有驱动（bytenode 字节码）+ `src/lib/ee-gate.ts`、`ee-bridge/` 门禁；`ee/` 被 gitignore。
- 浏览器扩展在 `extension/`，有独立版本号策略。
- PWA 入口、SSE 实时通知、`.app_secret` 本地加密材料。

---

## 3. 架构

### 总体架构

单体 Next.js 应用 + 本地 SQLite；详细说明见 [ARCHITECTURE](docs/ARCHITECTURE.md) 与 [MODULES](docs/MODULES.md)。仅记录易遗漏约束：

- 依赖单向、无运行时循环；业务模块不反向依赖 UI。
- 客户端不得导入数据库、文件系统或密钥处理等服务端实现。
- 用户数据统一经 `@/context/navelix-context` 的 Hook 访问，由 `NavelixProvider` 协调，不重建第二套状态。

### 核心模块

`src/app/`（页面与 API 路由）、`src/components/`、`src/hooks/`、`src/lib/`（业务与安全入口）、`src/context/`、`src/proxy.ts`（写请求保护）、`src/lib/migrations/`（迁移）。模块职责与流程见 [MODULES](docs/MODULES.md)。

### 数据流

页面组装组件 → Hook 管理状态 → `lib/` 业务模块 → SQLite。写路径经 CSRF/SSRF 与归属校验，多步写入保持事务原子性。

### 外部依赖

OpenAI 兼容 AI 接口、天气、S3/WebDAV 云容灾、外部链接探针（均需用户自行配置，默认关闭或可选）。凭据只在服务端解密使用。

---

## 4. 技术决策

> 只记录重要且长期有效的决策；详细理由引用正式文档，不在此复制全文。

#### DEC-001 版本号采用「年度.月份.当月序号」而非语义化版本（2026-10-15 复核确认）

背景
需要一套与发布时间强对应、能直接从版本号读出年月的编号规则；版本号不表达兼容性。

决定
`X.Y.Z`：`X` 初始为 1、每过一个自然年 `+1`；`Y` 为月份；`Z` 为该自然月内发布序号（当月首次为 `0`，之后递增，不补前导零）。Tag 加 `v` 前缀（`v2.10.19`），`package.json` 不带（`2.10.19`）。

原因
便于按时间定位版本；避免 SemVer 兼容性承诺与实际发布节奏绑定。

影响
破坏性变更必须在 Release Notes 明确标注；发版前须核对远程已有 tag 确定当月序号。通用模板默认「两位序号、自 01 起算」不适用于本项目。

确认依据及证据
根目录 [AGENTS.md](AGENTS.md) 的版本号规则；`package.json`、`CHANGELOG.md`、tag 历史（v2.8.7 → v2.10.19）。

#### DEC-002 商业能力通过私有驱动 + 服务端门禁，而非前端隐藏（已确认实现）

背景
仓库公开分发基础实现（CE），完整 Pro 能力由私有制品与许可控制。

决定
Pro 能力必须同时覆盖服务端读取、写入与 SSR 路径，统一复用 `src/lib/ee-gate.ts` 与 `ee-bridge/`；`ee/` 目录不入库。

原因
仅隐藏前端按钮不构成功能门禁；许可有效性与驱动在场是不同条件。

影响
`ee/` 约束其依赖图：字节码在进程启动时立即执行顶层语句，禁止引入 `db.ts`、`migrations/`、`license.ts`。

确认依据及证据
[PROJECT-SPEC](docs/PROJECT-SPEC.md) 的访问与商业边界；[REGISTRY](docs/REGISTRY.md)；[TODO.md](TODO.md) 的 Pro 路径验收记录。

#### DEC-003 文档体系分工：README 入口、docs 开发维护、wiki 使用运维（已确认）

背景
文档曾分散导致路径与内容重复、Wiki 示例被误当作当前行为。

决定
README 面向使用者与入口；`docs/` 面向开发与维护；仓库 `wiki/` 面向使用与运维。

影响
`wiki/` 有两份副本（仓库内为源头，GitHub Wiki 为渲染版），需手工同步，见 [LES-002](#les-002-wiki-有两份副本需手工同步)。

确认依据及证据
根目录 [AGENTS.md](AGENTS.md)；[README.md](README.md) 文档中心章节。

#### DEC-004 接力现场保留在版本控制，助手只补充机读校验（2026-10-20 确认）

背景
对照上游 `agent-handoff` 模板检查接力能力时，模板默认把 `.handoff/` 当作忽略的运行文件，
而本仓库自接入起就把 `MEMORY.md` 与 `.handoff/` 纳入 Git，作为跨工具交接的真实记录。

决定
继续跟踪 `.handoff/`（含 `archive/` 与 `previous/` 备份），不引入模板的 gitignore 规则；
新增本地助手 `scripts/handoff.mjs`，只做现场指纹、认领状态、备份轮换与证据哈希，
不改模板的目录结构、AI 技能或多 Agent 约定，也不替换 Hindsight/OpenMemory 流程。

原因
跟踪现场让交接证据随 PR 评审并可回滚；忽略后新克隆拿不到历史检查点。
模板的锁文件式假设与“open 认领”只适用于未跟踪场景，直接照搬会与现有记录冲突。

影响
重复内容（IDENTITY、skills、多 Agent 章节）不导入；`docs/INITIALIZATION.md` 保留并扩展文件职责。
助手写入的备份同属版本控制，评审时与代码一并提交。

确认依据及证据
[docs/HANDOFF-HELPER.md](docs/HANDOFF-HELPER.md)、[scripts/handoff.mjs](scripts/handoff.mjs)、
[src/lib/__tests__/handoff-helper.test.ts](src/lib/__tests__/handoff-helper.test.ts)。

---

## 5. 设计规范

### UI / UX

见 [DESIGN.md](DESIGN.md)：冷白或深冷微紫灰背景 + 翡翠绿品牌色 `#00C776`，卡片承载高密度信息。实际 token 以 `src/app/globals.css` 为准，本文件不复制色值表。

### Design System

深色模式默认前景色是弱化色，标题与重要数值需显式使用高对比文字；`.dark` 范围覆盖了 slate/teal 色阶，不要按 Tailwind 默认值推断最终效果。

### 响应式

桌面为左导航 + 主内容；移动端使用抽屉导航，表格与甘特图在自身容器内滚动，避免整页横向溢出。助手为覆盖式抽屉，不改变主内容宽度。

### 无障碍

状态不能仅凭颜色辨别；可点击区域提供 hover / focus-visible / 禁用与提交中反馈；抽屉支持 Escape 关闭与焦点返回。详见 [DESIGN.md](DESIGN.md) 与 [COMPONENT-GUIDELINES](docs/COMPONENT-GUIDELINES.md)。

---

## 6. 开发约束

- `pnpm test`、`pnpm test:coverage` 和 `pnpm build` 已由 `scripts/run-isolated.mjs` 强制分配临时数据目录并清理，不继承外部业务库路径及密钥；直接调用底层 Node 测试 / Next 构建会绕过隔离。启动服务仍须显式指定正确数据目录；验收实例不得复用生产库。
- `MEMORY.md` 与 `.handoff/` **有意纳入版本控制**；`.gitignore` 中取消忽略它们是刻意决定，不是遗留问题。`ee/`、`data/`、`.env*`、`/scripts/analytics-receiver/` 必须保持未跟踪。
- 提交信息不得添加 `Co-Authored-By` 或工具署名（详见 LES-003）。
- 不引入与当前任务无关的依赖、格式化或部署方式变更；Schema 改动必须同步首次建表与升级迁移。
- 迁移编号须核对完整发布历史（含已回滚版本），禁止复用。

---

## 7. API / 数据约定

### API

Route Handler 负责请求解析、鉴权与 HTTP 响应；业务校验与持久化复用 `lib/`。写请求经 `src/proxy.ts` 的 CSRF 保护。开放 API 使用 Personal Access Token（`nvx_live_...`）Bearer 鉴权，完整规范见 [wiki REST API](wiki/REST-API-开放接口文档.md)。

### 数据模型

SQLite 单库；每次读写校验用户归属，系统级操作校验管理员身份。WAL 模式下不要仅复制 `navelix.db` 作为热备份，应使用应用内快照流程。

### 外部服务

AI（OpenAI 兼容）、天气、云存储、链接探针均可能访问外部网络，需在文档与界面说明配置与关闭方式，不承诺所有数据留在本机。

---

## 8. Git / 发布

### 分支策略

主干 `main`；变更使用短期分支并通过 PR，默认 `codex/` 前缀。用户于 2026-10-18 确认个人维护模式：main 要求两个现有 GitHub Actions CI 检查、分支保持最新和讨论解决，审批人数 0；管理员同样受约束，禁止强推及删除。实际已通过 GitHub API 设置并回读确认，详见 [DEVELOPMENT](docs/DEVELOPMENT.md)「main 分支保护」。

用户于 2026-10-20 确认：每次 PR 合入 `main` 后，清理对应本地与远程分支及失效远程引用；先核对合并结果、未提交修改与工作树占用，保留未合并工作。GitHub 的 `delete_branch_on_merge` 已启用（当日 API 回读确认）。共享记忆同步 unavailable，以本地记录为准。

### Commit 规范

沿用现有风格：`<type>(<scope>): <说明>`，发版提交常以 `and publish vX.Y.Z` 结尾；中文说明可用。不添加任何协作者署名行。

### Release

- 规则：根目录 [AGENTS.md](AGENTS.md) 与 [AGENT-RULES](docs/AGENT-RULES.md) 第 18 节；格式 `vX.Y.Z`（见 DEC-001）。
- 基准年：`X` 初始为 1，每过自然年 +1；**2026 年对应 `X=2`**（由 `package.json` 与 tag 实测）。`X=1` 对应 2025 年，但 2025 年发版记录不在当前 git 历史内（最早提交 2026-08-21、最早 tag v2.8.7），未经远程核实，标记为**待确认**。
- 时区：`Asia/Shanghai`（依据 tag 提交时间 `+0800` 与 compose 的 `TZ`）。
- 正式发布渠道：GitHub Releases（`node scripts/sync-changelog.mjs --publish`）与 Docker Hub 镜像 `timorpic/navelix`。扩展使用独立 tag（如 `extension-v1.1.0`），不能套用应用版本号。
- 版本文件与转换：Tag/Release 用 `v2.10.19`，`package.json` 用 `2.10.19`（无 v 前缀）。`node scripts/sync-version.mjs X.Y.Z` 同步 `package.json`、`Dockerfile`、`src/lib/build-info.ts`、`src/lib/admin-system.ts`；版本位置清单以该脚本的 `PATTERNS` 为准。
- 发布顺序约束：`sync-changelog.mjs --publish` **只创建/编辑 Release，不创建 tag**；必须先 `git tag vX.Y.Z` 并推送，否则 Docker 工作流的版本一致性闸门（Release tag == `package.json` version）会失败。
- 当月下一序号：不在此维护；每次发布前核对远程 Tag 与 Release。
- 最近一次发版结果：见 [CHANGELOG.md](CHANGELOG.md) 与 GitHub Releases；进行中的步骤见 [.handoff/CHECKPOINT.md](.handoff/CHECKPOINT.md)。
- CI 影响：`ci.yml` 在 main push / PR 或被发布工作流调用时运行；`docker.yml` 由应用 Release 与手动触发执行候选验证，普通 push 不发布镜像；非应用 Release 跳过，预发布不提升稳定标签。

### CI/CD

`ci.yml` 在 `main` 的 push 与 PR 上运行 lint / test / coverage / build / E2E；`docker.yml` 负责镜像发布与冒烟。本地 `pnpm precommit` 只做类型与 lint，不代表完整 CI 通过。CI 固定 Node 24 与 pnpm 11.16.0。

---

## 9. 已知问题

#### 测试与构建数据隔离

历史上裸 Node 测试与 Next 构建会打开默认业务目录。当前脚本已改为 `scripts/run-isolated.mjs`，每次强制创建一次性目录，结束后清理；不继承业务数据路径和生产密钥。直接执行底层命令仍会绕过保护。构建后清理 instrumentation trace 引入的运行数据副本，并检查敏感运行文件不进入 standalone。实现改动与本次验证状态见当前检查点，不能继承历史全量测试结论。

---

## 10. 经验与避坑

#### LES-001 Next.js 会改写根目录 AGENTS.md / CLAUDE.md

- 状态：confirmed。
- 适用范围与触发条件：在本仓库运行 `next dev`（版本 16.3.8）。
- 症状与已核实原因：`next dev` 经 `node_modules/next/dist/server/lib/generate-agent-files.js` 维护 `<!-- BEGIN:nextjs-agent-rules -->` 标记块。若标记缺失，它会**追加**到已有 `AGENTS.md`；若在 `CLAUDE.md` 且 `AGENTS.md` 也无标记，则写入 `CLAUDE.md` 并把 `CLAUDE.md` 覆盖为 `@AGENTS.md`，会丢失 `CLAUDE.md` 正文与人工维护的 `AGENTS.md` 正文（实测触发路径：`AGENTS.md` 与 `CLAUDE.md` 同时缺少该标记）。
- 有效处理步骤：在任何入口重写后，确认 `AGENTS.md` 仍保留 `<!-- BEGIN:nextjs-agent-rules -->` 块；发现被覆盖立即从 git 恢复，再把块补回 `AGENTS.md`。
- 验证依据及日期：2026-10-16 阅读 `generate-agent-files.js` 源码并核对两个文件的实际内容。
- 限制、例外与临时方案撤销条件：Next.js 升级后需重新核对该文件的行为；仅当该文件不再写入这两个文件时本条失效。
- 主记录或详细说明入口：`node_modules/next/dist/server/lib/generate-agent-files.js`；[AGENT-RULES](docs/AGENT-RULES.md) 第 10 节。
- 替代关系：无。

#### LES-002 wiki 有两份副本，需手工同步

- 状态：confirmed。
- 适用范围与触发条件：修改 `wiki/*.md` 后希望 GitHub Wiki 页面同步显示。
- 症状与已核实原因：仓库 `wiki/` 目录（版本化、随代码提交，是源头）与 GitHub 托管的 wiki（`https://github.com/timorpic/Navelix.wiki.git`）互不自动同步；只改仓库目录不会反映到渲染版页面。
- 有效处理步骤：把文件复制进 wiki 仓库克隆（`cp -f wiki/*.md wiki/*.svg <clone>/`）后 `git add -A` 提交推送，保证两边逐字节一致。截至 2026-10-10 两份已完全一致（各 12 个文件），仓库不再是超集。
- 验证依据及日期：2026-10-10 完成整体对齐（wiki 仓库提交 d609afc）。
- 限制、例外与临时方案撤销条件：发布说明走 `CHANGELOG.md` + `scripts/sync-changelog.mjs`，不属 wiki 同步范围。
- 主记录或详细说明入口：[README.md](README.md) 的 Wiki 链接与 `wiki/` 目录。
- 替代关系：无。

#### LES-003 提交信息不添加工具署名；历史重建不使用 filter-branch

- 状态：confirmed。
- 适用范围与触发条件：任何在本仓库创建提交或 PR 的场景；需要清理历史署名时。
- 症状与已核实原因：GitHub 会把协作者 trailer 的邮箱解析到对应账号，导致个人仓库出现未经添加的贡献者（2026-10-10 因此重建过历史）。`git filter-branch --msg-filter` 会级联改写其后所有提交的 SHA、丢弃签名并分离 tag，代价过高。
- 有效处理步骤：默认不写 `Co-Authored-By` 或工具署名；确需清理时用 `git commit-tree` 定向重建受影响的提交及其后继合并提交。
- 验证依据及日期：2026-10-10 历史重建与全局 attribution 配置调整；2026-10-16 复核提交历史无该 trailer。
- 限制、例外与临时方案撤销条件：无。
- 主记录或详细说明入口：本文件第 6 节。
- 替代关系：无。

#### LES-004 dependabot 依赖 PR 因 pnpm 发布冷静期失败

- 状态：confirmed。
- 适用范围与触发条件：CI 固定 pnpm `11.16.0`，使用默认 `minimumReleaseAge`（1440 分钟）；dependabot 重新生成的锁文件拉入 24 小时内发布的新版本时。
- 症状与已核实原因：`pnpm install` 阶段因供应链冷静期策略失败（曾命中 PR #7 的 bbm/nanoid、PR #8 的 `baseline-browser-mapping`），并非代码问题；冷却期过后重跑 CI 仍可能因其他新传递依赖再次失败。
- 有效处理步骤：保留机器人的 `package.json` 升级，用项目固定版本的 pnpm **只重新生成锁文件**（`pnpm install --lockfile-only`），使传递依赖保持已过冷静期的版本；再按 CI 等价项校验后推送修复提交到该分支。
- 验证依据及日期：2026-10-13 记录，先例为 PR #8（修复提交 1a48348）。
- 限制、例外与临时方案撤销条件：若上游取消冷静期策略，本条不再适用。
- 主记录或详细说明入口：`.npmrc`、`.github/workflows/ci.yml`。
- 替代关系：无。

---

## 11. 历史决策

> 当前无已被替代但仍具参考价值的条目。原条目在本文件内被取代时，在此保留简短记录。

---

## 12. Memory Rules

### 记录

只记录具有长期价值、且能从代码、正式文档或已确认决策核实的信息。

### 更新

发现新的正式决策时更新相关内容；不确定的信息标注待确认，不写成结论。

### 冲突

新决策取代旧决策时更新有效结论并标注替代关系与确认依据；不因时间较新就覆盖既有决策。

### 精简

不重复代码或正式文档已明确表达的内容，仅记录其入口与关键约束。

### 安全

禁止记录：密码、API Key、Token、私钥、用户隐私、生产敏感信息（含私有主机路径与凭据获取细节）。

### 生命周期

失效内容移出有效事实；仍有审计价值的替代记录精简后归入第 11 节。

---

## 13. 跨工具身份与记忆索引

- 稳定 project_id：**Navelix**（取目标仓库名，非模板目录名；仓库标识 `timorpic/Navelix`）。
- 共享 Bank：OpenMemory（已核对连接可用）。
- 共享记忆标签：`source:<实际写入工具>`、`project:Navelix`、`type:<标准类型>`。
- Claude Code 使用 `source:claude-code`；Codex 使用 `source:codex`；其他工具填写真实来源，不冒充。
- 标准类型：`decision` / `architecture` / `preference` / `milestone`。
- 接力入口：[.handoff/CONTEXT.md](.handoff/CONTEXT.md)；检查点：[.handoff/CHECKPOINT.md](.handoff/CHECKPOINT.md)；协议：[HANDOFF.md](HANDOFF.md)。
- 长期事实主记录：本文件；工作规则主记录：[docs/AGENT-RULES.md](docs/AGENT-RULES.md)。
- Hindsight 是检索副本，不能替代代码、检查点、任务系统或发布状态查询；断网时本地协议照常工作。
- 不把待办、运行现场、临时锁或原始测试日志写入本文件。

### 共享同步索引

| 条目 ID | 本地主记录定位 | 有效状态 | 替代关系 | 同步状态 | 服务返回标识（如有） |
| --- | --- | --- | --- | --- | --- |
| MS-001 | 本文件第 13 节（文档 SSOT 分工）与第 4 节 DEC-001–003 | 有效（2026-10-16） | 无 | synced（2026-10-16 已确认存储完成） | `8cd96bf2-f3c8-4646-be69-8dcc4b89e08f` 等 12 条 |

本地事实先落盘再同步；受理不等于成功，异步未确认时保持 pending。

本轮上线加固的实现边界：主密钥异常失败关闭、恢复保护失败终止、管理员深度健康诊断与云备份持久化调度；说明见 docs/PRODUCTION-ACCEPTANCE.md，实际验证状态见 .handoff/CHECKPOINT.md。这些本地事实尚未同步到 OpenMemory（工具 unavailable）。

用户已确认（2026-10-18）：部署保持原有 `latest` 镜像和 Watchtower 使用方式，不增加必填镜像标签变量或自动更新 profile；镜像验收门禁放在发布流水线。

用户确认（2026-10-18）：Docker 镜像构建全部在 GitHub Actions 执行，本地不构建 Docker 镜像。
