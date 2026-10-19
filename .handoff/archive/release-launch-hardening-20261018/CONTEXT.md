# 活动任务上下文

- schema_version: 1
- project_id: Navelix
- task_id: release-launch-hardening-20261018
- context_revision: 4
- updated_at: 2026-10-18T23:43:35+08:00
- status: completed

## 已授权目标

上线评审后的全面修复、提交、推送及 Release；用户生产已部署 v2.10.19，要求保持 latest 和原有使用方式，Docker 构建全部在 GitHub Actions。用户随后要求处理 main 未保护，并明确选择个人维护的 PR + CI、审批人数 0。直接生产部署未授权且未执行。

## 完成结果

- 加固与发布修复已通过 PR #21 合并，v2.10.21 Tag 指向 f020f13，正式 Release 与 GHCR / Docker Hub 稳定镜像均已完成。
- main 保护已生效并经真实 PR 流程验证，不再直接推送 main。
- v2.10.20 镜像失败版本保留 Tag 并标为预发布，未覆盖历史 Tag；后续修复按新版本交付。
- 来源、run ID、digest 和验证范围见 CHECKPOINT.md；正式发布说明以 CHANGELOG 与 GitHub Release 为准。

## 遗留验收与资料

生产真实 HTTPS、云服务、恢复时间与容量验证仍由维护者在独立环境执行；Computer Use 当前不可用。镜像 CI 通过不等同于这些现场验收通过。

规范：docs/DEVELOPMENT.md、docs/REGISTRY.md；生产手册：docs/PRODUCTION-ACCEPTANCE.md、docs/DEPLOYMENT.md。旧执行现场已按协议保留，不从旧检查点的待办继续发布。
