# 当前检查点

- schema_version: 1
- project_id: Navelix
- task_id: release-launch-hardening-20261018
- context_revision: 4
- checkpoint_seq: 6
- updated_at: 2026-10-18T23:43:35+08:00
- owner: Codex
- status: completed
- current_step: 上线加固已发布 v2.10.21、稳定镜像已更新，main 保护验证完成

## 工作区与记录边界

当前工作分支 codex/release-2.10.21-verification 仅保存结果记录，无业务代码变更。记录自身的提交/推送/合并状态以 git status、git log 与对应 PR 的实时结果为准，不以静态文件中的自引用哈希追逐提交。

发布代码提交为 f020f13d2ed73162aaf6552780433a233c9d127b，合并自 PR #21；Tag v2.10.21 固定指向该提交。后续仅文档记录提交不改变该发布基线。

## 已完成与验证证据

- PR #21 已在必需 CI 全成功、review 线程解决后正常 squash 合并，未使用 admin bypass。合并前后文件树一致。
- PR CI 39140665239、main CI 39140876377 成功，均包括类型、lint、覆盖率、生产构建和生产 E2E。
- v2.10.21 正式 Release：https://github.com/timorpic/Navelix/releases/tag/v2.10.21。
- Docker GitHub Actions run 39141084086 成功：https://github.com/timorpic/Navelix/actions/runs/39141084086。
- 该 run 的源码质量、候选镜像构建、基础 CRUD/鉴权/敏感字段/非 root 冒烟、历史 v20 升级、生产镜像 UI（30 passed）、稳定标签提升与 digest 核验、发布通知均成功。
- GHCR / Docker Hub 的 latest、v2.10.21、2.10.21 已由提升任务核对同一被测 digest：`sha256:5bb021fbd288af45dc33de4f161b9d2c3d047d02840d2d3b9185c25eed67c3d7`。
- 另通过 Docker Hub 公共 API 独立回读三个标签，digest 均与 UI 被测镜像一致；latest 已从 2026-10-15 的旧 digest 更新到本次镜像。
- Docker 镜像的构建、运行验证和推送全部在 GitHub Actions，本地未执行 Docker build/run。

## main 保护与流程

已通过 API 应用并回读 protected=true：必需 PR；两个 required checks 绑定 github-actions app 15368（Lint, Test & Build / Playwright E2E (Core UI Flow)）；strict=true；审批人数 0；要求解决讨论；管理员同样受约束；禁止 force/delete。

用户明确选择个人维护模式，不强制另一人批准。PR #21 实际验证了 CI/未解决讨论会阻止合并，条件满足后可正常合并。截图中的其他 Issue / PR 没有被批量关闭或合并。

## 失败处理与历史

v2.10.20 的镜像 run 39139772662 失败：跨 job 仓库名输出被 Actions Secret masking 屏蔽，UI 容器地址为空，稳定标签提升被跳过，未覆盖旧 latest。保留原 Tag 并将 Release 标为预发布，说明交付失败；没有移动或复用已发布 Tag。修复由 v2.10.21 交付：镜像地址在各 job 内从官方上下文构造，仅跨 job 传 digest，增加输入校验与回归用例，保留全部门禁。

已修复 PR review 指出的检查点旧状态冲突：完整旧现场保存在 previous/，当前文件改写为有效状态，不追加过时待办。上一版现场见 .handoff/previous/CHECKPOINT.release-launch.seq5.md。

## 生产边界与限制

用户生产已部署 v2.10.19，本次提供原地升级镜像：继续使用 latest，保留原数据卷与环境变量。升级前保留可恢复快照和原 .app_secret / APP_SECRET；正常实例无需执行旧密钥迁移工具。未直接部署或修改生产数据；真实 HTTPS、云服务、RPO/RTO、容量与 Computer Use 验收未在本轮执行，不能以 CI / 镜像冒烟替代这些证据。

Computer Use / OpenMemory unavailable；无共享记忆条目采用或 retain。本地长期约定已更新，发布过程与原始日志不写入 MEMORY。

## 交付

发布和仓库保护目标已完成。生产升级由用户按 docs/PRODUCTION-ACCEPTANCE.md 与 docs/DEPLOYMENT.md 执行；未来代码变更继续走分支、PR、必需 CI 与 release 门禁。
