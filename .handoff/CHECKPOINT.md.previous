# 当前检查点

- schema_version: 1
- project_id: Navelix
- task_id: cleanup-invalid-refs-20261020
- context_revision: 2
- checkpoint_seq: 2
- updated_at: 2026-10-20T15:20:00+08:00
- owner: Claude Code（会话 d8bf7d8a）
- status: completed
- current_step: 已合并、已清理分支、已发布 v2.10.25 并通过 Docker 构建

## 现场

- repo_root: /root/Navelix
- branch: `main`（本地与 `origin/main` 一致）
- HEAD: `334bbbe3957c2e21748b2cd2962fdf2a4b0cfa75`
- tag: `v2.10.25`（指向 `334bbbe`，已推送）
- 工作区：仅 `.handoff/` 交接记录有改动（本次写入），业务代码干净
- 分支清理：`chore/cleanup-invalid-refs-20261020` 与 `release/v2.10.25` 的远程分支均已删除（前者随 PR 合并，后者手工删除后 `git fetch --prune` 清除本地过时引用），本地分支已 `-d` 删除

## 已完成的清理（按提交）

| 提交 | 内容 |
| --- | --- |
| `d1ff28e` | 首页问候语残留的 6 个翻译键 |
| `e718e2b` | 编号注释的断号与重复 |
| `723d232` | sync-version 注释中的历史版本示例 |
| `5a41ef3` | 60 个不可达翻译键与 4 条失效模板 |
| `005e714` | 已断链的通知铃铛组件簇（5 个文件，含 `pending-reminders-widget`、`workspace-notifications`、`use-workspace-notifications`、`use-dismissible-popover`） |
| `7e2ae22` | 与实现不符的首页与后台任务描述（docs + wiki） |
| `2b7bd68` | 无读取方的配置字段（`showLinkLatency`、`sidebarRightDefaultState`）与死导出 `projectStatusOf`；死 prop `links` / `onSelectCategory`；Pro 卡片编号注释 |
| `25d10fc` | 扩展 `navelix:open` 监听器与无用样式、`next.config.ts` 的 `images.remotePatterns`、CI 无用环境变量、e2e 截图落盘改为 `testInfo.attach`、`sync-version` 不可达分支改为显式报错、`render-icons.mjs` 跨平台化 |
| `6861f85` | 说明 `src/app/icon.svg` 不在图标生成脚本范围内 |
| `6db6179` | 注释中的 `middleware.ts` 更正为 `src/proxy.ts` |
| `2363fb3` | 甘特图轴上不可达的 3 条日期模板（`周{v0}`、`{v0}月`、`{v0}年`） |
| `69b5815` | 删除不可达的「我的信息」弹窗与 `AccountSocialLinks`（配置字段保留） |
| `e8e8469` | 删除从未接通的 `notifications:new` 事件链 |
| `6dff774` | 修复：「快捷访问」开关此前只写库不生效 |
| `32b96a1` | 修复：安全引导指向 `/admin?tab=system` → `/admin?tab=access` |
| `70c4e6d` | 上线评审记录标明为 2026-10-18 历史快照 |
| `fda49e8` | 接力现场写入 `.handoff/` |
| `de86c6f` / `5b09b81` / `ff466b1` / `47e85cd` | wiki（7 个文件）与 README 的陈旧描述、错误菜单路径、失配锚点、两处与源码矛盾的断言 |
| `abaede5` | 修复：Playwright reporter 数组元素类型 |
| `591178f` | 修复：快捷访问 e2e 用例自建前置数据 |
| `2d9b19b` | CHANGELOG `[未发布]` 章节 |
| `6a3974c` | 修复：改密按钮指向 `tab=account` 而非 `tab=profile` |

累计：`messages/` 词典 1676 → 1577 键（净删 99 中文键，中英逐键对齐），模板 108 → 101 条。

## 验证证据

