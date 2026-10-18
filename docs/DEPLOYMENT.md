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

沿用 `latest` 镜像及原有 Watchtower 使用方式，无需新增镜像标签变量或 profile。发布流水线在候选镜像验收通过后才更新 `latest`。

```bash
docker compose up -d navelix
docker compose logs --tail=100 navelix
curl --fail http://localhost:3721/api/healthz
```

首次运行自动创建管理员；可通过环境变量指定初始密码，或从数据目录初始密码文件获取随机密码（控制台仅提示文件名）。不要将真实密码写入公开仓库。容器以 UID/GID `1001:1001` 的 `nextjs` 用户运行，挂载目录须允许该身份写入。

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

`pnpm build`、`pnpm test` 与 `pnpm test:coverage` 强制创建一次性系统临时数据目录并在结束后清理，不继承外部 `NAVELIX_DATA_DIR` 或生产密钥。直接调用 `next build` 或 Node 测试命令不经过此保护，禁止对真实生产库执行。standalone 运行需同时保留 `.next/standalone/`、`public/`、`.next/static/` 所需资源，仓库 Dockerfile 已处理复制及运行依赖补齐。

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


## 反向代理与验收

代理转发到服务端 3721，使用 HTTPS 时启用 Secure Cookie 并保证 Origin/Host 转发一致。实时通知使用 SSE，代理需允许长连接并按需关闭缓冲。不要通过关闭 CSRF 或放宽 SSRF 规则解决代理配置错误。

部署后检查 `/api/healthz`：公开探针只执行轻量数据库读取，失败返回 503，不扫描整库、不尝试写锁、不公开磁盘及迁移详情。管理员可调用 `GET /api/admin/health` 执行完整性/写锁检查并查看迁移、守护任务标志和 WAL 大小，全进程每分钟最多一次，超限返回 429。两者均禁止缓存。轻量探针不证明数据库可写；健康状态也不能替代完整功能验收。验收与外部监控步骤见 [生产验收与恢复演练](PRODUCTION-ACCEPTANCE.md)。

## 备份、升级与回滚

1. 升级前使用内置物理快照/备份功能创建可恢复备份，保留配置及加密所需材料；先确认恢复流程和目标版本。
2. 记录当前镜像版本/digest，再拉取目标版本并重建应用服务：`docker compose pull navelix`、`docker compose up -d navelix`。
3. 检查启动迁移日志、健康端点、登录与关键业务；确认后台备份仍正常。
4. 回滚时恢复兼容版本的镜像和升级前备份。只回退镜像不能保证兼容已经升级的 Schema。

运行中的 SQLite 使用 WAL；不要仅复制 `navelix.db` 作为完整热备份。优先使用应用的 SQLite 快照流程；文件级归档应停服后进行并保留相关配置与密钥材料。不要直接覆盖运行中的数据库；恢复前另存当前数据，完成后校验完整性及权限。

更多使用说明见 [DOCKER](../DOCKER.md)、[快速入门](../wiki/Quick-Start-快速入门.md) 与 [安全运维](../wiki/Security-安全机制与运维规范.md)。发布流水线见 [REGISTRY](REGISTRY.md)。

日志中心、文件保留、容量和容器轮转配置见 [日志中心说明](LOGGING.md)。迁移实例时应同时保留数据目录中的 `logs/settings.json`；它不包含在个人 JSON 导出或主库快照中。

密钥文件异常将阻止相关加密操作，不再退回固定密钥。历史异常实例的离线迁移、整机恢复材料及 RPO/RTO 演练见 [生产验收与恢复演练](PRODUCTION-ACCEPTANCE.md)。自动云备份启动后约两分钟检查一次，再每小时按持久化的成功上传时间检查；失败不推进成功时间。
