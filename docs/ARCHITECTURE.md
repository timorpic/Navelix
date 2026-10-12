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

主要实体包括用户、会话、API Token、用户分类、链接、用户配置、项目、待办、通知与审计记录；具体字段、外键与索引查阅 Schema。分类和链接等使用用户维度的复合标识，不能凭单独对象 ID 跨用户操作。

配置自 Schema v16 起按作用域分离：`system_settings` 保存站点品牌、AI、天气、社交主页、访问策略、代码注入、探针设置；`user_configs` 保存各账号的界面和功能偏好；`user_notification_settings` 按 `(user_id, channel)` 保存个人通知渠道。历史 `user_configs` 系统列暂留但停止业务读写，`global_config_user_id` 已移除。`getUserData()` 只合并系统字段与当前用户的个人字段，避免旧个人行覆盖全站值。系统写入要求管理员，通知渠道仅允许当前账号读写；系统事件发送时再次检查接收人的管理员身份。

个人 JSON 备份不包含系统配置与通知凭据；全站物理备份包含三个作用域。恢复先升级临时快照，再在事务内恢复业务与配置，执行 Pro 字段清洗；不恢复登录会话。密钥跨实例恢复仍需原加密主密钥。

升级由 `migrations/versions/` 的有序迁移和 `PRAGMA user_version` 跟踪。新增字段同时考虑新建库与历史库，多步写入使用事务。迁移需要备份时优先使用显式传入数据库连接的 `db-backup-core.ts`，避免初始化导入环。

## 后台任务与商业扩展

`src/instrumentation.ts` 在 Node 运行时尝试挂载 `ee/dist/bundle.jsc`，随后启动守护任务。缺失商业驱动时使用 CE 实现；桥接注册表见 [REGISTRY](REGISTRY.md)，读取和写入门禁仍需要独立检查。

后台任务涵盖维护、备份、磁盘检查与模型刷新等。当前结构适合单服务配本地持久卷，不能直接假设多副本共享 SQLite 与定时任务具有分布式协调能力。

部署约束和备份说明见 [DEPLOYMENT](DEPLOYMENT.md)；更详细背景见 [Wiki 架构](../wiki/Architecture-系统架构与技术选型.md)。

### Telegram 事件作用域

`user_notification_settings` 按账号保存加密渠道和显式订阅。`telegram.ts` 的 `sendUserTelegramNotification` 用于个人事件；`sendTelegramNotification` 用于系统事件，并在发送时复核管理员身份。本地与云端备份统一使用 `backup`，服务启动、磁盘／WAL、登录异常使用 `system`。

个人任务事件由 `personal-telegram.ts` 调度：任务指派随待办／项目事务写入 `telegram_deliveries`；到期提醒复用日历与待办的日期，在服务器本地时区当天 09:00 后入队。守护任务每分钟处理，使用持久化去重键、原子租约和最多三次重试，投递前重新读取任务与订阅。记录保存 30 天，随账号级联删除并包含于数据库快照还原。个人 JSON 导入在服务端提交后推送，浏览器导出完成通过仅允许固定操作的当前用户接口通知；正常自动保存不触发数据导入消息。

### 账号状态与鉴权

Schema v18 在 `users` 增加 `disabled`（0 启用、1 停用），已有账号默认启用。`admin-users.ts` 在用户修改事务中检查最后一个可用管理员，停用时原子撤销会话与个人 API Token 并记录审计。`auth/session.ts` 在浏览器会话、Bearer Token、续期及会话创建路径检查实时状态；密钥签发也通过条件写入防止停用后的并发签发。Telegram 个人和系统事件发送前排除停用账号。数据库快照随 users 行保存并还原状态，个人 JSON 不包含账号启停状态。

### EE 驱动诊断

启动加载器通过零数据库依赖的 `ee-bridge/load-state.ts` 保存制品缺失、已加载或失败分类；`getEEDriverStatus()` 同时读取实际存储／探针注册情况，区分完整、部分及未知状态。`GET /api/admin/license` 的 `eeDriverStatus` 仅向管理员返回状态、两项注册布尔值和固定失败分类，不暴露密钥、驱动对象或原始错误。Pro 页独立展示并允许刷新，驱动加载、镜像类型和许可证激活分别呈现；刷新只读取状态，修复制品后需重启服务。

Schema v19 移除使用事件采集、后台使用统计与匿名遥测周报。升级前对旧事件表创建物理快照，然后删除 `analytics_events` 及 `analytics_*`／`telemetry_*` 系统设置；旧快照恢复时也先迁移到当前结构。升级前备份仍可能包含历史事件，遵循现有备份保留策略。

