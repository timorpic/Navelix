# 活动任务上下文

- schema_version: 1
- project_id: Navelix
- task_id: release-launch-hardening-20261018
- context_revision: 2
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

新增执行约束：用户明确「构建 Docker 镜像全部放在 GitHub Actions」。本地只进行源码检查与 Next 生产包编译，不构建或运行 Docker 镜像。

## 后续仓库治理指示

用户提供 main 未受保护截图并要求按标准流程处理，已明确选择「个人维护：PR + CI，不强制他人审批」。授权配置 main 保护及对应流程记录；不将截图上的 Issue/PR 数量推断为批量合并/关闭授权。main 保护已应用，后续记录变更通过分支 PR。发布目标仍是 v2.10.20，持续跟踪镜像直到完成。
