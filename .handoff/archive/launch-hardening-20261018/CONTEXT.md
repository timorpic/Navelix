# 活动任务上下文

- schema_version: 1
- project_id: Navelix
- task_id: launch-hardening-20261018
- context_revision: 1
- status: handoff_ready

## 用户目标与授权

用户在上线评审后明确要求「全面修复」。范围为报告 R-01–07 及附带维护项的实现、回归用例、文档和可用验证。保留既有评审及交接文件；不提交、推送、发版、部署或修改真实业务库。测试按用户要求使用 Computer Use，缺少工具时如实记录限制。

## 验收与资料

- 问题依据：docs/LAUNCH-READINESS-2026-10-18.md。
- 密钥异常不使用固定密钥，恢复保护失败终止，稳定镜像必须先验证，云备份按成功时间调度。
- 公共健康检查轻量，深度诊断受控；测试与构建隔离数据；生产 E2E 及恢复运维手册齐备。
- 修复提供有意义的回归用例，执行类型/lint/构建等可用检查，不将未运行的业务测试描述为通过。
- 正式规范：docs/MODULES.md、docs/DEPLOYMENT.md、docs/DEVELOPMENT.md、MEMORY.md。
- 上一任务成对归档于 .handoff/archive/launch-readiness-review-20261018/。

## 当前交付状态

实现及类型/lint/隔离构建已完成；回归用例已编写，Computer Use、远程 CI、恢复与容量证据仍缺。具体现场见 CHECKPOINT，不能认定生产已放行。

用户后续确认：使用 latest 并保持原有部署方式，不增加镜像标签必填变量或 Watchtower profile。相关配置与文档已恢复，发布验收门禁保留。
