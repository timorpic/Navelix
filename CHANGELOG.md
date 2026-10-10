# 📋 更新日志 (Changelog)

本项目所有值得注意的变更都会记录在此文件中。

- 格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)
- 版本号遵循 [语义化版本 (SemVer)](https://semver.org/lang/zh-CN/)
- 发版时将对应章节同步到 GitHub Release：`node scripts/sync-changelog.mjs --publish`

> 说明：仓库自 **v2.8.7** 起才有 tag 记录，更早的 v2.8.1 – v2.8.6 已并入文末「早期版本」一节。

---

## [未发布]

### 安全
- 升级 `next` 16.3.4 → 16.3.8，修复 next/og ImageResponse 远程代码执行漏洞（critical）及多项安全公告
- 升级 `sharp` → 0.35.5（librsvg CVE-2026-96889）、`source-map-js` → 1.2.2、`brace-expansion` → 1.1.21 / 5.0.12，清除全部依赖告警
- **修复登录限流可被伪造 `X-Real-IP` 绕过**：未开启 `TRUST_PROXY` 时不再采信任何客户端可伪造的 IP 头。此前攻击者每次请求换一个 `X-Real-IP` 即可获得全新限流桶，使登录锁定与失败告警同时失效

### 修复
- **EE 字节码加载失败时静默退回 CE**：`ee/dist/bundle.jsc` 是 V8 字节码，与编译时的 Node/V8 版本强绑定，跨版本加载会抛 `cachedDataRejected`。此前该错误只打印一句与「本就没有 EE 制品」几乎相同的 warning 就继续运行，运维无法分辨「CE 构建」与「带了 EE 制品但加载失败」。现两种情况分别给出日志，加载失败时额外点名版本不匹配与重新编译方法
- **PWA「快速记待办」快捷方式失效**：`manifest.ts` 声明的 `?action=quick-add-todo` 此前无任何处理分支，点击无反应。新增 `AddTodoModal` 并接入快速采集层
- **登录页密码恢复文案错误**：原文案称设置 `NAVELIX_ADMIN_PASSWORD` 并重启即可重置，实际该变量仅在首次初始化或密码仍为 `admin123` 时生效
- **`docker-compose.yml` 容器名与 watchtower 不匹配**：`container_name` 为 `rA9-timorpic-navelix` 而 watchtower 参数为 `navelix`，导致自动更新静默失效；现统一为 `navelix`
- **自动备份调度器为死代码**：`scheduleAutoBackup()` 无任何调用方，免费版实际没有定时备份。现接入守护进程每 24 小时检查一次，节流依据改为磁盘上最新快照的 mtime（避免备份失败被静默吞掉、并与云备份共享同一份快照）
- **EE/Pro 门禁在 SSR 路径上失效**：`(app)/layout.tsx` 直接调用 `getUserData()`，绕过了 API 侧唯一的 Pro 字段降级收口，导致开源社区版（CE）下自定义脚本/CSS、品牌定制、探针开关仍会随服务端渲染下发。门禁逻辑现下沉至 `lib/ee-gate.ts`，SSR 与 API 两条读取路径行为一致
- **级联删除用户缺少事务**：`DELETE /api/admin/users` 原为 10 条裸 DELETE 逐条提交，中途失败会留下半删状态（用户已删、其项目仍在）。现下沉至 `lib/admin-users.ts` 的 `deleteUserCascade()` 并用 `BEGIN IMMEDIATE` 事务包裹；同时补齐 `analytics_events` 孤儿行清理（该表无外键约束，此前删用户后残留遥测数据），`audit_logs` 则刻意保留作为合规证据
- **启动期静态导入环**：`db/connection.ts → migrations → v11 → db-backup → db` 形成导入环（`db-backup` 经 `db`/`audit`/`system-settings` 三条路径绕回）。此前不炸仅因该文件未在顶层解引用 `db`，任何人在顶层加一行 SQL 即会导致启动崩溃。现拆出不依赖 `db.ts` 的纯备份内核 `lib/db-backup-core.ts`，由调用方以参数传入 `db`，环被彻底切断
- **`db-backup` 拆分后丢失提前返回语义**：同名快照已存在时应直接复用、不重复写审计日志与发通知；拆分过程中该分支一度丢失，已修复并补测试锁定
- **AI 路由 URL 拼接漂移**：`ai/summarize` 的 `chat/completions` 拼接写法与其他三个 AI 路由不一致（用正则 replace 而非 `endsWith` 判断），已统一
- **待办改换项目时项目时间戳不刷新**：`PATCH /api/todos/[id]` 只在**原**项目非空时刷新那一个项目的 `updated_at` —— 待办从项目甲移到项目乙后，乙的时间戳不动，甲却无谓地变了。现同时刷新新旧两个项目
- **待办/项目写路径缺事务**：`PATCH /api/todos/[id]`（更新待办 + 刷新项目时间戳）与 `DELETE /api/projects/[id]`（删项目 + 删子任务）原为多条裸写语句逐条提交，中途失败会留下半改状态；「AI 拆解一键保存」的里程碑同步（增/改/删）同样如此。三处一并下沉至 `lib/todos-projects.ts` 并用 `BEGIN IMMEDIATE` 事务包裹
- **个人资料修改缺事务**：`PATCH /api/auth/profile` 把「改密码」与「改资料」写成两组独立 UPDATE —— 密码已改而资料更新失败时会留下半改状态，且失败响应会让人以为什么都没变。现下沉至 `lib/profile.ts` 并包入事务；校验（头像协议 / 原密码 / 长度）全部前移到写入之前，校验失败不再产生任何副作用

### 变更
- **测试门禁此前形同虚设**：`src/**/*.test.ts` 的 glob 在 bash/zsh（`globstar` 默认关闭）下只展开一层，25 个测试文件里仅执行 1 个，覆盖率阈值从未生效。改为引号包裹交由 Node 原生展开，并加 `--test-concurrency=1`（测试共用同一 SQLite 库，并行会竞争）。测试数从 107 增至 **491**，覆盖率 88.9% 行 / 88.4% 函数；E2E 从 2 个用例增至 7 个
- **抽共享门禁 `lib/ee-gate.ts`**：同一套 Pro 降级规则此前在 5 处各写一遍，现收敛为 `getProFeatureFlags()` + `applyEEGateToConfig()` 两个入口（写/还原路径保留各自的 SQL 级实现，仅取用共享标志位）
- **`GET /api/user/data` 改为复用 `getUserData()`**：此前该 handler 用 175 行逐表重写了 `lib/user-data.ts` 已有的查询，而**同一文件的 POST 却正确复用了 `saveUserXxx`**。现两条路径共用同一实现；返回值随之补齐 `user` 字段与订阅团队分类（`src/types` 中这些字段均为可选，前端兼容）
- **抽 `lib/auth/guard.ts`**：`requireAdmin` 此前在 5 个 admin 路由各自定义一遍（其中 `admin/users` 版本返回 `false` 而非 `null`，签名不一致），另有 11 处内联角色判断。现统一为单一实现，沿用 `csrf.ts` 的约定（lib 层不构造 `NextResponse`，文案与状态码留在调用点，因此各路由的差异化错误文案保持不变）
- **抽 `lib/ai-provider.ts`**：4 个 AI 路由各自重写「读 `ai_*` 三列 + 默认值 + 解密 + 拼 URL」，现统一为 `resolveAIConfig()` / `validateAIBaseUrl()`
- **抽 `useToast()` 与 `Toast` 组件**：`flash` 在 7 个 admin 文件各写一遍（其中一处时长为 3200ms、一处多包 `useCallback`），`notify` 在 5 个文件各写一遍。新实现用 ref 跟踪定时器，修掉「连续两次提示时第一次的定时器提前清掉第二条消息」的竞态，并在卸载时清理
- **统一 7 处原生 `confirm()` 为 `ConfirmDialog`**：新增 Promise 风格 `useConfirm()` hook，避免在各调用点各加一对 state；`ConfirmDialog` 补 `onCancel`/`cancelLabel` 并支持异步 `onConfirm`（此前 `onConfirm(); onClose();` 不会 await 异步，弹窗会在请求完成前关闭）
- **`model-monitor-widget` 接入同目录 types/utils**：此前重复定义了 6 个 interface（`WidgetAccount` 是 `MonitorAccount` 的严格子集）与 2 个逐字相同的函数
- **`license.ts` 增加验签结果缓存**：`getUserData()` 下沉门禁后每次 SSR 渲染都会触发 Ed25519 验签，现缓存**成功**结果（纯函数、无需失效；只缓存成功可保证缓存有界，伪造 token 不会撑大缓存），命中时仍复检到期时间
- **拆分巨石组件**（本轮共 12 个文件、约 14000 行，纯重构，行为不变）。统一手法：纯算法下沉 `lib/`（可单测）→ 状态与副作用进 `hooks/` → 视图拆为只接收 props 的展示组件 → 原文件退化为拼装层：
  - `workspace-overview-columns.tsx` 811 → 46 行：抽出 `project-overview-column.tsx`、`schedule-overview-column.tsx` 与共享的 `use-workspace-todos()`
  - `sidebar.tsx` 736 → 555 行：时钟/天气/表盘小部件整块抽出为 `clock-weather-widget.tsx`（自带定时器与天气拉取，与侧边栏导航本无关联）
  - `calendar-view.tsx` 1457 → 979 行：三个互不相关的弹窗拆为 `ical-export-modal.tsx`、`ai-schedule-modal.tsx`、`schedule-edit-modal.tsx`，AI 排程的 6 个 state + 6 个 handler 收敛为 `use-ai-schedule()`
  - `projects-view.tsx` 1501 → 709 行：甘特图视界拆为 `project-gantt-view.tsx` + `use-gantt()`，AI 拆解草稿拆为 `ai-breakdown-card.tsx` + `use-ai-breakdown()`
  - `recent-activities-card.tsx` 1002 → 93 行：来源识别/筛选/分页下沉 `lib/recent-activities.ts`，状态进 `use-recent-activities()`，界面拆为 header / filter-bar / table / detail-modal
  - `admin-profile-tab.tsx` 1219 → 100 行：拆为 7 张卡 + 2 个弹窗与 3 个域 hook，校验与响应解析下沉 `lib/admin-profile.ts`
  - `admin-pro-tab.tsx` 1018 行、`admin-system-tab.tsx` 929 行、`admin-links-tab.tsx` 764 行：同样按卡片拆分
  - `admin-analytics-tab.tsx` 614 → 499 行：事件中文名映射、概览卡组装与趋势缩放下沉 `lib/analytics-dashboard.ts`
  - `admin-personalization-tab.tsx` 532 → 473 行：预览宽度映射、状态文案与 6 个侧边栏开关下沉 `lib/admin-personalization.ts`（「缺省即开启」这条约定此前只体现在 6 处内联的 `!== false` 里，现为单一出处并有测试锁定）
- **`scripts/sync-version.mjs` 随组件拆分失效**：该脚本负责把 `package.json` 的版本号同步到各展示位置，其中一个目标是 `admin-system-tab.tsx` 里内联的 `: "v2.9.5"`。后台拆分后这个兜底版本号迁到了 `lib/admin-system.ts` 的 `FALLBACK_VERSION`，脚本的查找与校验两处正则都会落空（校验静默不报、同步静默跳过）。现两处一并指向新位置，并实测校验/同步两个模式
- **云端快照还原的 Pro 字段清洗在事务之外**：`admin/storage` 的还原流程先 `COMMIT` 表拷贝、再执行门禁清洗，一旦清洗失败，快照已落库且未清洗，而 catch 里的 `ROLLBACK` 因无活动事务会再抛 `cannot rollback - no transaction is active`，把真实错误盖掉。现清洗移入同一事务
- **本地备份还原的门禁清洗失败会谎报「还原失败」**：清洗刻意排在 `COMMIT` 与 `runMigrations` 之后（迁移可能重建 `user_configs`，清洗必须先于迁移会失效），因此失败时数据其实**已经还原**。此前统一报 500「数据库恢复失败」，会误导管理员重试覆盖。现单独捕获、写审计日志，并明确告知「已还原但清洗失败」
- **`POST /api/admin/backup` 把客户端错误报成 500**：`req.formData()` 在 Content-Type 不对时抛错，与该路由的还原逻辑共用一个 catch，于是「上传格式不对」被报成「数据库恢复失败」。现解析阶段单独处理并返回 400
- **DAL 层继续下沉**（路由内 `db.prepare` 从 40 处降至 13 处）：
  - `lib/auth/api-tokens.ts` —— Token 签发/列举/撤销。此前**校验**在 `auth/session.ts`、**管理**在路由里，同一张表两处维护；`sessions/route.ts` 还自带第三份 `hashToken` 副本，现摘要算法只有一处定义
  - `lib/auth/sessions.ts` —— 活跃设备列举与撤销；`admin-profile.ts` 里结构相同的 `SessionRow`/`ApiTokenRow` 改为别名引用
  - `lib/todos-projects.ts` 扩充 —— `createTodo` / `createProject` / `updateProject` / `rolloverOverdueTodos`
  - `lib/notification-store.ts`、`lib/profile.ts`（见上）
  - 剩余 13 处为单语句、诊断查询（healthz 的 `PRAGMA`）或已自带事务的写入（注册、备份还原），无事务缺口
- **补上组件测试**：仓库此前 **0 个 `*.test.tsx`**。测试用 `node --experimental-strip-types` 运行、不转换 JSX，因此新增 `helpers/tsx-loader.ts` 在运行时用 esbuild（本就是 Dockerfile 编译 EE 字节码的依赖）编译组件，配合 jsdom + react-dom 渲染。已覆盖 `Overlay`/`Toast`/`AiBreakdownCard`/三个弹窗/`ProjectGanttView` 等拆分产物（41 个用例）
- **E2E 新增 `refactor-coverage.spec.ts`**：拆分只保证类型对得上，界面拼装是否正确需真实浏览器验证。5 个用例分别覆盖数据看板统计、甘特图尺度切换、AI 排程弹窗、侧边栏小组件、活动卡片筛选
- **`src/lib/` 下的客户端模块迁至 `src/lib/client/`**：`client-analytics.ts`、`link-usage.ts`、`notifications.ts` 都带 `"use client"` 且只被客户端组件/hook 引用，却与 40 余个服务端模块混放在同一目录，容易被误当作服务端代码导入（此前 `lib/admin-links.ts` 就有过这种引用）。现按执行环境分目录
- **通知读写下沉 `lib/notification-store.ts`**：`notifications` 表的行映射（`read: 0/1` ↔ 布尔、`source` 兜底 `system`）此前在三个路由各写一遍（GET 用 `toNotification`、POST 又手工拼了一次返回体、`[id]` 路由自维护字段白名单），现收敛为单一来源
- **甘特图时间轴算法下沉 `lib/gantt.ts`**：多尺度时间轴构建、条块定位、项目跨度计算此前内联在组件里无法测试，现为纯函数并补 16 项单测（覆盖三种尺度、越界贴边、非法日期、跨度并集）
- **抽 `lib/share-link.ts`**：免登录分享链接的「申请 token → 写剪贴板」流程此前在 4 个组件各写一遍且文案漂移出 3 种写法，现收敛为 `copyShareLink()`
- **统一 11 处 `alert()`**：分享链接复制（4 处）改用 `useToast()` + `Toast`；AI 排程/拆解的校验与失败提示改为组件内联提示（新增 `warning` 状态）。`admin-pro-tab` 的「还原成功」提示**刻意保留 `alert()`** —— 其后紧跟 `window.location.reload()`，Toast 会来不及被看到
- **`api_tokens` / `user_category_subscriptions` 建表语句去重**：`db/schema.ts` 与 `migrations/schema.ts` 此前各持一份逐字相同的 DDL，现抽为共享常量（与 `user-config-columns.ts` 的元数据驱动同一思路）

### 文档
- 中英文 README Logo 改为深浅色自适应的透明循环 GIF，包含白色轨道圆球、黄棕色静态圆球、徽标呼吸与 Navelix 文字左右翻转动画，增加减少动态效果时的 SVG 回退和独立重建脚本。
- 补齐项目协作规范、Claude Code 上下文、视觉设计与开发计划，以及 `docs/` 下的产品规格、架构、组件、页面、开发发布、构建分发和部署说明；README 增加开发文档导航与环境要求，明确当前无独立组件 registry。
- wiki FAQ 新增「仓库维护与依赖升级」章节：记录 Dependabot PR 触发 pnpm 供应链门禁（`ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`）的排查与修复流程
- pre-commit Hook 改为走 `scripts/pre-commit.sh`：钩子此前硬编码 `pnpm precommit`，在无 Node/pnpm 的环境以 127 失败，只能 `SKIP_SIMPLE_GIT_HOOKS=1` 整体跳过门禁。现本机有 pnpm 时照常执行，没有而有 Docker 时回退到 `node:22-alpine` 容器执行同一组检查（复用仓库内 `node_modules`），两者都没有才失败；`DEVELOPMENT.md` 补充说明与绕过方式
- README 文档表格补充 CHANGELOG 入口
- **全量文档与代码一致性修订**（根目录 + wiki 共 14 份）：
  - **移除已不存在的功能描述**：番茄钟（实际只有被动式专注时长统计）、自定义/多引擎搜索（搜索配置已在迁移 v10 删除，现为系统内全类型搜索）、前台书签星标按钮、日历 Webcal 订阅 UI（界面只有下载，且为单向导出）、FAQ 中的「(✓ 服务端已保存)」密码框
  - **修正失效指引**：管理员密码恢复（`NAVELIX_ADMIN_PASSWORD` 仅在初装或密码仍为 `admin123` 时生效）、主密钥轮换 SOP（系统无「全库重新加密」工具，换钥会导致凭据静默失效）、`NAVELIX_IMAGE_REPO` → `NAVELIX_GITHUB_REPO`、`DATABASE_PATH` → `NAVELIX_DATA_DIR`、源码部署的 Node/pnpm 版本要求
  - **REST API 文档**：修正 `rollover` 响应字段（`count` 而非 `updatedCount`）、移除不存在的 `daysOffset`、`done` 为布尔值、`/api/user/data` 补 `todos`、通知接口改为 `PATCH /api/notifications/{id}`、补充 CSRF/Origin 约束与 Bearer 自我续期风险，并新增「扩展接口一览」
  - **安全文档**：按实现修正限流范围（仅 2 个接口）与 `X-Real-IP` 绕过风险、SSRF 对 favicon/AI 端点放行私有网段、CSRF 豁免只校验头部存在性、注入字段无 HTML 净化且 SSR 路径不脱敏
  - **架构文档**：密码哈希更正为 scrypt、代理层职责更正（仅 `/api/**`、不鉴权限流）、补全 14 张表、迁移「无损」表述改为如实描述
  - 补齐此前未记载的能力：消息通知中心、Telegram 告警、数据看板、专注统计、Copilot 工具调用、书签笔记与 AI 摘要、Pro 门禁说明

---


## [2.9.5] - 2026-09-15

### 变更
- 版本发布（打包与镜像重新构建，内容同 v2.9.4）

## [2.9.4] - 2026-09-11

### 安全
- 升级存在安全漏洞的依赖（`next` 16.3.1 → 16.3.4、`eslint-config-next` 同步），并同步调整 Dockerfile

## [2.9.3] - 2026-09-11

### 新增
- 恢复个人 AI Copilot 配置能力（后台）

## [2.9.2] - 2026-09-02

### 变更
- 版本发布（内容同 v2.9.1）

## [2.9.1] - 2026-09-02

### 修复
- 首页「今日聚焦」改为按分钟实时更新；修复「进行中项目」数量卡在 1 的问题
- 分析报告超时从 10 秒提高到 30 秒，并支持 `NAVELIX_ANALYTICS_TIMEOUT_MS` 环境变量配置

### 文档
- 主 README 增加浏览器扩展下载链接

## [2.8.13] - 2026-08-23

### 新增
- `/healthz` 健康诊断、SQLite WAL 监控、Playwright E2E 测试基建

### 变更
- 匿名遥测透明化：明确披露采集范围并新增后台开关
- `user_configs` 表结构与字段映射改由元数据驱动

## [extension-v1.1.0] - 2026-08-23

### 变更
- 浏览器扩展：更新弹窗布局、品牌 Logo 主题自适应、刷新官方图标；README 补充 zip 下载链接

## [2.8.12] - 2026-08-22

### 变更
- 更新检查文案调整为「Release 最新 vX.Y.Z」

## [2.8.11] - 2026-08-22

### 新增
- 可选加入的匿名使用统计与每周匿名报告（默认关闭，后台可开关）
- 项目长期记忆文档 `MEMORY.md`

### 变更
- 数据库迁移体系拆分为 `versions/` 注册表；分享令牌派生、SSRF 防护与数据层加固
- `tsconfig` 排除 `ee/` 目录；CI 工作流、Docker 文档与英文 README 更新

### 修复
- Docker 环境探测改用 `/.dockerenv`；看板新增部署聚合统计

### 文档
- wiki 模块总览、架构与使用手册更新

## [2.8.10] - 2026-08-21

### 新增
- Telegram 机器人通知（备份完成与系统告警）
- 链接图标多源回退抓取（全球高可用开放 API）
- 毛玻璃效果：四档模糊选择器 + 显式关闭按钮；右侧栏组件开关与新版小组件
- 后台「个性化偏好」页精确布局实现

### 变更
- 后台设置改为即改即存；图标渲染改为透明纯底样式

### 修复
- 模糊强度选择器的点击热区与分段控件体验

## [2.8.9] - 2026-08-21

### 新增
- 毛玻璃效果并入壁纸卡片设置，新增内容区宽度配置

### 修复
- 折叠侧边栏图标居中显示，并消除横向滚动条

## [2.8.8] - 2026-08-21

### 变更
- `db.ts` 与 `auth.ts` 按职责拆分为 `db/`、`auth/` 子模块（纯重构，无行为变更）
- ESLint 忽略 `ee/**` 并清理未使用变量

## [2.8.7] - 2026-08-21

### 新增
- 浏览器扩展：弹窗布局更新、品牌 Logo 主题自适应、官方图标刷新

### 变更
- EE/Pro 模块（bytenode 字节码）：统一收敛到 `ee/` 目录编译打包，保证 Docker 镜像内零 `.ts` 源码
- 修复 ESM 环境下 `bundle.jsc` 的加载链路（`createRequire` / `pathToFileURL` / 绕过 Turbopack AST 分析）
- Docker 镜像标识：未激活时统一显示「免费版（可激活 Pro）」
- CI：EE 模块改由私有仓库克隆注入

## [早期版本 v2.8.1 – v2.8.6] - 2026-08-21

> 该阶段尚无独立 tag 记录，以下为仓库初始导入时的主要变更汇总。

### 变更
- 初始历史导入（v2.8.1 起）：EE/Pro 字节码加载与 Docker 多阶段构建定型
- CI 冒烟测试持久化校验、EE 模块注入方式调整

---

[未发布]: https://github.com/timorpic/Navelix/compare/v2.9.5...HEAD
[2.9.5]: https://github.com/timorpic/Navelix/compare/v2.9.4...v2.9.5
[2.9.4]: https://github.com/timorpic/Navelix/compare/v2.9.3...v2.9.4
[2.9.3]: https://github.com/timorpic/Navelix/compare/v2.9.2...v2.9.3
[2.9.2]: https://github.com/timorpic/Navelix/compare/v2.9.1...v2.9.2
[2.9.1]: https://github.com/timorpic/Navelix/compare/v2.8.13...v2.9.1
[2.8.13]: https://github.com/timorpic/Navelix/compare/v2.8.12...v2.8.13
[extension-v1.1.0]: https://github.com/timorpic/Navelix/releases/tag/extension-v1.1.0
[2.8.12]: https://github.com/timorpic/Navelix/compare/v2.8.11...v2.8.12
[2.8.11]: https://github.com/timorpic/Navelix/compare/v2.8.10...v2.8.11
[2.8.10]: https://github.com/timorpic/Navelix/compare/v2.8.9...v2.8.10
[2.8.9]: https://github.com/timorpic/Navelix/compare/v2.8.8...v2.8.9
[2.8.8]: https://github.com/timorpic/Navelix/compare/v2.8.7...v2.8.8
[2.8.7]: https://github.com/timorpic/Navelix/releases/tag/v2.8.7
