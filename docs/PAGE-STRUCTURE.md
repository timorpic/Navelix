# 页面与视图结构

## 路由地图

| URL | 实现位置 | 职责与访问条件 |
| --- | --- | --- |
| `/` | `src/app/(app)/page.tsx` | 工作空间；私有模式需登录，公开模式按主用户配置展示 |
| `/admin` | `src/app/(app)/admin/page.tsx` | 个人管理后台，布局要求登录，具体功能按角色限制 |
| `/login` | `src/app/login/page.tsx` | 登录与登录后跳转 |
| `/register` | `src/app/register/page.tsx` | 注册入口，实际可用性以注册策略为准 |
| `/share/[type]/[id]` | `src/app/share/[type]/[id]/page.tsx` | 分享内容页，按分享令牌和对象有效性验证 |
| `/api/*` | `src/app/api/` | 数据与集成接口，不是页面 |

`(app)` 是路由分组，不出现在 URL。根布局 `src/app/layout.tsx` 与分组布局负责公共初始化；分组布局注入 SSR 用户数据和 Provider，后台布局追加登录检查。

## 首页组成

外层为 `Sidebar`、可伸缩的主内容和 `RightSidebar`；主内容组合欢迎区、统计、搜索、快捷访问、工作概览、活动或分类卡片等，具体呈现受配置和当前视图控制。`QuickCaptureLayer` 处理快捷采集入口，安全引导和操作反馈按状态展示。

首页不是每个功能一个独立路由，`tab` 查询参数选择视图，兼容旧的 `category` 参数：

| 示例 | 视图/组件 |
| --- | --- |
| `/` 或 `/?tab=all` | 全部链接与首页组合内容 |
| `/?tab=<分类ID>` | 分类链接，`CardGrid` 等 |
| `/?tab=feature-calendar` | `CalendarView`，日程编辑、AI 排程与 ICS 导出弹窗 |
| `/?tab=feature-projects` | `ProjectsView`，甘特图和 AI 拆解卡片 |
| `/?tab=feature-dashboard` | `DashboardView` |
| `/?tab=feature-activities` | `RecentActivitiesCard` 及其筛选、表格、详情弹窗 |

修改导航时同时验证直接打开 URL、刷新和浏览器前进后退，保持默认视图与查询参数兼容。

## 管理后台组成

后台以 `AdminSidebar` 和功能内容区组织，支持 `/admin?tab=system` 一类深链。顶部通用统计卡片仅在链接、分类和快捷访问管理页显示，项目、日程、账号、日志及设置页不显示。有效 tab 包括：

- 内容：`links`、`categories`、`quickAccess`、`projects`、`schedules`。
- 管理功能：`users`、`pro`（历史 `auditLogs` 链接兼容日志中心的审计视图），其中账号管理、审计及 Pro 配置仅管理员可访问。
- 系统设置（仅管理员）：`site`（站点与服务，含页脚、社交主页、AI 与天气）、`access`（访问与安全）、`proSystem`（系统功能，含品牌定制、云备份、自定义代码与链接探针）、`logs`（日志中心，按八类功能筛选）、`system`（数据与维护）。
- 用户设置：`profile`（个人与偏好，含资料、头像、语言、界面与功能、Telegram 通知）、`account`（账号与数据，含密码、会话、API Token 和个人导入导出）、`proUser`（用户功能预留页面）。

桌面采用可折叠二级菜单，系统设置与用户设置可独立展开或折叠；选中子页面不强制展开，折叠不切换当前页面。移动端使用同一导航定义。旧 `system` 深链继续进入数据与维护，`profile` 进入个人与偏好。旧 `ai` / `weather` 链接映射到 `site`，`personalization` / `notifications` 映射到 `profile`，`personalData` 映射到 `account`，URL 自动更新，刷新和浏览器历史保持一致。Pro 二级菜单统一带 PRO 标记并受全站显示开关控制，一级 Pro 高级功能入口始终保留。站点社交主页属于系统设置；Telegram 渠道属于当前用户，管理员才可订阅全站事件。

Tab 容器位于后台页面及 `admin/components/`；按职责拆分的卡片负责独立设置区域，状态与请求尽量归入 `use-admin-*` Hook。不得把 tab 的显示或隐藏作为唯一授权检查。

## 内容详情与组件详情页

项目、活动、日程等业务详情主要使用视图内面板或弹窗；分享详情使用分享路由。仓库当前没有 `/components/[slug]` 一类组件详情路由，也没有独立组件文档站。

未来如建设组件目录，建议先定义名称、用途、预览、Props、依赖、安装方式、主题与无障碍说明，并在 [REGISTRY](REGISTRY.md) 中明确分发机制；这属于待评估规划，当前不提供安装入口。

布局视觉见 [DESIGN](../DESIGN.md)，组件实现约定见 [COMPONENT-GUIDELINES](COMPONENT-GUIDELINES.md)。

Pro 页的 `showProMenus` 为全站菜单显示开关，默认开启。系统设置与用户设置通过共享导航定义过滤各自的 Pro 子菜单，一级 Pro 入口保留；「系统功能」与「用户功能」均显示 PRO 标记。隐藏只影响导航，直接地址仍受既有管理员与功能授权检查。
