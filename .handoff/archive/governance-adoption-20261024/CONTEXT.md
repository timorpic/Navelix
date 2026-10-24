# 活动任务上下文

- schema_version: 1
- project_id: Navelix
- task_id: governance-adoption-20261024
- context_revision: 3
- updated_at: 2026-10-24T17:58:59.485210+08:00
- status: completed
- checkpoint: .handoff/CHECKPOINT.md
- handoff_id: 无
- from_agent: 不适用

## 用户目标与授权
用户要求其他项目适配 agent-handoff 治理机制，并已授权提交、推送、合并检查通过的相关 PR、清理任务分支及本地与 GitHub 同步；用户已确认旧写入者停止。本工具连续处理。

## 范围与验收
已接入项目治理说明、精确路径任务契约、差异范围检查器和 PR 模板；保留原项目规则、业务、依赖及既有 CI。共享检查器修复上游差异归属和暂存区漏检；修订 3 修正 PR 模板示例被重复计数问题，并核对目录迁移后的真实位置。Sub-Rule 按既有约定不新增 CI。所有本次验收已完成。

## 证据与限制
最终现场及 GitHub 证据见 /root/ams/.handoff/evidence/governance-adoption-20261024。原 /root/governance-adoption-20261024 证据目录因外部目录变动已不可用；现有证据从实际 Git/GitHub 重建，未虚构原始备份。客户端行为兼容测试不属于本次验收，未执行；本机没有运行测试或构建。长期事实仍以 MEMORY.md 和正式文档为准。
