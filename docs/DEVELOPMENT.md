# 开发与发布流程

## 环境准备

以 `package.json` 的 engines 和 packageManager 为准：Node.js 至少 `24.0.0`，项目使用 `pnpm@11.16.0`。建议使用持续更新的 Node 24 补丁版，以兼容内置 SQLite、Node 测试与 TypeScript 类型擦除参数；CI 使用 Node 24。

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

访问 `http://localhost:3721`。`.env.local` 按需设置，不要提交。首次初始化创建 `admin`，密码由 `NAVELIX_ADMIN_PASSWORD` 或随机生成机制提供；随机密码会写入数据目录的初始密码文件，查看后妥善保管。

该变量主要用于首次初始化，不能当成任意已有账号的通用密码重置机制。默认数据目录为 `<cwd>/data`，可设置 `NAVELIX_DATA_DIR` 隔离开发、测试与构建数据。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | 开发服务，端口 3721 |
| `pnpm typecheck` | 严格类型检查，含未使用变量和参数 |
| `pnpm lint` | ESLint |
| `pnpm test` | Node 原生测试，串行运行 |
| `pnpm test:coverage` | 测试及行 60%、函数 55% 覆盖率门禁 |
| `pnpm test:e2e:install` | 安装 Playwright Chromium 及系统依赖 |
| `pnpm test:e2e` | Playwright 端到端流程 |
| `pnpm build` | Next.js 生产构建 |
| `pnpm start` | 启动已构建应用，端口 3721 |
| `pnpm precommit` | 类型检查与 lint；本地 pre-commit Hook 使用 |

测试、E2E 与生产构建在 CI 执行，不在本地开发机运行：该机只有 3.6 GiB 内存，完整测试或 `next build` 与编辑器、Agent 进程叠加会让整机失去响应（2026-10-22 已有实例）。本地只做 `pnpm typecheck`、`pnpm lint`；不以 cgroup 限制作为本机运行构建的例外。

pre-commit Hook 由 `simple-git-hooks` 生成，指向 `scripts/pre-commit.sh`。该脚本优先使用本机 `pnpm precommit`；本机没有 Node/pnpm 而存在 Docker 时，回退到 `node:24-alpine` 容器执行同一组检查（复用仓库内已安装的 `node_modules`，约半分钟）。两者都不可用时钩子以非零码失败，而不是静默放过——门禁默认为开，需要临时绕过时用 `SKIP_SIMPLE_GIT_HOOKS=1 git commit`。

Node 测试的 `src/**/*.test.ts` glob 已在脚本中加引号，由 Node 展开；不要去掉引号造成部分测试漏跑。测试使用串行配置以避免共享 SQLite 竞争。测试与覆盖率脚本通过 `scripts/run-isolated.mjs` 自动分配一次性数据目录，忽略继承的业务数据目录及密钥。构建也使用该入口；结束后清理临时数据。直接调用 Node 测试或 `next build` 会绕过隔离，不得指向真实业务库。测试与构建命令仅在 GitHub Actions 中运行，不在本机执行。

Playwright 配置自行创建临时数据目录，先构建生产包再以 `next start` 在端口 3722 启动，使用专用初始管理员密码，禁止复用已运行服务。可用 `E2E_DATA_DIR` 指定专用测试目录。镜像发布任务通过 `E2E_BASE_URL=http://localhost:3722` 测试独立候选容器，配置拒绝非本机 HTTP 地址；本机地址也必须由操作者确认是隔离实例，不能指向生产库。浏览器人工验收按项目约定使用 Computer Use，自动 CI 与人工证据分别记录。

## 变更工作流

1. 阅读 [AGENTS](../AGENTS.md) 和相关模块，检查工作区状态；后续按下节「Git 工作流」使用用途前缀任务分支与 PR。
2. 明确行为、数据及权限边界，优先复用业务模块和组件；具体约定见 [COMPONENT-GUIDELINES](COMPONENT-GUIDELINES.md)。
3. Schema 变更同步新库初始化与有序升级迁移；多步写入加事务，并考虑备份与旧数据。
4. 行为修复添加有价值的回归用例，验证失败路径、用户归属和角色限制。
5. 按变更运行相关检查。提交代码前完成类型和 lint；合并前满足 CI 的覆盖率、构建及 E2E 检查。纯文档变更检查链接、路径和命令即可。
6. 更新相关文档、TODO 与 `[未发布]`，说明验证结果和已知限制，不改写历史发布事实。

