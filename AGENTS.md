# 项目协作与代码开发规范

本文件是本仓库通用的协作规范单一事实来源（SSOT），适用于人工贡献者及编码助手。Claude Code 从 [CLAUDE.md](CLAUDE.md) 引用本文件；工具专属说明不得重复维护通用规则。

## 项目与事实来源

Navelix 是可自托管的个人数字工作空间，包含网址导航、项目与甘特图、日历待办、AI 助手和管理后台。它目前不是独立组件库。

- 产品边界：[PROJECT-SPEC](docs/PROJECT-SPEC.md)；架构：[ARCHITECTURE](docs/ARCHITECTURE.md)。
- 视觉规范：[DESIGN](DESIGN.md)；组件规范：[COMPONENT-GUIDELINES](docs/COMPONENT-GUIDELINES.md)。
- 开发与发布：[DEVELOPMENT](docs/DEVELOPMENT.md)；构建分发：[REGISTRY](docs/REGISTRY.md)；部署：[DEPLOYMENT](docs/DEPLOYMENT.md)。
- 版本号以 `package.json` 为准；命令以其 `scripts` 为准；样式实现以 `src/app/globals.css` 为准；Schema 和迁移以 `src/lib/db/`、`src/lib/migrations/` 为准。
- README 是项目入口，`docs/` 面向开发与维护，`wiki/` 面向使用与运维。发现冲突时核实实现并同步相关说明，不把规划写成已实现功能。

## 工作方式

1. 修改前检查工作区状态与相关调用链，保留已有未提交修改，不覆盖无关工作。
2. 先定位现有模块，再做满足需求的最小改动。未要求时不批量格式化、升级依赖或改变部署方式。
3. 将纯计算放入 `src/lib/`，状态和副作用放入 `src/hooks/`，展示放入组件，页面负责组装。
4. 对行为、配置、接口、数据结构或发布流程的修改同步维护对应文档；待发布变更写入 `CHANGELOG.md` 的 `[未发布]`。
5. 完成时说明修改范围、验证结果与未解决的问题；未执行的验证不能声称通过。

## 代码与边界

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
- Schema 修改同步更新首次建表与升级迁移，并验证历史库兼容性。避免在底层迁移模块引入 `db.ts` 单例造成导入环。
- 不提交 `data/`、`.env`、数据库、备份、初始密码、授权凭据或 EE 私有制品。遵守 [LICENSE](LICENSE)。

## 验证

常用检查：`pnpm typecheck`、`pnpm lint`、`pnpm test`、`pnpm build`。CI 还运行 `pnpm test:coverage` 和 `pnpm test:e2e`，详见开发文档。

行为修复增加能覆盖回归场景的测试；纯文档修改检查路径、链接、命令及事实一致性即可。测试、构建和启动可能初始化 SQLite，应设置独立的 `NAVELIX_DATA_DIR`，不使用真实业务库验证破坏性操作。
