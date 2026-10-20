# 活动任务上下文

- schema_version: 1
- project_id: Navelix
- task_id: assistant-header-row-20261019
- context_revision: 8
- updated_at: 2026-10-19T22:26:33+08:00
- status: completed

## 用户目标与授权

本会话用户确认的界面调整：移除侧栏账户菜单社交区域；AI 助手移到欢迎卡片搜索框右侧，移除前台通知铃铛与原悬浮入口底部留白；快速操作移除上传文件与记录想法，保留入口两列排列；今日专注移入日程概览标题下方并保留分钟数与趋势。

用户最新明确要求「关闭预览 并提交推送发release」，授权提交、推送、PR 合并和按既有流程发布应用 Release 及自动镜像流水线。无直接生产库操作与手工部署。

## 验收与发布

本轮发布版本为 v2.10.23；发版前查询远程 Tag 与 Release，当时最新为 v2.10.22。版本脚本同步四个版本位置，CHANGELOG 真源。按 main 分支保护，经 PR 的 Lint, Test & Build 与 Playwright E2E (Core UI Flow) 必需检查通过后合并，再推送 Tag、发布 Release，并等待镜像质量/候选/冒烟/稳定标签提升成功。

## 约束与入口

依据 AGENTS.md、docs/AGENT-RULES.md 第 18 节、docs/DEVELOPMENT.md、docs/DEPLOYMENT.md、DESIGN.md、MEMORY.md。本地无 Computer Use，已向用户提供隔离演示页并按反馈迭代；自动回归测试依照仓库 CI 门禁执行。真实业务库不得用于验证，Docker 只在 GitHub Actions 构建。现场见 CHECKPOINT.md。

## 交付结果

v2.10.23 已发布，PR #25 合并，main CI 与镜像流水线成功，六个稳定镜像标签摘要回读一致。预览服务已关闭。完整证据见 CHECKPOINT.md。