CI 配置见 `.github/workflows/ci.yml`，镜像发布与冒烟测试见 `.github/workflows/docker.yml`。两条工作流中的 JavaScript action 均使用 Node.js 24 运行时，应用构建与测试由 `actions/setup-node` 配置为 Node.js 24；action 运行时版本与应用 Node.js 版本独立。本地 Hook 仅执行类型与 lint，不代表完整 CI 已通过。

## Git 工作流

本项目采用 agent-handoff 本次 Git 规范更新；通用协议正文及其版本保持原样，
本节是项目 Git 流程的主记录。依据：用户于 2026-10-23 明确要求同步到本仓库。
本次采用规则，不代表已提交代码、执行 CI 或修改远程仓库设置。

### 分支与任务

- 使用既有主分支 `main`，不增加长期 `develop` 分支。
- 新功能、修复和文档等修改均使用短期任务分支，经 PR 合并，不直接在主分支提交。
- 分支从已核对的最新远程主分支创建；先检查当前分支、工作区和远程状态，不自动搬移已有修改。
- 分支名使用 `类型/简短描述`，例如 `feat/handoff-preview`、`fix/owner-validation`；
  类型使用 feat、fix、docs、refactor、test、ci、build、chore、perf 或 style。
- 一条分支处理一个明确任务；较大功能拆成可验收的小步骤，避免混入无关修复或整理。
- 合并前核对主分支变化，按项目约定同步；不擅自 rebase 或强推共享分支。

### 提交与命名

- 保持提交原子化，每次提交解决清晰的问题，不提交占位实现或无关生成文件。
- 提交前检查 `git status`、`git diff` 与暂存区差异，只暂存本任务相关变更。
- Commit 与 PR 标题统一采用 `type(scope): 描述`，scope 可省略；
  例如 `feat(handoff): 增加交接预览`、`fix: 修复接管校验错误`。
- type 使用上述词表，按变更主要意图选择；style 仅用于代码格式，界面功能变化按 feat 或 fix 分类。
- 不兼容变更采用 `type(scope)!: 描述`，在正文说明影响与迁移方式；
  该标记不改变本项目既有的版本编号，也不自动授权破坏兼容性。
- 修复说明应包含触发条件、已核实原因和修复后的行为；有 Issue 时引用实际编号。
- 不修改无关历史提交，不覆盖、丢弃或重置用户已有修改，不提交密钥或敏感数据。

### PR 与验证

- PR 使用 `.github/PULL_REQUEST_TEMPLATE.md`，说明问题、修改后的行为、范围、验证和适用的兼容性及回滚事项。
- 构建、测试和制品生成全部交给 GitHub Actions，不在本机或其他远程服务器执行。
  本机仅做允许的静态检查；依赖安装不得触发本机编译。build 仅是变更分类，不是本机执行许可。
- PR 分别记录静态检查与 CI 结果；未运行、失败、受阻和通过必须如实区分，并提供可定位证据。
- 必需 CI 必须覆盖拟合并代码；相关修改使旧结果失效，不以跳过、空命令或占位成功替代检查。
- CI 的工作流、检查命令与必需状态由本项目维护；本次规范同步不引入或修改 CI。
  模板仓库的检查不能作为本项目验收依据，缺少项目验证证据时如实记录，不宣称已通过。
- 合并前完成审查并处理阻塞问题；多人项目默认至少一位其他维护者批准，
  单人项目可不要求他人批准，但须完成自审、记录结果并通过必需 CI。

### 合并、保护与回退

- 默认 Squash merge，合并标题沿用通过规范检查的 PR 标题，正文保留必要背景及关联。
  确需保留独立提交时，在项目开发文档记录采用其他合并方式的理由。
- 主分支要求 PR、必需状态检查通过及审查讨论解决；禁止强推和删除主分支，限制绕过规则。
- 远程分支保护、合并方式及审批人数按实际设置核实；本地文档更新不等于远程设置已生效。
- 分支保护不可用时记录限制及人工替代流程，不伪称已强制执行。
- 已合并缺陷优先通过新的修复或 revert PR 处理，保留可追溯历史；数据或部署回滚另按项目手册执行。
- 紧急修复也走任务分支、PR 与 CI；例外须有用户明确授权并记录原因，不能由紧急措辞自行推导。

