# Navelix · Personal Digital Hub (Docker 部署指南)

> 你的个人数字工作空间。不是网址导航，而是你每天打开浏览器第一个看到的——属于你的数字中枢。

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
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 10s
```

运行命令：

```bash
docker compose up -d
```

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
| `PORT` | `3721` | 容器内服务监听端口 |
| `HOSTNAME` | `0.0.0.0` | 绑定网络主机地址 |
| `NAVELIX_ADMIN_PASSWORD` | *(留空)* | 初始管理员密码，留空则自动生成随机强密码并保存在 `data/` 目录下 |
| `NAVELIX_COOKIE_SECURE` | `false` | Cookie Secure 属性；HTTP 保持 `false`，HTTPS 设为 `true` |
| `TRUST_PROXY` | `false` | 是否信任反向代理 `X-Forwarded-For` 标头 |
| `NAVELIX_IMAGE_REPO` | `timorpic/navelix` | 版本更新检测使用的镜像仓库 |
| `TZ` | `Asia/Shanghai` | 容器运行时时区配置 |

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

> 应用内每日自动备份（`data/backups/*.db`）只保留最近 7 份，升级前请额外做整卷快照。
> Watchtower 用户：建议将 Watchtower 改用手动触发或公告窗口，先快照再 `watchtower --run-once`。

### 🔑 主加密密钥（APP_SECRET / .app_secret）轮换 SOP

所有敏感凭据（模型账号令牌、AI Key、天气 Key）由主密钥加密后落库。主密钥来自：
1. 环境变量 `APP_SECRET`（未设置则用 2.）；
2. 迁移生成的 `data/.app_secret`（64 位 hex）。

> 若认为主密钥泄露，可执行全库重加密（生成新主密钥 → 解密旧密文 → 用新密钥重新加密写入）。

```bash
# 1) 停止服务
docker stop navelix

# 2) 备份旧密钥与数据（回滚兜底）
cp /volume1/docker/navelix/.app_secret /volume1/docker/navelix/.app_secret.bak
tar -czf "navelix-pre-rotate-$(date +%Y%m%d).tar.gz" /volume1/docker/navelix/

# 3) 生成新主密钥并写入（64 位 hex，权限 0600）
openssl rand -hex 32 > /volume1/docker/navelix/.app_secret
chmod 600 /volume1/docker/navelix/.app_secret

# 4) 启动后，登录后台：设置 → 重新加密全库（若后端提供该工具），
#    或执行内置迁移命令 / 手动触发全库重加密脚本
docker start navelix
```

> 说明：新主密钥生成后，旧密文无法再解密；必须先完成"解密旧→加密新"的重加密流程再对外暴露服务。
> 该流程未来将提供后台一键操作（见路线图）。轮换期间请勿登录写操作，避免部分数据使用旧密钥。

---

**Navelix · Personal Digital Hub** — 让每一个常用入口，都在它该在的地方。
