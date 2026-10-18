# 活动任务上下文

- schema_version: 1
- project_id: Navelix
- task_id: release-launch-hardening-20261018
- context_revision: 3
- updated_at: 2026-10-18T23:28:07+08:00
- status: active

## 用户目标与授权

用户已明确授权修复、提交、推送及 Release，生产已部署 v2.10.19，本次为原地升级。保持 latest 和原有容器使用方式，不直接操作生产实例。Docker 镜像构建全部在 GitHub Actions；本地只做源码检查和 Next 编译。业务测试使用 Computer Use，当前无该工具，既有远程 CI 作为发布门禁。

用户随后提供 main 未保护截图并要求标准流程，明确选择「个人维护：PR + CI，不强制他人审批」。授权配置保护、以 PR 交付对应治理及后续发布修复；不包含批量合并/关闭其他 PR 或 Issue。

## 当前范围及验收

- main 保护已设置：PR、两个指定 Actions 检查、分支保持最新、解决讨论；审批人数 0、管理员也受约束，禁止强推与删除。
- v2.10.20 镜像交付被门禁拦住，已保留 Tag 并标为预发布；不可覆盖或复用。按新版本 v2.10.21 修复跨 job 仓库名输出被屏蔽的问题，保留全部验收门禁。
- 通过 PR #21 合并最终修复，CI 通过后给目标提交创建新 Tag/Release；跟踪镜像构建、冒烟、生产 UI、registry 提升及 digest 核验。
- 报告各渠道真实状态和生产未验收限制，不将 Release 创建等同于镜像可用。

## 主记录

发布规范：docs/AGENT-RULES.md 第 18 节、docs/DEVELOPMENT.md、docs/REGISTRY.md。生产步骤：docs/PRODUCTION-ACCEPTANCE.md。原上线修复现场在 .handoff/archive/launch-hardening-20261018/，当前实际现场见 CHECKPOINT.md。
