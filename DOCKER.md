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
      test: ["CMD-SHELL", "node -e \"fetch('http://localhost:3721/login').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))\""]
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

启动后，在局域网内任意设备浏览器访问：`http://<主机IP>:3721`

---

## 🔑 初始管理员账号与密码获取

- **默认账号**：`admin`
- **指定密码**：通过环境变量 `NAVELIX_ADMIN_PASSWORD` 指定。
- **自动生成密码**：若未指定 `NAVELIX_ADMIN_PASSWORD`，系统**仅在数据库为空时**自动生成 16 位随机强密码（scrypt 加盐哈希存储）：
  - 容器启动控制台日志：`docker logs navelix`，关键字 `[Navelix] 管理员 admin 的初始密码为:`
  - 宿主机（卷挂载后）：`./data/navelix-admin-password.txt`
  - 容器内：`/app/data/navelix-admin-password.txt`
- **只生成一次**：如果 `data` 卷已有数据库，不会重新生成密码，沿用现有密码；如需重置，删除 `data` 卷重新初始化，或通过 `NAVELIX_ADMIN_PASSWORD` 指定新密码。
- **旧库自动轮换**：若旧数据库管理员密码仍为遗留弱密码 `admin123`，升级启动时会自动轮换为随机强密码（同样写入日志与提示文件）。
- 登录后请前往后台管理界面（`/admin`）尽快修改密码，并删除提示文本文件。

> 💡 **http 局域网访问**：容器默认以 http 提供服务。如果登录后总是被弹回登录页，检查 `NAVELIX_COOKIE_SECURE` 是否误设为 `true`——局域网 http 部署应保持 `false`（默认）；只有使用 HTTPS 时才设为 `true`。

---

## ⚙️ 环境变量说明

| 环境变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3721` | 容器内服务监听端口 |
| `HOSTNAME` | `0.0.0.0` | 绑定网络主机地址 |
| `NAVELIX_ADMIN_PASSWORD` | *(留空)* | 初始管理员密码，留空则自动生成强密码 |
| `NAVELIX_COOKIE_SECURE` | `false` | 会话 Cookie 是否带 Secure 属性；局域网 http 保持 `false`，HTTPS 时设为 `true` |
| `NAVELIX_IMAGE_REPO` | `timorpic/navelix` | 版本更新检测使用的镜像仓库，可改为自己的仓库 |
| `TZ` | `Asia/Shanghai` | 容器运行时时区配置 |

---

## 💾 数据持久化卷 (Volumes)

| 容器内路径 | 宿主机映射推荐 | 说明 |
| --- | --- | --- |
| `/app/data` | `./data` | 保存 SQLite 数据库（`nexus.db`）、初始密码文本及相关持久化配置 |

> 💡 **权限提示**：如遇到宿主机挂载目录权限限制导致的 `ERR_SQLITE_ERROR 14: unable to open database file`，可以在宿主机运行 `sudo chown -R 1001:1001 ./data` 或 `sudo chmod 777 ./data` 赋权（新版镜像自带 entrypoint 脚本会自动修正底层目录权限）。

---

## 🔄 版本更新检测（内置）

Navelix 内置版本自检，**无需群晖更新检测或第三方工具**：

- 每次 GitHub Actions 构建镜像时，自动打 `sha-<commit>` 标签（不可变锚点）+ 更新 `latest`（仅 main 分支）
- 当你推送 Git 版本标签（如 `git tag v1.2.0 && git push --tags`）时，额外生成 `v1.2.0`、`v1.2` 语义化版本标签
- 登录后台 →「系统设置 → 版本与更新」，应用会自动（也可手动点击"检查更新"）对比 Docker Hub 上的最新版本
  - 日常构建（`sha-xxx`）：对比最新 `sha-*` 标签的时间戳
  - 发布版本（`v1.2.0`）：对比语义化版本号
- 有更新即提示升级：`docker compose pull && docker compose up -d`
- 检测结果缓存 10 分钟；`NAVELIX_IMAGE_REPO` 环境变量可指定自己的镜像仓库
- 部署建议：日常用 `latest` 跟随更新；发布/回滚时固定到 `sha-<commit>` 或 `v1.2.0` 精确标签

## 🔄 升级与维护

```bash
# 拉取最新镜像
docker compose pull

# 重建并启动容器
docker compose up -d

# 清理旧镜像
docker image prune -f
```

---

## ✨ 核心特性

- 导航管理：支持内置 3 大分类、图标连通性检测、Sun-Panel / 浏览器书签导入导出
- AI 智能助手：服务端代理请求，集成标准 OpenAI 兼容接口（DeepSeek / ChatGPT / Ollama 等）
- 个人工作台：系统内置头像库、自定义 LOGO、时钟、每日数据概览、多设备同步项目看板
- 安全高效：底层基于 Node 22 内置 `node:sqlite`（零原生 C 扩展依赖），非 root 权限运行
