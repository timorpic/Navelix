# 当前检查点

- schema_version: 1
- project_id: Navelix
- task_id: release-launch-hardening-20261018
- context_revision: 3
- checkpoint_seq: 5
- updated_at: 2026-10-18T23:35:23+08:00
- owner: Codex
- status: active
- current_step: v2.10.21 已发布，等待 GitHub Actions 镜像验收及稳定标签提升

## 工作区与已完成的仓库治理

- 当前分支：codex/release-2.10.21-verification；只记录发布验收，不修改应用实现。
- main 已合并 PR #21，合并提交 f020f13d2ed73162aaf6552780433a233c9d127b，内容与被测 PR head ebbbea3 完全一致。
- main 保护已回读确认：必需 PR、两个绑定 github-actions 的 CI、分支保持最新、解决讨论，审批人数 0，管理员也受约束，禁止 force/delete。
- PR #21 的检查点 review 已通过重写记录修复并解决，所有必需 CI 成功后正常 squash 合并，没有使用绕过权限。

## 发布状态与证据

- v2.10.20 保留原 Tag/Release，已标预发布并注明镜像交付失败。镜像 run 39139772662 的 repository job output 被 Actions Secret masking 屏蔽，UI 容器启动失败；Promote 跳过，本轮未更新 latest。
- 修复后各 job 从 GITHUB_REPOSITORY 构造镜像地址，只跨 job 传 digest，并加入地址/输入校验与回归用例。
- PR CI 39140665239 与合并提交 main CI 39140876377 全通过。
- v2.10.21 Tag 指向 f020f13，正式 Release 已创建：https://github.com/timorpic/Navelix/releases/tag/v2.10.21。
- 当前镜像工作流 39141084086 正在运行：https://github.com/timorpic/Navelix/actions/runs/39141084086；尚未认定镜像门禁或 latest 提升成功。
- Docker 镜像构建全部在 GitHub Actions，本地没有构建或运行镜像，没有直接操作生产实例。

## 当前验证与限制

源 CI、版本/CHANGELOG、类型/lint、脚本与 YAML/shell 静态检查已通过；已发布版本的实际镜像仍待工作流验收。Computer Use 与 OpenMemory unavailable；无真实生产、恢复或容量演练通过结论。历史执行记录在 previous/，不继承其中已经失效的待办。

## 下一步

1. 等待镜像 run 39141084086 完成；失败先定位，禁止绕过验收门禁。
2. 成功后核对 GHCR / Docker Hub 的版本和 latest digest，再将最终验收记录通过 PR 合并。
3. 向用户交付生产 v2.10.19 原地升级结果；保留数据卷与原密钥材料，继续使用 latest。

## 授权边界

用户已授权发布及仓库保护；未直接操作生产实例，未自动调度其他 Agent，未发送额外外部消息，不批量处理截图中的其他 PR / Issue。发布镜像只在 GitHub Actions 执行。
