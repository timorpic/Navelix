# 当前检查点

- schema_version: 1
- project_id: Navelix
- task_id: assistant-header-row-20261019
- context_revision: 8
- checkpoint_seq: 9
- updated_at: 2026-10-19T22:26:33+08:00
- owner: Codex
- status: completed
- current_step: v2.10.23 已发布，代码及镜像验收完成，预览已关闭

## 工作区与记录边界

- repo_root: /root/Navelix
- branch: main
- HEAD: 9478bb71971c24ef6b490058346edd5e65d22147，与 origin/main 一致。
- 业务代码、版本、DESIGN、CHANGELOG、E2E 及前任务归档均已提交推送并经 PR #25 合并。
- 发布证据文档与 .previous 恢复备份随本次文档提交纳入版本控制；提交后的实际 staged / unstaged 状态以 git status 为准，不能由检查点自指地断言。备份不属于应用产物。
- 原始演示预览进程组已停止，3723 端口不再监听；演示数据保留于独立临时目录，真实业务库未访问。

## 交付范围

侧栏账户菜单移除社交区域；AI 助手移到搜索框右侧，功能页保留顶部入口，前台通知铃铛移除；移除原悬浮按钮底部留白；快速操作去除上传文件与记录想法，剩余入口两列排列；今日专注移入日程概览标题下方，保留分钟数及趋势。版本真源与发布说明同步至 2.10.23，无 Schema 或部署方式变化。

## 验证证据

- 本地 pnpm typecheck、pnpm lint、pnpm build、git diff --check 通过；构建经项目脚本一次性目录隔离。
- PR CI run 39267241313 success：645 tests / 175 suites，行覆盖率 90.81%、函数 85.31%，31 项 Playwright E2E 通过。
- main CI run 39267625560 success。
- 镜像流水线 run 39267733564 success：源码质量、候选镜像构建、运行冒烟、历史库升级、生产候选镜像 UI、稳定标签提升与结果通知全部成功。
- Computer Use unavailable，未声称本地人工浏览器操作验证完成；布局由用户预览反馈确认并调整，自动验证为仓库 CI。
- OpenMemory unavailable，无新增共享条目；以本地记录为依据。

## 外部操作台账

- 发布分支 codex/workspace-ui-2.10.23，发布提交 681f99f3d1154fa340d3a78af13ddf1a7d94088b。
- PR #25: https://github.com/timorpic/Navelix/pull/25 ，两项 required checks 通过后 squash 合并，main 提交见 HEAD。
- 附注 Tag v2.10.23 已推送，指向上述 main 提交。
- 正式 Release（非草稿、非预发布）：https://github.com/timorpic/Navelix/releases/tag/v2.10.23 。
- GHCR 与 Docker Hub 的 latest、v2.10.23、2.10.23 六个标签分别回读均为 sha256:900070ce9dfe2522393c52fe5c017ef4b7024841219e709a539cb834048a93d4，与流水线被测/提升摘要一致。
- 未直接操作生产数据库或执行手工生产部署；既有 Watchtower 更新方式保持不变。

## 后续

本轮用户授权的界面修改、关闭预览、提交推送及应用 Release 与镜像发布均完成。最终接力证据随文档提交保存，不包含待发布应用代码；本文档自身的提交与合并状态以 Git 和对应 PR 为准。
