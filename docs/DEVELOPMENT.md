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

pre-commit Hook 由 `simple-git-hooks` 生成，指向 `scripts/pre-commit.sh`。该脚本优先使用本机 `pnpm precommit`；本机没有 Node/pnpm 而存在 Docker 时，回退到 `node:24-alpine` 容器执行同一组检查（复用仓库内已安装的 `node_modules`，约半分钟）。两者都不可用时钩子以非零码失败，而不是静默放过——门禁默认为开，需要临时绕过时用 `SKIP_SIMPLE_GIT_HOOKS=1 git commit`。

Node 测试的 `src/**/*.test.ts` glob 已在脚本中加引号，由 Node 展开；不要去掉引号造成部分测试漏跑。测试使用串行配置以避免共享 SQLite 竞争。运行本地测试可先用系统临时目录隔离数据：

```bash
NAVELIX_DATA_DIR="$(mktemp -d /tmp/navelix-test.XXXXXX)" pnpm test
```

Playwright 配置自行创建临时数据目录，使用端口 3722 和专用初始管理员密码，禁止复用已运行服务。可用 `E2E_DATA_DIR` 指定专用测试目录，不要指向真实业务库。

## 变更工作流

1. 阅读 [AGENTS](../AGENTS.md) 和相关模块，检查工作区状态；如需新分支默认使用 `codex/` 前缀。
2. 明确行为、数据及权限边界，优先复用业务模块和组件；具体约定见 [COMPONENT-GUIDELINES](COMPONENT-GUIDELINES.md)。
3. Schema 变更同步新库初始化与有序升级迁移；多步写入加事务，并考虑备份与旧数据。
4. 行为修复添加有价值的回归用例，验证失败路径、用户归属和角色限制。
5. 按变更运行相关检查。提交代码前完成类型和 lint；合并前满足 CI 的覆盖率、构建及 E2E 检查。纯文档变更检查链接、路径和命令即可。
6. 更新相关文档、TODO 与 `[未发布]`，说明验证结果和已知限制，不改写历史发布事实。

CI 配置见 `.github/workflows/ci.yml`，镜像发布与冒烟测试见 `.github/workflows/docker.yml`。两条工作流中的 JavaScript action 均使用 Node.js 24 运行时，应用构建与测试由 `actions/setup-node` 配置为 Node.js 24；action 运行时版本与应用 Node.js 版本独立。本地 Hook 仅执行类型与 lint，不代表完整 CI 已通过。

## 组件交付

当前组件随应用代码一起交付，没有独立组件发布命令。新增或修改组件需完成调用点接入、类型、样式及必要的交互验证，随应用版本发布。浏览器扩展有独立 `extension/manifest.json` 和说明，不能用应用版本号覆盖其版本策略。

## README Logo 动画资源

中英文 README 使用 `public/navelix-logo.gif` 和 `public/navelix-logo-dark.gif`，按系统主题选择。`prefers-reduced-motion: reduce` 时使用原有 SVG。动画基于对应 SVG 源文件，4 秒循环、40 帧、透明背景；Navelix 字标及其绿色点缀沿竖轴左右翻转一圈，前后短暂停留，下方标语保持静止，白色圆球沿轨道环绕，徽标中央静态圆球为黄棕色 `#B8860B`，并伴随徽标轻微呼吸。

重建工具独立安装，不加入应用依赖或构建流程：

```bash
npm install --prefix /tmp/navelix-logo-tools --no-save --package-lock=false sharp@0.35.5 gifenc@1.0.3 opentype.js@2.0.0 @fontsource/inter@5.3.0
NAVELIX_LOGO_TOOLS=/tmp/navelix-logo-tools node scripts/render-readme-logo.mjs
```

脚本将 Inter 字形转为轮廓后渲染，不依赖系统安装字体；输出覆盖上述两张 GIF。GIF 仅支持单级透明度，边缘按 GitHub 浅色白底与深色 `#0D1117` 做抗锯齿处理；修改源 Logo 后需重建并检查两种主题和文字裁切。字体来自 `@fontsource/inter`（SIL OFL 1.1）。静态 SVG 仍用于网站与减少动态效果的场景。

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

发布 Release 将触发 Docker 工作流的镜像推送和冒烟检查；扩展 Release 使用独立 tag，但当前 Docker 工作流未按 tag 排除扩展发布，安排扩展发布前需核对触发策略，避免应用版本校验失败。构建分发见 [REGISTRY](REGISTRY.md)，运行与回滚见 [DEPLOYMENT](DEPLOYMENT.md)。
