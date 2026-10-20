# 当前检查点

- schema_version: 1
- project_id: Navelix
- task_id: remove-home-greeting-20261020
- context_revision: 2
- checkpoint_seq: 5
- updated_at: 2026-10-20T09:13:50+08:00
- owner: Codex
- status: completed
- current_step: v2.10.24 Release 与镜像发布验收完成

## 现场与交付范围

- repo_root: /root/Navelix
- branch: main
- HEAD: e81d44d2b2cf108ffca0307e1c7f10cd613b4ca5（v2.10.24 Tag 对应提交，与 origin/main 一致）。
- 首页移除挥手图标、时段问候语、用户名及专用读取计算；保留日期、状态、搜索及 AI 入口。根据自动审查保留 sr-only「工作空间」h1，无新增可见文案。
- DESIGN、CHANGELOG 和四处版本位置已同步，随 PR #27 合并。无 Schema 或部署方式变化。
- 预览已关闭：原 exec session 86834 exit 130，3723 端口不再监听；演示目录独立，未访问真实业务库。
- 本地仅接力记录及 previous 备份有未提交更新；应用实现、版本、设计说明、更新日志及上一任务归档已提交并发布。实际文件状态以 git status 为准。

## 验证证据

- 本地 pnpm typecheck、pnpm lint、pnpm build、版本/CHANGELOG 校验、git diff --check 通过。构建使用项目一次性隔离目录。
- PR 最终 CI run 39351240852 success：645 tests / 175 suites，行覆盖率 90.81%、函数 85.31%，31 项 E2E 通过。
- main CI run 39351472583 success。
- 镜像 run 39351510753 success：质量检查、候选构建、运行冒烟、历史 v20 库升级、生产镜像 UI、稳定标签提升及结果通知全部成功。
- GHCR / Docker Hub 的 v2.10.24、2.10.24、latest 六个标签已独立回读，均与被测 candidate-39351510753-1 一致：sha256:05ddc79039d054f0b0ca1c595410ce246b42e1ad166075ff9b5b0bc20a774306。
- Computer Use unavailable；未声称人工浏览器测试通过。用户已查看独立预览后授权发布，自动验证与人工证据分别记录。
- OpenMemory unavailable，无新增共享条目；无需要新增到 MEMORY 的架构或长期约束。

## 外部操作台账

- 发布分支 codex/remove-home-greeting-2.10.24；最终分支提交 5e6f553ca00be359da94372fd4a43e1c519fdf95。
- PR #27：https://github.com/timorpic/Navelix/pull/27 ，必需检查通过且无障碍审查讨论解决后 squash 合并。
- 附注 Tag v2.10.24 已推送，指向上述 main 发布提交。
- 正式 Release（非草稿、非预发布）：https://github.com/timorpic/Navelix/releases/tag/v2.10.24 。
- 流水线：https://github.com/timorpic/Navelix/actions/runs/39351510753 。
- 无直接生产部署、生产库写入或本地 Docker 构建。保持既有 latest / Watchtower 使用方式。

## 本轮结果与后续

授权的修改、预览及正式 Release / 镜像发布全部完成。无发布阻塞；不将流水线成功等同于已确认用户生产实例自动升级。后续若需要确认生产运行版本，应另行查询实际实例。接力证据更新留在本地，未创建额外文档 PR。