### 操作授权与发布

- 用户请求或已确认项目工作流授权时，才执行提交、推送、创建或合并 PR；一般修改请求不自动授权全部外部操作。
- 不擅自强推、删除分支或重写共享历史；合并后分支清理由明确授权或已确认的仓库自动清理设置执行。
- 合并、版本提交、Tag、GitHub Release、包发布和部署分别核对授权；合并不自动触发生产发布，除非已有明确工作流。
- 发布与恢复沿用本文件「应用发布」、[部署文档](DEPLOYMENT.md)及既有 `vX.Y.Z` 规则，不套用模板编号。

本项目差异：个人维护模式保留审批人数 0、两个现有必需检查与分支最新要求，详见下节「main 分支保护」。
合并后分支清理继续按该节和既有用户授权执行；Commit 不添加协作者署名行。
现有 CI 与 Docker 发布流程、应用/扩展版本约定均保持；未来任务分支改用用途前缀，替代旧的 `codex/` 默认值。

## main 分支保护

`main` 已启用个人维护模式的分支保护。所有变更（含管理员）通过短期分支创建 PR，两个 GitHub Actions 检查 `Lint, Test & Build` 和 `Playwright E2E (Core UI Flow)` 均成功、分支保持最新且讨论解决后才能合并。审批人数设为 0，个人维护者无需另一人批准自己的 PR；这不免除代码自查与 CI。强推和删除 main 均被禁止，不配置日常绕过。

依赖更新 PR 按实际差异审查并等待 CI；不能因为由机器人创建就批量合并。Issue 先定位、验证并通过对应 PR 交付，再按实际解决情况关闭。GitHub 页面中的数量只是待处理事项数量，不代表已确认缺陷。

