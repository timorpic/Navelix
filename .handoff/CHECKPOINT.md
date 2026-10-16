# 当前检查点

> 最新现场摘要。进度变化时改写失效内容，不追加成会话流水账。
> 上一版完整记录见 `.handoff/previous/`。

- schema_version: 1
- project_id: Navelix
- task_id: handoff-workflow-adoption
- context_revision: 1
- checkpoint_seq: 1
- updated_at: 2026-10-16T16:05:00+08:00
- owner: Claude Code（本次会话；会话标识未记录）
- status: active
- current_step: W-05 验证接入并整理交付说明
- single_writer_confirmed: 已核实（检查时段内无其他进程写入本仓库）

## 工作区身份

- repo_root: `/root/Navelix`（本机路径，仅用于定位）
- branch: `main`
- HEAD: `b65b7ad691bb8260678f8be5a520ce0734ff0dcf`
- base_commit: 同 HEAD（本次改动未提交，工作区基于该提交）
- context_path: .handoff/CONTEXT.md
- 上下文版本核对：一致（CONTEXT rev 1 与本文件 context_revision 1 对应）

## 实际修改现场

| 路径 | staged/unstaged/untracked | 修改意图 | 来源/归属 | 保存与恢复注意 |
| --- | --- | --- | --- | --- |
| `AGENTS.md` | unstaged（已修改） | 合并为「启动入口 + 必守边界」，规则正文移出至 AGENT-RULES；保留原有项目约定与 `nextjs-agent-rules` 块 | 本次接入 | 原文备份 `.handoff/previous/AGENTS.md.orig`；HEAD 版本可用 `git show HEAD:AGENTS.md` 恢复 |
| `CLAUDE.md` | unstaged（已修改） | 工具入口改为引用统一规则，保留项目导航与接力/记忆入口 | 本次接入 | 原文备份 `.handoff/previous/CLAUDE.md.orig` |
| `README.md` | unstaged（已修改） | 文档中心表格补充工作流导航 3 行，未改动其他章节 | 本次接入 | 原文备份 `.handoff/previous/README.md.orig` |
| `.gitignore` | unstaged（已修改） | 取消忽略 `MEMORY.md`，使长期记忆随仓库分发 | 本次接入 | 原文备份 `.handoff/previous/gitignore.orig` |
| `docs/AGENT-RULES.md` | untracked（新增） | 统一详细规则正文；写入本节项目落地说明（验证、图标、发版、版本号） | 本次接入，源自模板 | 模板原文 `/tmp/ah-tpl/docs/AGENT-RULES.md`（临时目录，不随仓库保留） |
| `docs/INITIALIZATION.md` | untracked（新增） | 项目初始化记录、工作流文件树与阅读维护路径；已按本仓库改写，不再是模板原文 | 本次接入，源自模板并做项目化改写 | 模板原文 `/tmp/ah-tpl/docs/INITIALIZATION.md`（临时目录，不随仓库保留） |
| `HANDOFF.md` | untracked（新增） | P0+P1 人工接力协议 | 本次接入，源自模板（未改动） | 同上 |
| `PROMPTS.md` | untracked（新增） | 初始化、交接、接管与恢复提示词 | 本次接入，源自模板（未改动） | 同上 |
| `adapters/ENTRY.md` | untracked（新增） | 其他工具的显式统一入口 | 本次接入，源自模板（未改动） | 同上 |
| `MEMORY.md` | untracked（新增） | 长期知识：项目身份、技术栈、DEC-001–003、LES-001–004、发布约定 | 本次接入，内容核实自本仓库 | 本文件为新建，无被覆盖的原内容 |
| `.handoff/CONTEXT.md` | untracked（新增） | 本次任务上下文（由模板 draft 初始化为 active） | 本次接入 | 无被覆盖的原内容 |
| `.handoff/CHECKPOINT.md` | untracked（新增） | 本文件 | 本次接入 | 无被覆盖的原内容 |

- 依赖的 ignored 文件：`ee/`（私有商业制品，未改动）、`data/`（真实数据库，未改动）、`.env.local`（如存在，未读取未改动）。均在 `.gitignore` 内，不随本次改动进出。
- 未保存缓冲区：不适用（本次无编辑器外部缓冲）。
- 后台进程/端口/执行任务：无由本次任务启动的长时间进程；未启动 dev、build、test 或容器。
- 外部资源及状态查询方式：无。
- 脱敏指纹/证据位置：原文备份位于 `.handoff/previous/`（见上表）；改动前版本另可用 `git show HEAD:<path>` 取回。

## 进展

