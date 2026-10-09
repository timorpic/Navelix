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

### 文档
- wiki FAQ 新增「仓库维护与依赖升级」章节：记录 Dependabot PR 触发 pnpm 供应链门禁（`ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`）的排查与修复流程
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
