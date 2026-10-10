# 开发与发布流程

## 环境准备

以 `package.json` 的 engines 和 packageManager 为准：Node.js 至少 `22.5.0`，项目使用 `pnpm@11.16.0`。建议使用持续更新的 Node 22 补丁版，以兼容内置 SQLite、Node 测试与 TypeScript 类型擦除参数；CI 使用 Node 22。

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

CI 配置见 `.github/workflows/ci.yml`。本地 Hook 仅执行类型与 lint，不代表完整 CI 已通过。

## 组件交付

当前组件随应用代码一起交付，没有独立组件发布命令。新增或修改组件需完成调用点接入、类型、样式及必要的交互验证，随应用版本发布。浏览器扩展有独立 `extension/manifest.json` 和说明，不能用应用版本号覆盖其版本策略。

## 应用发布

版本真源为 `package.json`，更新日志真源为根目录 `CHANGELOG.md`。本地维护步骤：

```bash
node scripts/sync-version.mjs X.Y.Z
node scripts/sync-version.mjs
node scripts/sync-changelog.mjs
node scripts/sync-changelog.mjs --print
```

第一条中的 `X.Y.Z` 应替换为实际目标版本，会修改脚本列出的版本位置；随后将 `[未发布]` 内容整理到相应版本章节，写明发布日期，再运行校验。锁文件如出现版本相关差异也需检查。

当前工作区重构后，版本脚本仍匹配 `admin-system-tab.tsx` 中的旧版本字面量位置，而回退版本已迁移至 `src/lib/admin-system.ts` 的 `FALLBACK_VERSION`。发布前需核对并更新脚本目标；不要忽略校验失败或假定版本同步已经覆盖新的显示入口。

发布操作：`node scripts/sync-changelog.mjs --publish` 会创建或编辑 GitHub Release，需要维护者授权和已登录的 `gh`。Release tag 必须与应用版本一致（允许 `v` 前缀），且应指向准备发布的提交。

发布 Release 将触发 Docker 工作流的镜像推送和冒烟检查；扩展 Release 使用独立 tag，但当前 Docker 工作流未按 tag 排除扩展发布，安排扩展发布前需核对触发策略，避免应用版本校验失败。构建分发见 [REGISTRY](REGISTRY.md)，运行与回滚见 [DEPLOYMENT](DEPLOYMENT.md)。