- 已完成：
  - W-01（AC-04、AC-06）：核对根目录 `/root/Navelix`、分支 `main`、HEAD `b65b7ad`、工作区初始为空（`git status --porcelain` 无输出），确认无 reset/clean/stash 需求。
  - W-02（AC-01、AC-02）：模板克隆到项目外临时目录 `/tmp/ah-tpl`，使用 `main` 分支提交 `e22828631d80a9617ea8fb74eefbf0a974e7fe86`；已读模板 AGENTS.md、docs/AGENT-RULES.md 全文（含第 1–14、17、19 节）、HANDOFF.md、docs/INITIALIZATION.md、PROMPTS.md、MEMORY.md、.handoff/CONTEXT.md、.handoff/CHECKPOINT.md。
  - W-03（AC-01、AC-04、AC-05）：入口与规则合并完成，差异项按项目既有约定保留（见「已做取舍」）。
  - W-04（AC-03、AC-08）：`MEMORY.md`、`.handoff/CONTEXT.md` 与本文件已建立，project_id 统一为 `Navelix`。
  - W-05（AC-02、AC-07）：执行静态验证，结果见下节。
- 已做取舍（规则差异处理，保留项目原约定而非套用模板）：
  - 版本号：保留项目「Z 从 0 开始、不补前导零、无 v 前缀于 package.json」；在 AGENT-RULES 第 18.3 节显式声明其为通用格式的项目特例。
  - 图标：通用规则默认 Lucide；项目实际为内联 SVG + `brand-icon.tsx`（Iconify 命名）+ emoji 分类字段，在 16.1 节记录现状，未引入新图标库。
  - 验证基线：沿用项目 `NAVELIX_DATA_DIR` 隔离要求与既有命令；模板中「禁用 CI/CD」的取向不适用（本仓库 CI 需保留，未改动 workflow）。
  - 入口写法：`next dev` 会改写 `AGENTS.md`/`CLAUDE.md`（见 MEMORY LES-001），故必须保留 `nextjs-agent-rules` 标记块于 `AGENTS.md`。
  - `docs/INITIALIZATION.md`：由模板通用的「首次使用」说明改写为本仓库的「初始化记录 + 工作流文件树 + 阅读维护路径」，删除模板专属的复制步骤措辞，未改动其余通用章节。
- 进行中：无。
- 失败/阻塞：无。
- 未验证：真实工具接力（Codex/OpenCode/Antigravity 实际接管）未执行，属本轮范围外。
- 推测及未知：无；未确认项已在 MEMORY.md 标注（2025 年发版历史）。

## 验证记录

| 验收项 | 命令/操作与目录 | 时间与环境摘要 | 被测提交/相关文件状态 | 结果 | 证据位置 | 此后相关改动 |
| --- | --- | --- | --- | --- | --- | --- |
| AC-01 | 人工核对 `AGENTS.md`/`CLAUDE.md`/`adapters/ENTRY.md` 的读取步骤与任务表；确认入口不含规则正文 | 2026-10-16，`/root/Navelix` | 工作区文档（HEAD `b65b7ad` + 本次改动） | passed | 三个入口文件 | 无 |
| AC-02 | 章节存在性：`grep -n '^## ' docs/AGENT-RULES.md` → 第 1–19 节齐备；入口引用的 1–14/17/19 节均存在 | 同上 | 同上 | passed | 命令输出 | 无 |
| AC-02 | 相对链接解析：解析 15 个文档（AGENTS/CLAUDE/README/README.en/MEMORY/HANDOFF/PROMPTS/DESIGN/TODO/CHANGELOG/docs 三份/adapters/.handoff 两份）的 `](*.md)` 链接并检查目标存在 | 2026-10-16，`/root/Navelix` | 工作区文档（HEAD `b65b7ad` + 本次改动） | passed（重跑结果 broken: 0；初次运行的 5 处缺失在 CHECKPOINT.md 创建后消除，`](*.md)` 为散文中的通配符写法，非链接） | 命令输出 | `docs/INITIALIZATION.md` 项目化改写后重跑 |
| AC-02 | 交叉引用核对：`AGENT-RULES.md` 章节标题实存（第 1–19 节，含 15.x/16.x/17.x/18.x/19.x 子节）；各文件引用的「AGENT-RULES 第 10/12/17/17.7/18/18.3 节」「MEMORY 第 8/9 节」均可在目标文件命中 | 同上 | 同上 | passed | `grep -n '^#\{1,4\} '` 输出 | 无 |
| AC-03 | 核对 `project_id=Navelix`、`task_id=handoff-workflow-adoption`、`context_revision=1` 在 MEMORY/CONTEXT/CHECKPOINT 三处一致性 | 同上 | 同上 | passed | 三份文件 | 无 |
| AC-04 | 对比备份 `.handoff/previous/*.orig` 与当前文件，确认项目原约定（版本号规则、数据与安全边界、模块边界、验证段、README 结构）保留 | 同上 | 同上 | passed | `.handoff/previous/` | 无 |
| AC-05 | 检查是否存在重复主记录：TODO（计划）、CHANGELOG（版本）、docs/ 原文档职责未变；CONTEXT 只引用不复制 | 同上 | 同上 | passed | 文件清单 | 无 |
| AC-06 | `git status --porcelain` 全量列出改动，确认无 `src/`、`scripts/`、`.github/`、`package.json`、`pnpm-lock.yaml` 变更；`git remote -v` 未改动 | 同上 | 同上 | passed | 命令输出 | 无 |
| AC-07 | 通读 `PROMPTS.md` 五段提示词与 `HANDOFF.md` 第 3/6/7 节，确认提示词引用的文件名与章节在仓库内存在 | 同上 | 同上 | passed | PROMPTS.md、HANDOFF.md | 无 |
| AC-08 | `grep` 扫描新增/修改文档中的凭据样式串（私钥、Token、密码、内网地址），确认无；修正 MEMORY.md 中一处远程地址写法为仓库标识；`.handoff/previous/` 备份经 sha256 校验与 HEAD 一致，且不含新增敏感信息 | 同上 | 同上 | passed | 本次 diff、`.handoff/previous/` | MEMORY.md 该行 |

