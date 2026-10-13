# Sun-Panel 迁移渠道材料

以下为待发布材料。仓库文案与产品引导随应用发布；外部账号描述、Wiki 同步和社区帖子需由维护者发布。本文件不表示已完成投放。

## 统一承诺与边界

「你的 Sun-Panel 配置不用丢：导出 JSON，上传，分类和网址自动搬进来；搬完你还多了 AI、甘特图和日历。」

使用「兼容 Sun-Panel 导出的 JSON 格式」「支持从 Sun-Panel 迁移」。不称“一键导入”，不暗示官方合作，不使用对方 Logo，不贬低 Sun-Panel。主动说明合并导入、重复网址跳过、原实例不变；图标文件不自动复制，AI 需配置服务。

## GitHub About / Topics

About 候选：

> 自托管个人数字工作空间：网址导航、AI、甘特图与日历；支持从 Sun-Panel JSON 和浏览器书签合并迁移。

新增 Topics 候选：`sun-panel-alternative`、`sun-panel`。保留现有 Topics；这里只描述兼容性。

## Docker Hub 描述补充

> 已在用 Sun-Panel？导出 JSON，登录 Navelix，在空工作区首页或「用户设置 → 账号与数据」选择文件，分类和网址自动合并，已有数据与 Sun-Panel 原实例保留，重复网址跳过。迁移后按需探索 AI、甘特图与日历。
>
> Already using Sun-Panel? Upload your JSON export in Navelix to merge categories and links, skip duplicate URLs, and keep your existing data and Sun-Panel instance intact.
>
> [迁移指南](https://github.com/timorpic/Navelix/wiki/Sun-Panel-Migration-从-Sun-Panel-迁移)

## 下次 Release 顶部模板

将 CHANGELOG `[未发布]` 顶部的迁移引导保留在下一版本章节顶部，通过现有 `sync-changelog.mjs` 发布，使 GitHub Release 与 CHANGELOG 一致；不自动改写历史 Release。

> **从 Sun-Panel 迁移**：导出 JSON，在 Navelix 空工作区首页或「用户设置 → 账号与数据」上传，自动合并分类和网址。已有数据保留，重复网址跳过，原 Sun-Panel 实例不受影响。[迁移指南](https://github.com/timorpic/Navelix/wiki/Sun-Panel-Migration-从-Sun-Panel-迁移)。

## 中文社区草稿

标题：从 Sun-Panel 搬到 Navelix：几分钟上手，给导航工作区加上 AI

我是 Navelix 的作者，分享一个给现有导航用户准备的迁移入口。Sun-Panel 很适合导航；如果你也想把项目甘特图、日历待办和 AI 放进同一个个人工作区，可以试试 Navelix。

迁移只需三步：在 Sun-Panel 导出 JSON → 登录 Navelix 选择该文件 → 查看新增分类与链接的保存结果。导入是合并，不清空 Navelix 已有内容，不修改 Sun-Panel 原实例，重复网址会跳过。

迁移后可以创建项目并查看甘特图、安排日历待办；配置 AI 服务后可以拆解项目。部署使用单个 Docker 容器和 SQLite，参见 [部署说明](https://github.com/timorpic/Navelix#快速开始)。

边界也说明白：只迁导航数据，不迁用户、权限和布局；相对路径的图标文件需要另行处理；AI 需配置兼容服务；部分功能为 Pro。个人非商业使用免费，商业使用需授权，详见仓库 LICENSE。如果只需要导航，继续使用 Sun-Panel 也很好。

[仓库](https://github.com/timorpic/Navelix) · [迁移指南](https://github.com/timorpic/Navelix/wiki/Sun-Panel-Migration-从-Sun-Panel-迁移)。欢迎反馈实际导出格式和迁移问题。

## English community draft

Title: Bringing Sun-Panel bookmarks into Navelix, a self-hosted workspace with projects and calendar

I'm the author of Navelix. Sun-Panel is a useful navigation tool; if you'd also like projects, Gantt charts, calendar & todos, and an AI assistant in one workspace, Navelix supports importing Sun-Panel JSON exports.

Export JSON in Sun-Panel, upload it in Navelix, and check the saved import summary. Categories and links merge with your existing data, duplicate URLs are skipped, and your original instance stays untouched.

Navelix runs in a single Docker container with SQLite. AI requires a configured compatible service. Imports cover navigation data, not accounts, permissions, layout, or image files. Some features require Pro. Personal non-commercial use is free; commercial use requires a license. If navigation is all you need, there may be no reason to move.

[Source and deployment](https://github.com/timorpic/Navelix) · [Migration guide](https://github.com/timorpic/Navelix/wiki/Sun-Panel-Migration-从-Sun-Panel-迁移). Feedback on real export files is welcome.

## 发布素材与度量

每个渠道首轮发一次，披露作者身份。发布前核对 V2EX 节点、NAS 论坛、少数派、B 站、r/selfhosted 与 r/homelab 当时的社区规则，不将“10%”当作普遍适用的现行规则。附真实截图：Sun-Panel 导出入口、Navelix 选择文件、保存结果。Navelix 入口与结果截图见 `public/screenshots/sun-panel-import-*.png`。Sun-Panel v1.8.1 的真实导出入口与选项截图见 `public/screenshots/sun-panel-export-*.png`，对应实际导出文件已用于回归测试。发布材料注明截图版本，不用示意图冒充实际界面。

记录 Docker Pulls 周增量、Release 下载量、群新增和帖子互动作为代理指标，不能据此直接计算迁移转化率。Wiki 页面 UV 仅在平台实际提供页面级数据时记录。不新增遥测或本地行为计数。
