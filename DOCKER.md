# Navelix · Personal Digital Hub (Docker 部署指南)

> 你的个人数字工作空间。不是网址导航，而是你每天打开浏览器第一个看到的——属于你的个人数字中枢。

Navelix 面向个人用户，把网址导航、AI 助手、效率工具、个人品牌展示和项目看板收进同一个首页。零外部数据库依赖，单容器轻量高效运行。

---

## 🚀 快速启动

> 镜像由 GitHub Actions 自动构建、冒烟测试并发布，来源：
> - Docker Hub：`timorpic/navelix:latest`（尽力同步，若上游抖动失败可从 GHCR 拉取）
> - GitHub Container Registry (GHCR)：`ghcr.io/timorpic/navelix:latest`

### 方式一：Docker Compose（推荐）

创建 `docker-compose.yml` 文件：

```yaml
name: navelix

services:
  navelix:
    image: timorpic/navelix:latest
    container_name: navelix
    restart: unless-stopped
    ports:
      - "3721:3721"
    environment:
      - PORT=3721
      - HOSTNAME=0.0.0.0
      - NAVELIX_ADMIN_PASSWORD=your_secure_password  # 可选：指定初始管理员密码
      - NAVELIX_COOKIE_SECURE=false                  # 局域网 http 保持 false；HTTPS 时改为 true
      - TZ=Asia/Shanghai
    volumes:
      - ./data:/app/data
    healthcheck:
      test: ["CMD-SHELL", "node -e \"fetch('http://localhost:3721/api/healthz').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))\""]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 10s
```

运行命令：

```bash
docker compose up -d
```

> 📌 **容器名与数据卷路径请以你实际部署的为准。**
> 上面的示例命名为 `navelix`、卷为 `./data`；而仓库自带的 `docker-compose.yml` 使用的是 `container_name: rA9-timorpic-navelix` 与绝对路径卷。
> 下文所有 `docker stop navelix` 之类的运维命令，都请替换成你自己 compose 里的 `container_name`。

### 方式二：Docker CLI 直接运行

```bash
docker run -d \
  --name navelix \
  -p 3721:3721 \
  -v $(pwd)/data:/app/data \
  -e NAVELIX_ADMIN_PASSWORD=your_secure_password \
  --restart unless-stopped \
  timorpic/navelix:latest
```

---

## ⚙️ 环境变量与参数说明

| 环境变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3721` | 容器内服务监听端口（镜像内已固定 3721；如需对外换端口，改 `ports` 映射即可） |
| `HOSTNAME` | `0.0.0.0` | 绑定网络主机地址 |
| `NAVELIX_ADMIN_PASSWORD` | *(留空)* | 初始管理员密码，留空则自动生成随机强密码并保存在 `data/` 目录下 |
| `NAVELIX_COOKIE_SECURE` | `false` | Cookie Secure 属性；HTTP 保持 `false`，HTTPS 设为 `true` |
| `TRUST_PROXY` | `false` | 是否信任反向代理 `X-Forwarded-For` 标头 |
| `NAVELIX_DATA_DIR` | `/app/data` | 数据目录（SQLite 库、备份、`.app_secret`）覆盖项；常规部署无需修改 |
| `NAVELIX_GITHUB_REPO` | `timorpic/Navelix` | 版本更新检测使用的 **GitHub 仓库**（`owner/repo`，走 Releases API）；fork 后可指向自己的仓库 |
| `NAVELIX_LICENSE_KEY` | *(留空)* | 商业版 License Key，容器启动时注入激活；也可稍后在后台网页激活 |
| `NAVELIX_ANALYTICS` | `on` | 本地使用统计开关：数据**仅写入本机 SQLite，永不外发**；`off` 全局关闭，也可在后台「访问统计」页停用 |
| `NAVELIX_ANALYTICS_REPORT` | `on` | 匿名周报开关（每周一次匿名聚合计数）；可在后台「个人账号与安全」页关闭 |
| `TZ` | `UTC` | 容器运行时时区。**镜像本身未设默认值**（即 UTC）；示例 Compose 中设为 `Asia/Shanghai`，需要本地时区请显式传入 |

---

## 💾 数据持久化与备份

所有业务数据、系统配置、用户信息均存储于挂载的 `/app/data` 目录（例如 `navelix.db`）。
- 支持后台一键下载 `.db` 完整数据库物理快照；
- 支持后台直接上传历史 `.db` 备份文件一键还原全量数据。

> **🔄 旧版本升级迁移（nexus.db → navelix.db）**
> 早期版本主数据库名为 `nexus.db`。新版本升级后首次启动时，系统会自动检测挂载卷中的 `data/nexus.db`，
> 并将其自动迁移为新的 `data/navelix.db`（数据完整保留），**无需手动操作**。
> 迁移完成后旧的 `data/nexus.db` 会被保留作为备份，确认数据无误后可手动删除该文件。
> 历史备份文件（`data/backups/nexus-backup-*.db`）仍可正常用于后台还原。

### 🚨 升级前快照（强烈建议）

镜像升级（尤其配合 Watchtower 自动更新时）前，先对数据卷做一次物理快照，保证任何迁移故障都可回滚：

```bash
# 停止服务后复制整个数据卷
cd /volume1/docker
docker stop navelix
tar -czf "navelix-data-$(date +%Y%m%d-%H%M%S).tar.gz" navelix/
docker start navelix
```

或不停机在线复制（WAL 下最终一致性略弱，但无需停机）：

```bash
docker run --rm -v /volume1/docker/navelix:/src:ro -v "$(pwd)":/dst alpine \
  tar -czf "/dst/navelix-$(date +%Y%m%d-%H%M%S).tar.gz" -C /src .
