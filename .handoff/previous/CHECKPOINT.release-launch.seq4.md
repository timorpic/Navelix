# 当前检查点

- schema_version: 1
- project_id: Navelix
- task_id: release-launch-hardening-20261018
- context_revision: 3
- checkpoint_seq: 4
- updated_at: 2026-10-18T23:28:07+08:00
- owner: Codex
- status: active
- current_step: 修复 v2.10.20 镜像交付失败，准备通过 PR #21 发布 v2.10.21

## 工作区

- 当前分支：codex/main-protection-release-records-20261018。
- main / PR 基线：e7294b5951286f7278fb60c72fa251d2f2501db5（上线加固发布提交）。
- 分支已推送文档提交 b88264d；当前新增工作流修复、2.10.21 版本同步、镜像地址校验脚本与回归用例及记录修改尚待提交推送。
- 当前 package.json / Dockerfile / build-info / admin-system 已同步 2.10.21，CHANGELOG 已准备对应说明。
- 旧现场完整保存在 .handoff/previous/CHECKPOINT.release-launch.seq3.md。此处只记录当前状态，不继承旧快照中的待执行动作。

## 外部状态与证据

- e7294b5 已推送 main。源码 CI 39139519445 成功：578 测试、576 通过、0 失败，覆盖率门禁成功；生产 E2E 30 通过。
- v2.10.20 Tag 指向 e7294b5；Release https://github.com/timorpic/Navelix/releases/tag/v2.10.20 已标为预发布，并注明镜像交付失败。Tag 未移动或删除。
- 镜像 run 39139772662：源码质量、候选构建、基础冒烟、旧库升级成功；生产 UI 容器启动因空镜像地址失败，稳定标签提升跳过，本轮未更新 latest。
- 根因证据：build job 明确记录 Skip output repository since it may contain secret；跨 job 的 repository 值为空，形成 ghcr.io/@sha256 地址。修复为各 job 从官方 GITHUB_REPOSITORY 上下文生成镜像地址，仅跨 job 传 digest；新脚本校验地址与 digest，缺失即失败。
- PR #21：https://github.com/timorpic/Navelix/pull/21，目前未合并。旧文档提交的两个 CI 已通过；新增修复提交仍须重新等待 CI。
- main 已受保护且回读确认：两个 checks 绑定 github-actions app 15368（Lint, Test & Build / Playwright E2E (Core UI Flow)），strict=true，required PR，审批人数 0，解决讨论，管理员约束，禁止 force/delete。设置生效前 422 请求未产生变更，修正 API 字段后成功。

## 当前验证与 review

- 原发布提交的 typecheck/lint/隔离生产构建与源 CI 通过。当前版本同步和新脚本已通过版本/CHANGELOG 校验、node --check、工作流 YAML / bash -n 及 diff 空白检查。
- 新增镜像地址构造的回归用例尚待远程 CI；未本地执行 Docker 构建或浏览器测试。
- PR review 指出检查点旧状态与追加记录冲突，已保留完整旧快照并重写当前 CONTEXT/CHECKPOINT；修复提交后再将该线程标为已解决，不绕过讨论门禁。
- Computer Use / OpenMemory unavailable，无共享条目采用；真实生产、恢复与容量演练未执行。

## 下一步

1. 提交并推送工作流修复与 2.10.21，重写 PR #21 的最终标题/说明，处理已修复的检查点 review 线程。
2. 等待 PR 自身 CI 全通过，正常合并（不绕过 main 保护），再对经过验证的目标提交创建 v2.10.21 Tag/Release。
3. 跟踪 GitHub Actions 镜像门禁和 registry digest，成功后向用户提供从生产 v2.10.19 升级的准确交付结果。

## 授权边界

用户已授权发布及仓库保护；未直接操作生产实例，未自动调度其他 Agent，未发送额外外部消息，不批量处理截图中的其他 PR / Issue。发布镜像只在 GitHub Actions 执行。
