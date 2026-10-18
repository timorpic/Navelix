# 当前检查点

- schema_version: 1
- project_id: Navelix
- task_id: release-launch-hardening-20261018
- context_revision: 2
- checkpoint_seq: 3
- updated_at: 2026-10-18T23:10:41+08:00
- owner: Codex
- status: active
- base_commit: cfd0af2e91b9534138533b445980f2d0b0e3959c

## 当前现场

用户已明确授权提交、推送及 Release；未授权直接修改生产实例。保留本会话所有修复及文档，原任务已归档。远程最新正式版本 v2.10.19，已核对 October 标签/Release，拟用 2.10.20（发布前再次核对）。本轮尚未提交或推送。

## 验证与限制

实现基线的类型/lint/隔离构建已通过，详见上一任务归档；版本同步后按影响完成检查，推送后跟踪既有远程 CI。Computer Use 与 OpenMemory unavailable；无共享条目采用，无生产、恢复或容量验收通过结论。

## 下一步

同步版本与发布说明、提交推送、等待 CI，然后创建 Tag/Release 并检查镜像发布。质量门禁失败时先修复，不发布未验证稳定镜像。

## 发布准备进展

远程 main 与本地基线一致，最新 Tag/Release 为 v2.10.19；已同步下一版本 2.10.20 及 CHANGELOG。用户补充生产已运行 v2.10.19，Release Notes 已按保留数据卷的原地升级编写。版本与日志校验、2.10.20 隔离生产构建（含敏感产物闸门）通过。即将提交并推送 main，等待该提交 CI 成功后才创建 Tag/Release；当前仍未发布。

## 已提交推送

提交 e7294b5951286f7278fb60c72fa251d2f2501db5 已推送 origin/main。提交 Hook 的 typecheck/lint 通过，2.10.20 隔离生产构建通过；正在等待此提交的 GitHub Actions。尚未创建新 Tag 或 Release，未改动生产实例。用户进一步明确：Docker 镜像构建全部放在 GitHub Actions；本地未执行 docker build/run。后续仍按该约束执行。

## 源码 CI 已通过，即将发布

GitHub Actions CI run 39139519445 成功，目标提交 e7294b5951286f7278fb60c72fa251d2f2501db5。两个 job 均成功：Lint/Test/Coverage/Build 与生产 Playwright E2E。Node 测试 578 项、576 通过、0 失败（其余跳过，以原始日志为准），覆盖率门禁通过。即将为同一提交创建并推送 v2.10.20，再运行项目发布脚本创建 Release，随后跟踪候选镜像验收与稳定标签提升。未执行本地 Docker 构建或生产部署。

## Release 与分支保护现场

v2.10.20 Tag 已创建并推送，指向 e7294b5951286f7278fb60c72fa251d2f2501db5；GitHub Release 已发布：https://github.com/timorpic/Navelix/releases/tag/v2.10.20。镜像工作流 39139772662 正在 GitHub Actions 运行，目前源码质量两个 job 成功、候选镜像构建进行中；尚不能认定 latest 已更新。

用户新增 main 保护指示并明确选个人维护模式。已核对 ADMIN 权限、旧规则为空，PUT branch protection 后回读确认 protected=true：required PR，审批人数 0；strict CI 绑定 GitHub Actions app 15368，检查名为 Lint, Test & Build 与 Playwright E2E (Core UI Flow)；要求解决讨论、禁止 force/delete，enforce_admins=true。首次请求同时包含 deprecated contexts 与 checks 被 422 拒绝且未生效，移除 contexts 后同一策略成功；未降低规则。当前准备以 PR 记录治理和发布结果，不再直接推送 main。
