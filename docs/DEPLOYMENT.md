# 构建与部署

## 部署条件

Navelix 需要 Node 服务端和可写的本地数据目录。SQLite、文件备份、认证与后台守护任务意味着不能仅上传静态 HTML，也不能使用无持久磁盘的短生命周期函数部署作为当前方案。

优先单实例加持久卷。多副本、网络文件系统或无服务器部署需要另行验证数据库锁、文件持久性和守护任务重复执行，当前文档不提供此类部署承诺。

## Docker Compose

推荐使用现成镜像。仓库 `docker-compose.yml` 默认数据路径为 `/volume1/docker/navelix`，包含可选 Watchtower 服务；部署前修改宿主机路径、时区和更新策略。以下最小示例只运行应用：

```yaml
services:
  navelix:
    image: timorpic/navelix:latest
    container_name: navelix
    restart: unless-stopped
    ports:
      - "3721:3721"
    environment:
      PORT: "3721"
      HOSTNAME: "0.0.0.0"
      TZ: Asia/Shanghai
      NAVELIX_COOKIE_SECURE: "false"
    volumes:
      - ./data:/app/data
```

```bash
docker compose up -d navelix
docker compose logs --tail=100 navelix
curl --fail http://localhost:3721/api/healthz
```

首次运行自动创建管理员；可通过环境变量指定初始密码，或从控制台/数据目录初始密码文件获取随机密码。不要将真实密码写入公开仓库。容器以 UID/GID `1001:1001` 的 `nextjs` 用户运行，挂载目录须允许该身份写入。

生产部署建议固定已验收版本或镜像 digest，便于升级与回退。自建镜像可用 `docker build -t navelix:local .`，再将 Compose image 改为该标签。公开仓库不包含商业驱动源码；CE 构建可运行，完整 Pro 能力需要官方制品和有效许可。

## 源码部署

准备与 `package.json` 匹配的 Node 24 和 pnpm：

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm build
pnpm start
```

默认地址为 `http://localhost:3721`。`dev` 与 `start` 脚本写明 `-p 3721`；源码运行需要其他端口时使用 `pnpm exec next start -p 端口号`。为生产进程配置服务管理器，保持工作目录和数据路径稳定。

构建期间部分模块可能初始化数据库，建议构建与运行设置不同的 `NAVELIX_DATA_DIR`；不要用真实生产库执行构建或测试。standalone 运行需同时保留 `.next/standalone/`、`public/`、`.next/static/` 所需资源，仓库 Dockerfile 已处理复制及运行依赖补齐。

## 主要环境配置

| 变量 | 说明 |
| --- | --- |
| `NAVELIX_DATA_DIR` | 服务端数据根目录，默认 `<cwd>/data`；镜像默认运行于 `/app`，挂载 `/app/data` |
| `NAVELIX_ADMIN_PASSWORD` | 首次初始化的管理员密码；不是已初始化账号的通用重置开关 |
| `NAVELIX_COOKIE_SECURE` | HTTPS 部署设为 `true`；HTTP 使用 `false` |
| `TRUST_PROXY` | 仅在可信代理负责覆盖转发头的环境中启用 |
| `PORT` / `HOSTNAME` | standalone 容器监听端口和地址，默认镜像使用 3721 / 0.0.0.0 |
| `TZ` | 运行时时区，示例为 Asia/Shanghai；镜像未指定时通常为 UTC |
| `NAVELIX_LICENSE_KEY` | 可选商业许可，按授权机制激活 |
| `APP_SECRET` | 可选主加密密钥来源（至少 16 个字符）；未设置时使用数据目录 `.app_secret`，恢复时须保留相同密钥 |
| `NAVELIX_GITHUB_REPO` | 更新检测仓库，可供 fork 指定 |
| `NAVELIX_ANALYTICS` | 本地统计总开关，`off` 关闭 |
| `NAVELIX_ANALYTICS_REPORT` | 匿名周报总开关，`off` 关闭 |

其他遥测覆盖配置见 [README](../README.md) 和 `.env.example`，不要混淆本地统计和外部匿名周报。

## 反向代理与验收

代理转发到服务端 3721，使用 HTTPS 时启用 Secure Cookie 并保证 Origin/Host 转发一致。实时通知使用 SSE，代理需允许长连接并按需关闭缓冲。不要通过关闭 CSRF 或放宽 SSRF 规则解决代理配置错误。

部署后检查 `/api/healthz`：数据库读取、完整性和写锁检查失败返回 503；响应还提供迁移版本、守护任务标志与 WAL 大小。健康状态不能替代完整功能验收，还需检查登录、数据读写、静态资源、主题、实时更新及所需外部服务。

## 备份、升级与回滚

1. 升级前使用内置物理快照/备份功能创建可恢复备份，保留配置及加密所需材料；先确认恢复流程和目标版本。
2. 记录当前镜像版本/digest，再拉取目标版本并重建应用服务：`docker compose pull navelix`、`docker compose up -d navelix`。
3. 检查启动迁移日志、健康端点、登录与关键业务；确认后台备份仍正常。
4. 回滚时恢复兼容版本的镜像和升级前备份。只回退镜像不能保证兼容已经升级的 Schema。

运行中的 SQLite 使用 WAL；不要仅复制 `navelix.db` 作为完整热备份。优先使用应用的 SQLite 快照流程；文件级归档应停服后进行并保留相关配置与密钥材料。不要直接覆盖运行中的数据库；恢复前另存当前数据，完成后校验完整性及权限。

更多使用说明见 [DOCKER](../DOCKER.md)、[快速入门](../wiki/Quick-Start-快速入门.md) 与 [安全运维](../wiki/Security-安全机制与运维规范.md)。发布流水线见 [REGISTRY](REGISTRY.md)。
