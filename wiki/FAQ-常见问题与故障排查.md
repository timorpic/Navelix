# ❓ 常见问题与故障排查 (FAQ & Troubleshooting)

本文档汇集了用户在部署、使用与集成 Navelix 过程中最常见的问题与解决方案。

---

## 📌 目录
- [1. 🐳 部署与网络相关问题](#1--部署与网络相关问题)
- [2. 🔑 账号、密码与登录排查](#2--账号密码与登录排查)
- [3. 📊 模型账号额度监控问题](#3--模型账号额度监控问题)
- [4. 📅 时区与日历订阅同步问题](#4--时区与日历订阅同步问题)
- [5. 💾 数据备份与恢复注意事项](#5--数据备份与恢复注意事项)
- [6. 🔧 仓库维护与依赖升级（维护者）](#6--仓库维护与依赖升级维护者)

---

## 1. 🐳 部署与网络相关问题

### Q1: Docker 容器启动后无法访问 3721 端口？
- **排查步骤**：
  1. 检查容器是否正常运行：`docker ps`；
  2. 查看容器实时日志：`docker logs navelix`；
  3. 检查宿主机防火墙是否放行了 **3721** 端口（如 `ufw allow 3721` 或云服务器安全组规则）。

### Q2: 前置 Nginx/Cloudflare 反向代理后，登录提示“尝试过多被锁定”？
- **原因**：反向代理未传递真实客户端 IP，导致所有用户请求被判定为同一代理 IP。
- **解决方案**：在容器环境变量中配置 `TRUST_PROXY=true`，并在 Nginx 配置中确保传递 `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`。

---

## 2. 🔑 账号、密码与登录排查

### Q1: 忘记了管理员初始密码怎么办？
- **解决方案**：
  1. 查看数据持久化目录下的 `data/navelix-admin-password.txt` 文件；
  2. 或通过重新设置环境变量 `NAVELIX_ADMIN_PASSWORD=your_new_password` 并重启容器。

### Q2: 为什么在 iPad 填完账号，打开电脑还要填密码？
- **解释**：
  - 出于网络安全与防泄漏原则，服务端**绝不会把明文密码回传给浏览器**；
  - 在电脑上打开后台时，密码框显示 `(✓ 服务端已保存)`，**留空不填即表示保持原密码不变**，无需每次重新输入。

---

## 3. 📊 模型账号额度监控问题

### Q1: 反重力账号授权/刷新失败，提示 `invalid_client`？
- **原因分析**：
  1. 后台「🔐 反重力 OAuth 配置」尚未填写 Google OAuth 客户端密钥（Client Secret）；
  2. 填入的密钥与 Navelix 应用的 `client_id` 不匹配。
- **解决方案**：
  - 登录后台 → 设置 → 🔐 反重力 OAuth 配置，粘贴正确的 `GOCSPX-…` 密钥并保存；
  - 保存后重新授权或点击「刷新」即可。

### Q2: 不再需要某个模型账号，怎么移除？
- **解决方案**：在「模型账号」面板中点击对应账号的「断开连接」，服务端会清除该账号的令牌与额度数据。

---

## 4. 📅 时区与日历订阅同步问题

### Q1: 手机日历订阅后没有立即显示最新日程？
- **原因**：Apple Calendar / Google Calendar 等外部日历客户端有自己的后台刷新周期。
- **解决方案**：在 Apple 日历订阅设置中将「自动刷新」设置为 **“每 15 分钟”** 或手动点击日历界面的“刷新日历”。

### Q2: 为什么我的待办日期和服务器相差一天？
- **解释**：Navelix v1.0.6 全面升级为本地时区对齐引擎（`toLocalDateStr`），请确保您的设备系统时区与服务器本地时区保持一致（如 `Asia/Shanghai`）。

---

## 5. 💾 数据备份与恢复注意事项

### Q1: 恢复数据库备份会覆盖当前数据吗？
- **注意**：
  - 上传 `.db` 文件恢复是一次性全局还原操作；
  - 为防止误操作，恢复前系统需要管理员输入当前密码进行二次确认，并在执行前自动在本地保留一份当前数据库快照。

### Q2: 升级后数据还在吗？数据库文件名怎么从 `nexus.db` 变成了 `navelix.db`？
- **解释**：新版本主数据库更名为 `navelix.db`。升级后首次启动时系统会自动检测旧的 `data/nexus.db` 并迁移为新库，**数据完整保留，无需手动操作**。
- **注意**：迁移完成后旧的 `data/nexus.db` 会保留在挂载卷中作为备份，确认数据正常后可以手动删除，释放磁盘空间。

---

## 6. 🔧 仓库维护与依赖升级（维护者）

### Q1: Dependabot 的依赖升级 PR 两个 CI job 全红，报 `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`？
- **原因**：这不是代码问题，而是 pnpm 11 起的**供应链门禁**：`minimumReleaseAge` 默认 **1440 分钟（24 小时）**，任何发布不满 24 小时的包版本都会被拒绝安装。Dependabot 为升级 `next` 等直接依赖重新生成 `pnpm-lock.yaml` 时，会顺带把传递依赖解析到当前最新版（例如 `baseline-browser-mapping@2.11.28` 在其发布仅 2 小时时被写入 lockfile），CI 在 `pnpm install` 阶段即被拦下。单纯重跑 CI 通常仍会失败，直到所有过新的条目都过了冷却期。
- **解决方案**（保留 bot 对 `package.json` 的版本升级，只重新生成 lockfile）：
  1. 用项目锁定的 pnpm 版本在容器内重新生成（本机无需安装 Node/pnpm）：
     ```bash
     mkdir -p /tmp/lockcheck && cp package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc /tmp/lockcheck/
     docker run --rm -v /tmp/lockcheck:/w -w /w node:22-alpine sh -c \
       'corepack enable && corepack prepare pnpm@11.16.0 --activate && cd /w && pnpm install --lockfile-only'
     ```
     重新解析会自动选择「冷却期外的最新版」，因此不会写入未满 24 小时的条目，同时只改动必要的依赖树。
  2. 核对差异收敛：正常情况下应只看到目标包（如 `next` 与 `@next/*` 平台二进制），传递依赖保持原版本、无额外漂移。
  3. 容器内跑一遍 CI 等价的全量验证：`pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test:coverage && pnpm build`（`--frozen-lockfile` 会重新执行供应链策略检查，通过即代表门禁不再拦截）。
  4. 把修正提交推回 dependabot 分支，等 PR 的 CI（含 Playwright E2E）转绿后再合并。
- **注意**：不要用 `minimumReleaseAgeExclude` 或调低 `minimumReleaseAge` 来「放行」被拦的版本——那等于关闭供应链门禁；正确做法是让解析器选出冷却期内可用的版本。
- **补充**：若需要的修复版**已过冷却期**、却因 pnpm 保留「范围已满足」的旧解析而未被抬升，可在 `pnpm-workspace.yaml` 的 `overrides` 中显式固定该版本线（参考既有 `js-yaml`、`brace-expansion@^5.0.0` 两条条目）。

---

*如果您遇到其他未在此列出的问题，欢迎前往 [GitHub Issues](https://github.com/timorpic/Navelix/issues) 提交反馈与讨论！*
