# 活动任务上下文

- schema_version: 1
- project_id: Navelix
- task_id: remove-home-greeting-20261020
- context_revision: 2
- updated_at: 2026-10-20T09:13:50+08:00
- release_version: 2.10.24
- status: completed

## 用户目标与授权

用户于 2026-10-20 根据截图要求移除红框内文案：删除首页欢迎卡片的挥手图标、时段问候语及用户名，保留日期、当前状态、搜索框和 AI 助手入口。用户随后要求启动预览，已授权使用独立演示数据提供本地预览；用户最新要求「发release吧」，已授权按既有流程提交、推送、PR 合并、Tag/Release 与自动镜像发布；不涉及直接生产操作。

## 验收与约束

对应内容不再渲染，清理仅用于问候语的依赖与计算。沿用 DESIGN.md 和现有组件布局。测试遵循用户 Computer Use 要求；工具不可用时如实记录限制。

## 入口与现场

实现：src/components/hero-banner.tsx；说明：DESIGN.md、CHANGELOG.md 的 [2.10.24]。现场见 CHECKPOINT.md。上一任务上下文及检查点已归档至 archive/assistant-header-row-20261019/。

## 发布结果

v2.10.24 已通过 PR #27 合并、推送 Tag 并发布正式 Release；main CI 与镜像流水线成功，两个 registry 六个稳定标签回读均与被测镜像一致。预览已关闭。验证证据及本地未提交接力记录边界见 CHECKPOINT.md。