该设置属于仓库管理配置，不在 Git 文件中自动生效；实际状态以 [main 保护设置](https://github.com/timorpic/Navelix/settings/branches) 为准。调整 CI job 名称时须同步更新 required checks，避免 PR 永久等待不存在的检查。Tag/Release 仍只对应通过验证的目标提交，Docker 构建继续全部在 GitHub Actions 执行。

合并成功后，删除对应本地与远程工作分支，并清理失效的远程引用。删除前核对 PR 已合并、提交已保留且分支未被其他工作树使用；不要删除未合并工作。仓库已启用 GitHub「合并后自动删除分支」，仍需回读远程状态并清理本地分支。

## 组件交付

当前组件随应用代码一起交付，没有独立组件发布命令。新增或修改组件需完成调用点接入、类型、样式及必要的交互验证，随应用版本发布。浏览器扩展有独立 `extension/manifest.json` 和说明，不能用应用版本号覆盖其版本策略。

## 应用图标资源

`public/logo.svg`、`extension/icons/icon.svg` 与全部 PNG 图标（`public/favicon/*`、`public/pwa/*`、`extension/icons/icon-*.png`）由同一份内联 SVG 生成，唯一入口是：

```bash
node scripts/render-icons.mjs
```

脚本需要本机装有 Chrome / Edge / Chromium；默认按系统常见路径与 `PATH` 自动探测，装在别处时用 `NAVELIX_BROWSER_PATH` 指定可执行文件。修改图标先改脚本内的 `SVG_CONTENT`，再重新运行，避免 SVG 与 PNG 不同步。`src/app/icon.svg` 是 Next.js 的约定图标（框架直接映射为 `/icon.svg`），不在脚本写入范围内，改动时需手工同步。

## README Logo 动画资源

中英文 README 使用 `public/navelix-logo.gif` 和 `public/navelix-logo-dark.gif`，按系统主题选择。`prefers-reduced-motion: reduce` 时使用原有 SVG。动画基于对应 SVG 源文件，4 秒循环、40 帧、透明背景；Navelix 字标及其绿色点缀沿竖轴左右翻转一圈，前后短暂停留，下方标语保持静止，白色圆球沿轨道环绕，徽标中央静态圆球为黄棕色 `#B8860B`，并伴随徽标轻微呼吸。

重建工具独立安装，不加入应用依赖或构建流程：

```bash
npm install --prefix /tmp/navelix-logo-tools --no-save --package-lock=false sharp@0.35.5 gifenc@1.0.3 opentype.js@2.0.0 @fontsource/inter@5.3.0
NAVELIX_LOGO_TOOLS=/tmp/navelix-logo-tools node scripts/render-readme-logo.mjs
```

脚本将 Inter 字形转为轮廓后渲染，不依赖系统安装字体；输出覆盖上述两张 GIF。GIF 仅支持单级透明度，边缘按 GitHub 浅色白底与深色 `#0D1117` 做抗锯齿处理；修改源 Logo 后需重建并检查两种主题和文字裁切。字体来自 `@fontsource/inter`（SIL OFL 1.1）。静态 SVG 仍用于网站与减少动态效果的场景。

迁移渠道文案与下次 Release 顶部引导见 [Sun-Panel 渠道材料](SUN-PANEL-CAMPAIGN.md)。

## 应用发布

版本真源为 `package.json`，更新日志真源为根目录 `CHANGELOG.md`。本地维护步骤：

```bash
node scripts/sync-version.mjs X.Y.Z
node scripts/sync-version.mjs
node scripts/sync-changelog.mjs
node scripts/sync-changelog.mjs --print
```

第一条中的 `X.Y.Z` 应替换为实际目标版本，会修改脚本列出的版本位置（`package.json`、`Dockerfile` 的 `NAVELIX_VERSION`、`build-info.ts` 的 `DEFAULT_VERSION`、`admin-system.ts` 的 `FALLBACK_VERSION`）；随后将 `[未发布]` 内容整理到相应版本章节，写明发布日期，再运行校验。锁文件如出现版本相关差异也需检查。

版本位置的清单以 `scripts/sync-version.mjs` 的 `PATTERNS` 为准，组件拆分或版本展示入口迁移后需同步更新该数组（含校验分支），否则校验会静默跳过。不要忽略校验失败。

发布操作：`node scripts/sync-changelog.mjs --publish` 会创建或编辑 GitHub Release，需要维护者授权和已登录的 `gh`。**该脚本只操作 Release，不会创建 git tag**——需先 `git tag vX.Y.Z` 并推送，否则 Docker 工作流的版本一致性闸门（Release tag == `package.json` version）会直接失败。tag 应指向准备发布的提交。

发布应用 Release 将触发源码质量检查、候选镜像构建、按 digest 的冒烟/旧库升级/生产 UI 验证；通过后才提升正式版本与 latest。手动触发与预发布不提升稳定标签。扩展 Release 使用独立 tag，工作流跳过不以 v 开头的非应用 Release。构建分发见 [REGISTRY](REGISTRY.md)，运行与回滚见 [DEPLOYMENT](DEPLOYMENT.md)。

## 中英文文案维护

- 新界面文案在 `messages/zh-CN.json`、`messages/en.json` 同时添加相同 key，客户端用 `useTranslations()`，服务端用 `getTranslations()`；完整句子使用 ICU 参数，避免直接拼接用户输入或动态生成 key。
- 展示层翻译静态标签，不翻译数据库中的用户标题、笔记、分类名或状态枚举。时间展示显式传入当前 locale，不改写业务日期。
- 现有辅助函数及后台通知的中文文案通过 `messages/source-index.json` 与 `messages/templates.json` 桥接。新增模板应锚定完整句子，默认保留参数原文；仅应用自己生成的嵌套标签可以声明 `translateValues`。新组件优先直接使用字典 key。
- `src/lib/__tests__/i18n.test.ts` 验证两份字典、ICU 参数、实际调用 key、旧语言兼容与格式化；个人 Telegram 测试验证收件人语言与原始任务标题。`e2e/i18n.spec.ts` 覆盖访客、跨设备个人设置、账号隔离、移动端及中文内容保留。
- 测试和构建使用独立 `NAVELIX_DATA_DIR`。中文和英文都需检查按钮长度、弹窗、空状态、错误提示与移动端布局。

构建入口先清理旧 standalone。当前 Next.js 的 instrumentation trace 不应用路由排除规则，入口会在构建后移除生成产物中的运行数据副本及其 trace 引用，并拒绝仍含主密钥、运行数据库或初始密码文件的产物；检查不读取密钥内容。
