# 当前检查点

- schema_version: 1
- project_id: Navelix
- task_id: cleanup-invalid-refs-20261020
- context_revision: 1
- checkpoint_seq: 1
- updated_at: 2026-10-20T12:00:00+08:00
- owner: Claude Code（会话 d8bf7d8a）
- status: handoff_ready
- current_step: 11 个清理提交已在本地分支完成并通过验证，等待用户决定是否推送开 PR

## 现场

- repo_root: /root/Navelix
- branch: `chore/cleanup-invalid-refs-20261020`（本地，**无上游**，未推送）
- HEAD: `2363fb3d92f22205d881d54a74d3b7dd583d4614`
- 相对 main：11 个提交，53 个文件，+142 / −620 行
- 工作区：仅 `.handoff/` 交接记录有改动（本次写入），业务代码干净
- 分支名：会话中曾误用 `codex/` 前缀，经 `git reflog` 确认系本次会话自建（`branch: Created from HEAD`），已改为 `chore/`

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

累计：`messages/` 三份文件净减 159 行（词典 1595 → 1592 键，模板 104 → 101 条）。

## 验证证据

- 每个提交前均通过 `pnpm typecheck`、`pnpm lint`；`pre-commit` hook 亦重复执行两者，全部通过。
- `pnpm test`（走 `scripts/run-isolated.mjs`）：**644 tests / 175 suites，pass 644，fail 0**，在 `25d10fc` 与 `2363fb3` 之后各跑一次。
- `messages/` 校验：zh-CN 与 en 各 1592 键且**逐键对齐**（互无独有键）；101 条模板的 key 全部在两份词典中存在。
- `scripts/sync-version.mjs` 校验模式返回「所有版本位置均与 package.json (2.10.24) 一致」。
- `scripts/render-icons.mjs` 实测：无浏览器时报错信息明确；用 `NAVELIX_BROWSER_PATH=/bin/true` 走通全流程且不污染工作区。
- ⚠️ 未运行 `pnpm build` 与 E2E（本轮改动不含构建配置语义变化，但 `playwright.config.ts` 的 reporter 改动**未在 CI 中验证过**）。

## 关键判定（避免后续重复劳动）

- `周{v0}` / `{v0}月` / `{v0}年` 判定为不可达的依据：`src/lib/gantt.ts` 直接拼出 `col.label` / `col.subLabel` / `timelineLabel`，`project-gantt-view.tsx` 按原样渲染，**不经 `useText` 或 `translateText`**；`gantt.ts` 仅被 `use-gantt.ts` 消费。
- `，截止 {v0}` 模板**保留**：经实际执行 `localizeText` 证实，被 `已创建待办「{v0}」{v1}（优先级：{v2}）。` 的 `translateValues: ["v1"]` 递归命中。
- `showLinkLatency` / `sidebarRightDefaultState` 可安全删除的依据：无 DB 列、无迁移、不在 `validateConfigPatch` 白名单、EE 字节码零命中。
- `render-icons.mjs` **不可删**：它是 `extension/icons/icon-{16,32,48,128}.png`、`public/favicon/*`、`public/pwa/*` 共 10 张 PNG 的唯一生成器，`manifest.json`、`layout.tsx`、`manifest.ts` 都在用这些产物。
- 已排除的假阳性：`.dockerignore` 的防御性忽略项、`ee/` 私有目录、模块内自用的 `export`（`validateUrl`、`matchesFilter`、`decodeLogEvent` 等均在同文件内被调用）、CHANGELOG 历史条目、E2E 测试自建的 fixture 标题。

## 已知失败与阻塞

- 无失败项。
- 阻塞项：无。推送/开 PR 需要用户授权。

## 下一步

1. 用户确认后：`git push -u origin chore/cleanup-invalid-refs-20261020`，开 PR（main 需两个必需检查通过）。
2. 合并后按 `docs/DEVELOPMENT.md` 清理本地与远程分支。
3. 三项待决策事项见 CONTEXT.md 末节。

## 外部操作台账

- 无推送、无 PR、无 Release、无部署、无生产库写入。
- 私有商业驱动 `ee/` 全目录未被 Git 跟踪；本轮在其中修正了一处测试文件路径，该修改**留在本地，不会进入提交**。

## 共享记忆

- OpenMemory 未使用。MEMORY.md 无需更新：本轮未产生新的架构决策或长期约束。
