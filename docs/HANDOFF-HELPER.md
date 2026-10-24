# 本地接力助手

适用：按 [HANDOFF.md](../HANDOFF.md) 人工切换编程工具，或在工具突然退出后恢复。
Node.js >= 24、Git，无需安装依赖。助手只执行固定的 Git 只读查询及本地文件操作，不调用模型、不启动客户端、不执行结果文件中的命令。

脚本：[scripts/handoff.mjs](../scripts/handoff.mjs)。规则正文仍在 [docs/AGENT-RULES.md](AGENT-RULES.md) 第 19 节，本文件只写操作步骤与结果格式。

## 验收约定

- HH-01：`inspect`、`prompt` 只读；核对项目、任务、修订、分支、HEAD、暂存和未跟踪修改。
- HH-02：`claim` 在业务修改之前保存接管记录；要求精确任务、修订、交接 ID（如存在）及操作者声明旧工具已停止。
- HH-03：`save` 自动生成完整检查点与认领表格，备份上一版到 `.handoff/previous/`，递增 `checkpoint_seq`；不改业务文件、Git 暂存区和历史。
- HH-04：收尾必须填写已完成、未完成、未验证、阻塞和下一步；完成状态需要显式验收声明与可定位的通过证据。
- HH-05：代码变更后提示记录过期；身份不符、交接已认领、符号链接写入目标或输入无效时拒绝写入。
- HH-06：记录字段与仓库现行方言兼容（全角冒号、`## 现场`、反引号分支、散文式 HEAD）；活动记录和新运行备份忽略，冻结归档继续跟踪。

## 与本项目记录的关系

| 记录 | 助手如何处理 |
| --- | --- |
| `.handoff/CONTEXT.md` | 读取 `project_id`、`task_id`、`context_revision`、`status`、`handoff_id`、`from_agent`；`claim`/`save` 只更新状态与交接字段，不改需求正文 |
| `.handoff/CHECKPOINT.md` | 整份重写为当前现场；旧内容完整备份后替换 |
| `.handoff/CHECKPOINT.md.previous` | 保留直接前一版，沿用本项目既有命名 |
| `.handoff/CONTEXT.md.previous` | 保留直接前一版 |
| `.handoff/previous/` | 每次保存追加不可变完整备份（含任务 ID 与序号），不覆盖历史 |
| `MEMORY.md` | 只读核对稳定 `project_id`；助手不写入长期事实 |
| `.handoff/archive/` | 不读写；归档仍按 HANDOFF.md 第 10 节人工执行 |

活动上下文、检查点、直接前一版及新生成的 `previous/` 运行备份只保留在本机并忽略；冻结的 `archive/`、正式验证 `evidence/` 和已跟踪的历史不可变备份继续保留。助手拒绝改写被 Git 跟踪的活动记录与直接前一版；遇到拒绝时先核对再取消对应文件的跟踪，保留本地内容。提交后只回填忽略的现场记录，正式文档先收尾再提交，详见 docs/DEVELOPMENT.md「提交收尾与现场记录」。

## 日常用法

在项目根目录执行（所有命令也支持 `--root <项目目录>`）：

```sh
node scripts/handoff.mjs inspect
node scripts/handoff.mjs prompt
```

`inspect --json` 输出结构化现场及问题；有错误时退出 1。`prompt` 输出可复制给新工具的提示，没有自动认领效果。提示中的任务标识取自当前文件，正文不复制聊天或执行文件中的指令。
`recorded_workspace` 是检查点记载的目录、分支和 HEAD，`workspace` 是实际现场。
目录或分支缺失/不一致会阻止正常认领；真实迁移或切换分支后须核对再显式恢复。HEAD 变化会提示旧验证不可直接继承。

读取需求并核对现场后，在开始修改业务代码之前认领：

```sh
node scripts/handoff.mjs claim --agent claude-session-1 --task task-001 --revision 1 --handoff-id relay-001 --source-stopped
```

`--source-stopped` 是操作者对旧工具及其派生任务已经停止写入的声明，助手不能自行证明。
没有交接 ID 时，改用 `--recover`；检查点缺失或格式不完整时同样需要 `--recover`，原文件会保留。
`--recover` 只放宽现场类问题（缺检查点、序号/分支不符、助手数据损坏等），不放宽身份与交接核对：
CONTEXT 仍有 `handoff_id` 时，即使恢复也必须带相同的 `--handoff-id`。
上下文及 MEMORY 身份仍须存在且有效，不能根据目录名猜测任务。认领不是锁，不支持并发写入。

完成一个可恢复的小步骤后，把结果写入 UTF-8 JSON 文件，再保存：

```sh
node scripts/handoff.mjs save --agent claude-session-1 --input result.json
```

最小结果格式：