```

> **关于自动备份**：`data/backups/*.db` 目录最多保留最近 **7 份**，超出会自动清理。
> 但请注意触发来源 —— **免费版本没有定时自动备份**（后台的手动备份、迁移前的自动快照，以及 Pro 版的每日云端备份才会生成快照）。
> 因此升级前请务必按上面的方式自行做整卷快照。
> Watchtower 用户：建议将 Watchtower 改用手动触发或公告窗口，先快照再 `watchtower --run-once`。
> （仓库自带的 `docker-compose.yml` 已内置 watchtower 服务，但请注意其 `--cleanup` 参数指向的容器名与实际的 `container_name` 不一致，自动更新可能不生效，使用前请先核对。）

### 🔑 主加密密钥（APP_SECRET / .app_secret）说明

所有敏感凭据（模型账号令牌、AI Key、天气 Key）由主密钥以 **AES-256-GCM** 加密后落库。主密钥来源优先级：

1. 环境变量 `APP_SECRET` —— **长度需 ≥ 16 字符**，实际密钥由它的 SHA-256 摘要派生（并非直接使用该值）；
2. 否则使用 `data/.app_secret` —— 32 字节随机数的 64 位 hex。该文件在**首次需要加密时按需生成**（权限 `0600`），不是安装/迁移时预置的。

> ⚠️ **重要：目前没有「全库重新加密」工具，换密钥会丢凭据**
>
> 代码中不存在任何批量重加密的实现（`scripts/` 与后台均无此功能）。解密失败时系统的行为是
> **静默返回空字符串**（仅打印一行服务端日志，界面无任何报错）。
>
> 因此：**改动 `APP_SECRET` 或替换 `.app_secret` 后，此前加密的所有凭据会全部无法解密**，
> 表现为后台里的模型账号令牌 / AI Key / 天气 Key「突然空白」。
>
> 若确需轮换主密钥，正确顺序是：
>
> ```bash
> # 1) 停机 + 整卷快照（回滚兜底，见上一节）
> docker stop navelix
> tar -czf "navelix-pre-rotate-$(date +%Y%m%d).tar.gz" -C /path/to/your/data-volume .
> cp /path/to/your/data-volume/.app_secret /path/to/your/data-volume/.app_secret.bak
>
> # 2) 更换密钥：写入新的 .app_secret，或设置新的 APP_SECRET 环境变量
> openssl rand -hex 32 > /path/to/your/data-volume/.app_secret
> chmod 600 /path/to/your/data-volume/.app_secret
>
> # 3) 启动，并【立即】在后台重新填写所有加密凭据
> docker start navelix
> ```
>
> **第 3 步不可省略** —— 只做 1→2 而不重新录入，等于把凭据丢干净。
>
> 若凭据泄露但只是想止损，更稳妥的做法是**只轮换泄露的那一条凭据本身**（在对应后台页面重新录入），而不是更换主密钥。

---

**Navelix · Personal Digital Hub** — 让每一个常用入口，都在它该在的地方。
