# 当前检查点

- schema_version: 1
- project_id: Navelix
- task_id: launch-hardening-20261018
- context_revision: 1
- checkpoint_seq: 4
- updated_at: 2026-10-18T23:08:21+08:00
- owner: Codex（本次会话）
- status: handoff_ready
- current_step: 实现与可用静态/构建验证完成；业务及生产验收受工具和目标环境限制，未认定生产放行
- base_commit: cfd0af2e91b9534138533b445980f2d0b0e3959c

## 授权与工作区

用户在评审后明确要求「全面修复」。本次已修改本地实现、回归用例、发布配置及文档。保留上轮评审未提交文件与原交接归档；未提交、推送、发版、部署、发送外部消息或修改真实业务数据。未启动其他 Agent。

修改范围：
- 密钥：src/lib/secret.ts、secret-recovery.ts、scripts/recover-secrets.mjs。
- 恢复与迁移：admin/backup、admin/storage、migrations/versions/v11.ts、v15.ts。未新增或复用迁移编号。
- 探针：admin/health 新接口与公开 healthz；云备份：daemon.ts、daemon/cloud-backup.ts、cloud-backup-state.ts。
- 账号入口：auth/login、auth/register、request-body.ts、rate-limit.ts、注册页及中英字典。
- 构建与发布：package.json、scripts/run-isolated.mjs、next.config.ts、playwright.config.ts、两个 GitHub 工作流、Compose。
- 回归：新增 secret-key、secret-recovery、restore-protection、migration-protection、cloud-backup-state、request-body 测试；更新 e2e/healthz。
- 文档：CHANGELOG、README 中英文、DOCKER、MEMORY、开发/部署/分发、两份 Wiki、上线报告与新增生产验收手册；交接文件及归档。

所有本次变更均未暂存。ignored 的 .next 为构建产物；真实 data 与环境密钥未作为运行数据库使用，未读取或输出密钥内容。构建强制使用一次性系统临时目录，结束后清理。

## 已完成

- 主密钥格式/普通文件校验、原子创建、异常失败关闭；历史固定兜底只在显式离线迁移工具中接受，不进入正常运行路径。
- 本地与云端恢复在保护备份失败时返回 503。构建日志进一步发现 v11/v15 同类风险，已改为无旧对象时跳过、备份失败终止、事务内修改结构。
- 发布先运行源码质量门禁，再构建候选，按 digest 进行冒烟/升级/生产 UI 验证，成功后提升稳定标签并核对 digest。手动运行、预发布不提升 latest，非应用 Release 跳过。
- 公开探针轻量化；管理员深度诊断每进程每分钟最多一次，并提供上次成功云备份时间。
- 云备份启动补检查及每小时重试，只有成功上传才持久化成功时间和目的地摘要。
- 测试/覆盖率/构建数据隔离；构建清理旧 standalone 及 instrumentation trace 引入的运行数据副本，再检查敏感运行文件。
- 登录/注册的流式请求大小、字段长度及入口频率限制；自主注册密码 12–256 字符，显示名称最多 100 字符。登录密码新增上限，未增加既有密码最低长度要求。
- 运维材料清单、离线解密验证、旧密钥迁移、Computer Use 验收、RPO/RTO、容量与外部告警步骤已写 docs/PRODUCTION-ACCEPTANCE.md。

## 验证证据

验证绑定本轮最终实现及依赖环境（Node 24、已安装 pnpm/dependencies）；最终检查后仅回填文档与检查点，无业务实现变动。

- pnpm typecheck：最终执行通过（退出码 0）；显式设置独立 NAVELIX_DATA_DIR。新增测试源码也纳入类型检查。
- pnpm lint：最终执行通过（退出码 0）。
- pnpm build：最终执行通过（退出码 0），使用自动创建的隔离目录，完成生产编译/类型/页面生成/standalone 敏感文件闸门。
- 产物文件名检查：standalone 中主库、WAL/SHM、主密钥及初始密码文件数量为 0；server trace 中原运行数据引用已移除。未读取密钥内容。
- YAML 解析、工作流内嵌 shell 的 bash -n、两个新脚本 node --check、字典 key 一致性、新文档相对链接及 git diff --check：通过。
- 未安装 actionlint，YAML/shell 解析不代表 GitHub Actions 已实际执行。

中间失败已处理：
1. 新增越界 tracing glob 导致 Turbopack panic，已限制至项目根目录内。
2. 敏感产物闸门捕获 instrumentation trace 夹带的 data 文件，已增加生成副本与 trace 清理；最终扫描为 0。
3. 构建日志中的 v15 备份失败后继续迁移风险已修复，最终构建未再出现该告警。

## 未执行 / 验证限制

按用户要求业务测试使用 Computer Use，当前无对应工具。新增回归用例已编写但未运行；未运行 pnpm test、test:coverage 或 test:e2e。没有运行 Docker 镜像、真实 HTTPS 反代、云端服务、空白实例恢复、压力/磁盘故障或 RPO/RTO 演练。没有执行旧密钥迁移工具，不能声称真实凭据已经迁移或恢复通过。

远程 CI、registry 提升与目标生产环境尚未验证；不继承旧检查点的通过结论。不将自动 CI 配置已修改表述为远程 CI 已通过。

OpenMemory unavailable，无召回条目采用。MEMORY 已更新本地稳定事实与 unavailable 说明，未 retain。

## 升级与下一步

1. Computer Use 可用后在独立生产候选环境执行验收与恢复故障场景；业务回归和 CI 实际结果分别记录。
2. 按生产验收手册补齐真实反代、云备份、恢复、容量与外部告警证据，再作放行判断。
3. 按用户最新指示保持 latest 与原有 Watchtower 使用方式；监控深度字段切换到管理员 /api/admin/health。提交、推送与发布仍待用户实际授权。

## 恢复与外部台账

无待核验的外部写入操作。上一版现场见 .handoff/previous/CHECKPOINT.launch-hardening.seq2.md；上轮评审上下文见 .handoff/archive/launch-readiness-review-20261018/。当前为实现完成、业务及生产验收受阻的可交接现场。

## 最新用户调整

用户明确要求「用 latest，保持原有使用方式」。已将 Compose 恢复到基线的 latest 和 Watchtower 启动方式，移除新增标签变量及 auto-update profile，相关中英文入口、部署/验收文档和更新日志同步修正。发布流水线先验收再更新 latest 的门禁保留。Compose 与 HEAD 基线无差异；YAML 静态解析与 git diff --check 通过。此次仅恢复部署配置与文档，未重新运行业务测试或构建，未部署。用户偏好已写本地 MEMORY，共享记忆仍 unavailable。