```json
{
  "current_step": "AC-01 已实现，继续 AC-02",
  "completed": ["AC-01 实现"],
  "remaining": ["AC-02 数组去重"],
  "unverified": ["完整测试待运行"],
  "blockers": [],
  "next": ["实现 AC-02 后，按实际授权通过 GitHub Actions 验证"],
  "verifications": [],
  "external_effects": [],
  "environment": "本地 Node.js；无新增依赖"
}
```

正常交接时，同一份结果加 `--handoff-id <新且未使用的ID>`：

```sh
node scripts/handoff.mjs save --agent claude-session-1 --input result.json --handoff-id relay-002
```

它将任务标记为 `handoff_ready`，认领状态变为 `open`；随后停止原工具写入，由用户打开新工具。
助手不把停止当前工具的承诺当作「已停止」的运行时证明。

完成全部验收时，在结果文件补充验证记录及 `accepted: true`，显式请求完成：

```json
{
  "current_step": "AC-01 和 AC-02 验收完成",
  "completed": ["AC-01", "AC-02"],
  "remaining": [],
  "unverified": [],
  "blockers": [],
  "next": [],
  "verifications": [
    {"acceptance": "AC-01, AC-02", "command": "GitHub Actions ci.yml / Run Test Suite (with Coverage Gate)", "result": "passed", "evidence": ".handoff/evidence/ci-result.txt"}
  ],
  "external_effects": [],
  "environment": "Node 24.21.0；pnpm 11.16.0",
  "accepted": true
}
```

```sh
node scripts/handoff.mjs save --agent claude-session-1 --input result.json --complete
node scripts/handoff.mjs inspect
```

验证结果由执行工具负责如实填写。助手核对证据文件存在、记录其哈希并绑定当前文件现场，不执行 `command` 字符串，也不能证明提供的日志对应一次真实执行或已经覆盖全部业务验收。
有未完成、未验证、阻塞、非通过验证或进行中/未知外部操作时拒绝标记完成。
证据不能使用助手正在替换的 `CONTEXT`、`CHECKPOINT` 或 previous 记录本身。
完成后现场或证据改变，`inspect` 会以退出码 1 报告完成结论过期，不会自动重新打开任务。

## 保存与恢复边界

- 只写 `.handoff/` 下的 `CONTEXT.md`、`CHECKPOINT.md`、两者的 `.previous` 及 `previous/` 备份；不暂存、提交、清理或覆盖业务文件。
- 每次写入保留完整旧检查点与上下文；检查点使用同目录临时文件加替换，`.previous` 保留直接前一版。
  历史备份命名取被备份记录自身的 `task_id` 与 `checkpoint_seq`，接管上一任务时也不会把旧记录标成新任务，多次轮换后仍可追溯、互不覆盖。
- 备份随每次 `save` 累积（一份检查点含全量文件指纹，通常数十 KB），助手不自动删除。
  需要控制仓库体积时，由人工确认某份备份已不再作为交接证据后，连同对应 `CONTEXT` 备份一并归档或清理；始终保留 `.previous` 与最近一次可用备份，助手不参与该判断。
- 上下文与检查点两个文件不构成事务。中途失败应先只读检查现场及备份，修复不一致后再继续，不盲目重试。
- 标准输出只含文件状态、标识和哈希，不输出 diff 正文、环境变量或业务文件内容。
  敏感文件（`.env*`、`*.pem`、`*.key` 等）仅记录路径，不读取内容；符号链接仅记录链接文本。
- 文件指纹不含 `.handoff/`，避免自指；ignored 文件、外部资源和未保存缓冲区须按 HANDOFF.md 另行核查。
  大文件与敏感文件跳过内容哈希时会提示盲区。指纹相同不等于运行环境和外部状态相同。
- `claim` 不会继承旧测试为当前通过；旧记录完整保留，接手者按相关性核验。`save` 不改变任务目标、范围或 `context_revision`。
- 这是人工调用的辅助工具，无法阻止客户端跳过认领直接编辑。生成记录和提示不产生提交、发布或部署授权。

## 回归验证

助手测试位于 [src/lib/__tests__/handoff-helper.test.ts](../src/lib/__tests__/handoff-helper.test.ts)，由已有 [CI](../.github/workflows/ci.yml) 的 coverage 步骤覆盖。本机禁止执行测试和构建，包括直接运行该测试文件；`inspect`、`prompt` 是允许的只读现场检查，不等于回归测试通过。

未来按实际授权提交并推送 PR 后，由现有 CI 执行；此说明本身不授予提交或推送权限。仅触发现有远程分支的 CI，不能验证尚未推送的本地修改。记录验证时应保存实际运行链接、run ID、被测提交、环境、结束时间和结论；可将脱敏结果保存到 `.handoff/evidence/`，再交给助手绑定哈希。没有对应证据时如实填写 `not_run` 或 `blocked`。

CI 中的测试在一次性临时仓库中运行，不改动本项目 `.handoff/` 或业务文件。