结果仅可填 passed / failed / blocked / not_run / stale。
本次为文档接入，按 AGENTS.md 与 DEVELOPMENT.md 的约定**未**运行 `pnpm typecheck`/`lint`/`test`/`build`——纯文档变更不要求，且项目测试会写入真实数据库（见 MEMORY 第 9 节）。

## 外部副作用台账

| 操作 | 授权依据 | 目标/版本/提交 | 操作 ID | 状态 | 实际核查结果 | 安全恢复办法 |
| --- | --- | --- | --- | --- | --- | --- |
| 克隆模板仓库到 `/tmp/ah-tpl` | 本次用户授权「模板获取」 | `github.com/timorpic/agent-handoff` @ `e228286` | 不适用 | succeeded | 目标目录存在，HEAD 与记录一致 | 删除临时目录即可，无外部影响 |
| 提交 / 推送 / 发版 / 部署 | **未授权** | — | — | not_run | 未执行 `git commit`、`git push`、tag、Release、镜像发布 | 不适用 |

进行中 Release：无。

## 本轮结果摘要

- 本轮产出及证据引用：完成 W-01–W-05。新增 `docs/AGENT-RULES.md`、`docs/INITIALIZATION.md`、`HANDOFF.md`、`PROMPTS.md`、`adapters/ENTRY.md`、`MEMORY.md`、`.handoff/CONTEXT.md`、`.handoff/CHECKPOINT.md`；修改 `AGENTS.md`、`CLAUDE.md`、`README.md`、`.gitignore`。证据见上表与 `.handoff/previous/` 备份。
- 尚未完成的验收项：无（AC-01–AC-08 均 passed）。
- 未验证项：真实跨工具接力未演练（本轮范围外，非验收项）。
- 阻塞及解除条件：无。
- 是否满足任务完成标准：满足本次接入验收标准；改动尚未提交（未授权），故不标 completed，保持 active 待用户决定后续动作。

## 下一步（最多三项）

1. 用户审阅本次改动（重点：`AGENTS.md` 入口措辞、`MEMORY.md` 第 8 节发布约定、`docs/AGENT-RULES.md` 的四节项目落地说明），确认是否提交。提交属未授权操作，需用户明确指示。
2. 若要演练接力：在另一工具中用 `PROMPTS.md`「人工接管」提示词接管本任务，核对 task_id/HEAD/现场后继续；接管前停止本工具写入。
3. 可选维护项：把 MEMORY 第 9 节的测试污染问题重新落地修复并提交；本条需用户确认后再开工。

## 记忆与同步

- 本次召回：matched（Hindsight/OpenMemory 可用；使用 `project:Navelix` 无匹配，实际以 `project:timorpic` 及主题召回，结果多为其他项目事实，未采用为其本项目事实）。
- 采用的条目 ID 及本地主记录引用：无（召回未提供本仓库已核实的长期事实；MEMORY.md 全部条目改由本地代码与文档核实）。
- 被排除的冲突/跨项目结论：Swiseus、uepo/AegisLink-CRM、agent-handoff 自身等条目因 project 标签不符被排除，未写入本项目文件。
- 本次长期事实变更：MEMORY.md 新建（DEC-001–DEC-003、LES-001–LES-004），属首次初始化。
- 本次沉淀：接入完成后写入 OpenMemory，`source:claude-code`、`project:Navelix`、`type:milestone`/`type:architecture` 共 12 条，返回标识 `8cd96bf2-f3c8-4646-be69-8dcc4b89e08f` 等（已回读确认存储完成，非仅受理）；一条含本机私有路径的条目已改写去除。索引见 MEMORY 第 13 节 MS-001。
- 对当前任务的影响：无阻塞。

## 接管/恢复记录

- 上一个检查点及备份：无（本文件为首份检查点）；改动前原文备份见 `.handoff/previous/`。
- 与当前现场的差异：不适用。
- 本次重建依据：不适用。
- 接手人核查结论：未核实（尚无接管发生）。
