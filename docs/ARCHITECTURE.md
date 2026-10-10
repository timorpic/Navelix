# 项目架构

## 技术栈与运行方式

项目为单个 Next.js App Router 全栈应用。当前依赖声明为 Next.js `16.3.8`、React `19.2.8`、Tailwind CSS 4、TypeScript 5；准确版本与依赖解析分别以 `package.json` 和 `pnpm-lock.yaml` 为准。

服务端使用 Node 内置 `node:sqlite` 的同步连接。认证、数据库、文件读写和后台任务要求 Node 运行环境，不能当作纯静态站点或仅 Edge 应用部署。生产输出为 `standalone`。

## 目录职责

```text
src/
├── app/                 # App Router 页面、布局、API 与全局样式
│   ├── (app)/           # 工作空间与个人管理后台；括号不进入 URL
│   ├── api/             # HTTP 路由处理器
│   ├── login/           # 登录
│   ├── register/        # 注册
│   └── share/           # 令牌分享页面
├── components/          # 工作空间组件与通用 UI
├── context/             # 用户数据、配置 Context 和消费 Hook
├── hooks/               # 界面状态、副作用与业务交互
├── lib/                 # 业务逻辑、安全、数据访问与纯计算
│   ├── client/          # 浏览器侧工具
│   ├── auth/            # 会话、Cookie、鉴权守卫等
│   ├── db/              # 连接、首次建表、种子与类型
│   ├── migrations/      # 历史版本升级与数据修复
│   ├── daemon/          # 定时维护任务模块
│   ├── ee-bridge/       # 商业驱动契约与 CE 降级
│   ├── monitor/         # 模型账号 OAuth 与提供方适配
│   └── __tests__/       # Node 测试；另有就近放置的测试
├── data/                # 随源码提供的种子链接
└── types/               # 共享业务类型
extension/               # 浏览器扩展，独立 manifest 版本
public/                  # Logo、图标、截图与 Service Worker 等静态资源
scripts/                 # 版本、更新日志与图标维护脚本
e2e/                     # Playwright 流程测试
wiki/                    # 用户指南、API 与运维手册
docs/                    # 开发与维护文档
```

运行目录 `data/` 与源码种子目录 `src/data/` 不同；前者不应进入 Git 或镜像。

## 页面和数据流

1. 根布局处理全局样式、主题初始化等；`(app)/layout.tsx` 获取会话和 Cookie，处理私有/公开访问。
2. 服务端通过 `getUserData()` 读取用户数据并进行敏感字段处理与 Pro 门禁，将初始数据注入 `NavelixProvider`。
3. 客户端通过 `@/context/navelix-context` 的 `useNavelixData()`、`useNavelixConfig()` 消费状态；Provider 协调更新与缓存，实时同步由 `use-realtime-sync.ts` 支持。
4. 写操作进入 `/api/*`，由 `src/proxy.ts` 执行 CSRF 保护，再由路由检查身份、角色和业务对象归属，调用 `lib/` 完成持久化。
5. 需要外部服务的操作由服务端代理处理；浏览器缓存不能作为持久化或授权真源。

API 处理器保持 HTTP 职责，复杂行为使用 `admin-*`、`todos-projects`、`notification-store` 等业务模块。客户端不能导入服务端运行时代码。

## 数据组织与迁移

`resolveDataDir()` 使用 `NAVELIX_DATA_DIR`，未设置时取 `<cwd>/data`。主库为 `navelix.db`，运行中可能出现 `navelix.db-wal` 与 `navelix.db-shm`。

`db/connection.ts` 创建目录、开启外键与 WAL、设置 5 秒 busy timeout，调用首次建表和迁移。`db.ts` 是数据访问入口之一，底层工具应避免反向依赖它导致初始化循环。

主要实体包括用户、会话、API Token、用户分类、链接、用户配置、项目、待办、通知、统计与审计记录；具体字段、外键与索引查阅 Schema。分类和链接等使用用户维度的复合标识，不能凭单独对象 ID 跨用户操作。

升级由 `migrations/versions/` 的有序迁移和 `PRAGMA user_version` 跟踪。新增字段同时考虑新建库与历史库，多步写入使用事务。迁移需要备份时优先使用显式传入数据库连接的 `db-backup-core.ts`，避免初始化导入环。

## 后台任务与商业扩展

`src/instrumentation.ts` 在 Node 运行时尝试挂载 `ee/dist/bundle.jsc`，随后启动守护任务。缺失商业驱动时使用 CE 实现；桥接注册表见 [REGISTRY](REGISTRY.md)，读取和写入门禁仍需要独立检查。

后台任务涵盖维护、备份、磁盘检查与模型刷新等。当前结构适合单服务配本地持久卷，不能直接假设多副本共享 SQLite 与定时任务具有分布式协调能力。

部署约束和备份说明见 [DEPLOYMENT](DEPLOYMENT.md)；更详细背景见 [Wiki 架构](../wiki/Architecture-系统架构与技术选型.md)。
