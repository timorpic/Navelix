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

后台以 `AdminSidebar` 和功能内容区组织，支持 `/admin?tab=system` 一类深链。有效 tab 包括：

- 内容：`links`、`categories`、`quickAccess`、`projects`、`schedules`。
- 系统与服务：`users`、`analytics`、`models`、`system`、`pro`。
- 个人设置：`personalization`、`profile`。

Tab 容器位于后台页面及 `admin/components/`；按职责拆分的卡片负责独立设置区域，状态与请求尽量归入 `use-admin-*` Hook。不得把 tab 的显示或隐藏作为唯一授权检查。

## 内容详情与组件详情页

项目、活动、日程等业务详情主要使用视图内面板或弹窗；分享详情使用分享路由。仓库当前没有 `/components/[slug]` 一类组件详情路由，也没有独立组件文档站。

未来如建设组件目录，建议先定义名称、用途、预览、Props、依赖、安装方式、主题与无障碍说明，并在 [REGISTRY](REGISTRY.md) 中明确分发机制；这属于待评估规划，当前不提供安装入口。

布局视觉见 [DESIGN](../DESIGN.md)，组件实现约定见 [COMPONENT-GUIDELINES](COMPONENT-GUIDELINES.md)。
