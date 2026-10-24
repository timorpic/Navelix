# 活动任务上下文

- schema_version: 1
- project_id: Navelix
- task_id: git-workflow-sync-20261023
- context_revision: 1
- updated_at: 2026-10-23T10:44:35.029853+08:00
- status: active
- checkpoint: .handoff/CHECKPOINT.md
- handoff_id: 无
- from_agent: 不适用（用户明确发起新任务，上一任务已完成）

## 用户目标与授权

用户在模板仓库会话中要求将本次更新应用到现有项目，并明确指定 Navelix、AegisLink-CRM、ams。
本记录只适用于 Navelix；范围为本项目 Git 规范、PR 模板及相关文档、长期索引和现场记录。
授权为本地增量修改与静态检查，不包含提交、推送、PR 创建、远程设置、发布或部署。
目标项目自行维护 CI，不写入或替换任何 workflow、CI 示例、测试脚本和业务配置。

## 验收标准

- AC-01：分支、提交、PR、自审、合并、保护及回退规范在项目开发文档中生效，入口可定位。
- AC-02：新增 PR 模板；保留已有协议正文、版本、CI、业务、配置和用户未提交修改。
- AC-03：静态核对差异、链接、原有修改和 CI 哈希；不运行本机测试或构建。

## 需求与事实入口

- 规则：AGENTS.md；Git 工作流：docs/DEVELOPMENT.md；长期事实：MEMORY.md。
- 接力：HANDOFF.md；本次不是完整协议升级，不改变已记录协议版本。
- 来源：/root/agent-handoff 当前工作区的第 9 节与 PR 模板（尚未提交）。
- 来源 Git 规则 SHA-256：5c53cfbc95bff41d1af96798315f68ec341e562d2e265474fa1ed7b300556a66。
- 本项目起点：分支 main，HEAD d5c39b94743b14287638a8824fa0a1390729bc96。
- 上一任务冻结记录：.handoff/archive/ams-presets-20261022。

## 边界与未知

原有 AGENTS 修改保留；未认领旧任务，不继承历史验证或外部操作授权。
检查时没有 Agent 进程 cwd 位于本项目，记录任务已完成且无待认领交接；这只是辅助证据，不构成互斥锁。
远程保护与合并选项本次不修改、不重新认证；本地文档采用规范不代表远程已强制执行。