后台 Pro 子菜单显示由全站布尔设置 `showProMenus`（`show_pro_menus`）控制，默认开启，不受许可证激活限制。配置沿用元数据生成首次建表与启动列补齐、全站默认值读取和系统设置持久化，旧实例无需手工变更数据库。导航中的 `pro` 标记统一控制徽章与子菜单过滤，一级 Pro 入口独立保留。

## 界面国际化

使用 next-intl 的请求配置与 `NextIntlClientProvider`，支持 `zh-CN`、`en`，不新增语言 URL 前缀。`src/i18n/request.ts` 按当前会话读取个人 `user_configs.language`；访客依次使用 `navelix_locale` Cookie、Accept-Language、中文默认值，公开工作空间的所有者语言不影响访客。历史 `zh` 读取时规范为 `zh-CN`，不需要新增数据库列。

`POST /api/user/locale` 接受 `{ "language": "zh-CN" | "en" }`，登录时只更新当前账号，访客仅写 Cookie，沿用 API 写请求的 CSRF 保护。语言切换成功后刷新服务端组件，使 HTML 的 `lang`、SSR 文案和客户端字典一致。个人配置仍由 `NavelixProvider` 协调，不创建独立用户状态。

字典在 `messages/`；`useTranslations()` / `getTranslations()` 用于界面，`useText()` / `translateText()` 用于现有业务展示文案及已知模板的桥接。用户标题、笔记、分类、自定义品牌与历史存储枚举不随语言改写。日期显示传入 locale，不改变任务日期和服务器时区的调度规则。AI 请求传入输出语言要求；Telegram 在发送时读取各收件人的个人语言。错误 JSON 保留旧 `error`，追加稳定 `code` 和本地化 `message`，客户端优先显示 `message`。

新账号自主注册时继承注册页面的访客语言；管理员创建的账号默认中文，用户可登录后自行切换。

### 工作区一致性与资源边界

历史 v5 表重建使用 `BEGIN IMMEDIATE`，取得写锁后复查版本，并在同一事务内推进版本；重建失败会回滚并阻止继续升级。迁移编排每步读取当前版本，版本推进在写事务内保持单调，避免多个 Next.js worker 使用旧启动快照重复重建或回退版本。

`getUserData()` 为只读聚合，不再根据分类为空重新播种。示例数据由初装管理员、自主注册和管理员创建账号路径显式初始化；历史账号允许空工作区，不会在升级时自动恢复示例内容。

待办使用 `(id, user_id)` 复合身份。`todo-store.ts` 是 SSR、Provider 与待办列表 API 的共同查询入口，包含本人和被指派任务，兼容历史 `assigned_to` 并优先使用 `assignee_id`。浏览器写操作通过 `ownerId` 查询参数指定所有者；未指定时仅允许唯一可访问目标，删除仍要求创建者。领域写入显式传入所有者，不依赖对象 ID 全局唯一。

团队共享分类和链接使用包含所有者的展示 ID，并保留 `sourceId`、`ownerId`、`isSubscribed`。这些标识只用于展示，订阅接口仍接收原始分类 ID。读取时再次检查共享状态；普通个人保存过滤共享条目。关闭共享不会追溯删除用户在历史版本中已复制或自行导入的个人数据。

`workspace-revision.ts` 对当前用户自己的分类、链接、项目和待办生成内容摘要。`GET /api/user/data` 返回 `revision`；包含任何实体数组的 `POST` 必须提交 `expectedRevision`，事务内检查过期或缺失版本，冲突返回 409，不执行替换。纯配置补丁不需要此字段。Provider 串行保存本地快照、合并刷新，失败时停止该批后续快照并重新读取。客户端外部新增、AI 和 API 写入会通过内容变化自动使旧摘要失效，无需新增 Schema。

`safeFetch()` 用 Node HTTP(S) 传输将实际 socket 连接绑定已检查的地址，同时保留原域名 Host 与 TLS SNI；每次重定向重新校验。它返回有大小限制的缓冲 Response，默认解压后最多 2 MiB，可通过 `maxResponseBytes` 调整。总截止时间覆盖 DNS、重定向与正文读取；跨来源跳转移除 Authorization/Cookie，遵循 POST 重定向转 GET 语义，并保留调用方取消信号。图标模块仍保留自身更小的页面/图标大小限制。

AI 删除请求按账号及对话隔离，确认必须精确匹配服务端签发的确认文本；取消会清理待删状态。请求保存在进程内，五分钟过期；重启后需重新请求删除。
