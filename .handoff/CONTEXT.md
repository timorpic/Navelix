# 活动任务上下文

- schema_version: 1
- project_id: Navelix
- task_id: release-launch-hardening-20261018
- context_revision: 1
- updated_at: 2026-10-18T23:10:41+08:00
- status: active

## 用户目标及授权

用户明确要求「提交推送发 release」，准备自行在生产环境部署。授权本轮修复的提交、推送、Tag、GitHub Release 及既定 Release 镜像流水线；不直接操作生产实例。保持 latest 和原有部署方式。业务测试仍遵循 Computer Use 要求；当前无该工具，本地不以其他浏览器模式替代，既有远程 CI 作为发布质量门禁运行并记录结果。

## 范围与验收

- 核对远程历史后按年月序号确定下一版本，使用 sync-version / sync-changelog 维护真源。
- 提交所有本会话已授权修复与对应文档，推送后等待 CI，失败则修复，不绕过门禁。
- 同一目标提交经过质量检查后创建并推送 Tag，再通过项目脚本发布 Release；跟踪镜像质量、冒烟与提升结果。
- 明确报告各渠道状态、真实生产未验收项及升级步骤。

## 资料

发布规范：docs/AGENT-RULES.md 第 18 节、docs/DEVELOPMENT.md、docs/REGISTRY.md；生产操作：docs/PRODUCTION-ACCEPTANCE.md。上一轮现场已成对归档于 .handoff/archive/launch-hardening-20261018/。

用户补充：生产已部署 v2.10.19，本次交付为原地升级到新版本的发布；保留现有 data 卷、环境与 latest 使用方式。