- 每个提交前均通过 `pnpm typecheck`、`pnpm lint`；`pre-commit` hook 亦重复执行两者，全部通过。
- `pnpm test`（走 `scripts/run-isolated.mjs`）：**644 tests / 175 suites，pass 644，fail 0**。
- `pnpm build` 生产构建通过（验证删除 `images.remotePatterns` 不影响 `link-card.tsx` 的 `unoptimized` 用法）。
- `messages/` 校验：zh-CN 与 en 各 1577 键且逐键对齐；`source-index.json` 1363 条 0 悬空；`templates.json` 101 条 0 悬空。
- **CI（GitHub Actions）**：PR #29 与 #30 的 `Lint, Test & Build` 与 `Playwright E2E (Core UI Flow)` 均 pass（E2E 32 用例）。
- **Docker**：`docker.yml` run `39385185094` 全 6 阶段成功（quality 两 job、Build Candidate Image、Smoke Test Image、Promote verified digest、Notify release result）。

## 发布结果

- PR #29（清理改动，25 个提交）合并为 `5693aa4`。
- PR #30（版本发布）合并为 `334bbbe`。
- `v2.10.25` tag 已推送，GitHub Release 已创建：https://github.com/timorpic/Navelix/releases/tag/v2.10.25
- Docker 镜像已构建、冒烟测试通过并提升至 stable tag。该工作流只由 release 触发，PR 阶段不验证，本次为首次实际执行。

## 关键判定（避免后续重复劳动）

- `周{v0}` / `{v0}月` / `{v0}年` 判定为不可达的依据：`src/lib/gantt.ts` 直接拼出 `col.label` / `col.subLabel` / `timelineLabel`，`project-gantt-view.tsx` 按原样渲染，**不经 `useText` 或 `translateText`**；`gantt.ts` 仅被 `use-gantt.ts` 消费。
- `，截止 {v0}` 模板**保留**：经实际执行 `localizeText` 证实，被 `已创建待办「{v0}」{v1}（优先级：{v2}）。` 的 `translateValues: ["v1"]` 递归命中。
- `showLinkLatency` / `sidebarRightDefaultState` 可安全删除的依据：无 DB 列、无迁移、不在 `validateConfigPatch` 白名单、EE 字节码零命中。
- `render-icons.mjs` **不可删**：它是 `extension/icons/icon-{16,32,48,128}.png`、`public/favicon/*`、`public/pwa/*` 共 10 张 PNG 的唯一生成器。
- 改密控件的实际位置：`admin-profile-tab.tsx:41` 的 `section === "account"` 分支，即 `/admin?tab=account`；`tab=profile` 只渲染 `AdminProfileBasicsCard`。
- Playwright CI reporter 必须写成元组数组 `[["github"], ["html", {...}]]`；本地 `CI` 为空时永远走 `"list"` 分支，此 bug 只在 CI 暴露。
- e2e 用例不得依赖种子数据：`sun-panel-migration.spec.ts:20` 会清空 admin 工作区，种子只在建号时播种一次。

## 已知失败与阻塞

- 无失败项，无阻塞项。

## 遗留事项

- `e2e/sun-panel-migration.spec.ts` 仍用 `card.screenshot({ path: "public/screenshots/..." })` 直接改写仓库内受版本控制的图片。本地跑该 e2e 会污染工作区（本次已两次 `git checkout` 还原）。不属于清理范围，建议后续单独处理。
- `wiki/` 是 GitHub wiki 的源副本，本次改动 7 个 wiki 文件；线上 wiki 停在 v2.9.5，逐文件比对后**有 8 个文件与仓库不同**（含本分支未改、但已在更早版本更新的 `DESIGN_SYSTEM.md` 与 `Sun-Panel-Migration-从-Sun-Panel-迁移.md`），**尚未同步到线上 wiki**，需手工同步。

## 外部操作台账

- 已推送 2 个分支（均已删除）、合并 2 个 PR、推送 1 个 tag、创建 1 个 Release、执行 1 次 Docker 构建。
- 无部署、无生产库写入。
- 私有商业驱动 `ee/` 全目录未被 Git 跟踪；本轮在其中修正了一处测试文件路径，该修改**留在本地，不会进入提交**。
- 已清除本分支历史中一处对 `ee/` 内部文件名的引用（rebase 改写 + 逐提交扫描验证），仓库为 PUBLIC。

## 共享记忆

- OpenMemory 未使用。
- MEMORY.md 无需更新：本轮未产生新的架构决策或长期约束。
