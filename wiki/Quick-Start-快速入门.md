# 🚀 快速入门与部署指南 (Quick Start & Deployment)

本指南将帮助您在 **Linux 服务器、NAS (群晖/威联通/TrueNAS)、树莓派、Windows 或 macOS** 上快速部署并启动 Navelix。

---

## 💻 系统环境要求 (System Requirements)

- **Docker 运行环境**（推荐）：Docker Engine 20.10+ 及 Docker Compose v2+
- **源码运行环境**（可选）：Node.js 20.x 或 22.x+，pnpm 9.x+
- **默认服务端口**：**`3721`**（如需映射为 80/443 或其他端口，可在命令或 Compose 中修改）
- **硬件配置**：
  - 内存：最低 256MB（推荐 512MB 以上）
  - 磁盘：100MB 基础磁盘空间 + 用户数据存储

---

## 🐳 部署方式一：Docker 容器化部署（推荐）

Docker 是最推荐的部署方式，所有运行依赖与环境已封装在官方轻量镜像中。

### 1. Docker CLI 一键启动
```bash
# 创建数据持久化目录
mkdir -p /opt/navelix/data && cd /opt/navelix

# 启动容器（默认服务端口 3721）
docker run -d \
  --name navelix \
  -p 3721:3721 \
  -v /opt/navelix/data:/app/data \
  -e NAVELIX_ADMIN_PASSWORD=MySecurePassword123! \
  -e TRUST_PROXY=true \
  -e TZ=Asia/Shanghai \
  --restart unless-stopped \
  timorpic/navelix:latest
```

### 2. Docker Compose 编排部署（推荐生产与 NAS 使用）
在项目目录中创建 `docker-compose.yml` 文件：

```yaml
version: '3.8'

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
      - NODE_ENV=production
      - NAVELIX_ADMIN_PASSWORD=MySecurePassword123!  # 可选：指定初始管理员密码；留空则在 data/ 生成随机强密码
      - NAVELIX_COOKIE_SECURE=false                 # 局域网 HTTP 保持 false；配置 HTTPS 反代时改为 true
      - TRUST_PROXY=true
      - TZ=Asia/Shanghai
    volumes:
      - ./data:/app/data
    healthcheck:
      test: ["CMD-SHELL", "node -e \"fetch('http://localhost:3721/login').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))\""]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 10s
```

启动命令：
```bash
docker compose up -d
```

---

## 📦 部署方式二：Node.js 源码直接部署

如果您希望直接在宿主机进行开发调试或源码运行：

```bash
# 1. 克隆代码仓库
git clone https://github.com/timorpic/Navelix.git
cd Navelix

# 2. 启用 corepack 并安装依赖
corepack enable
pnpm install

# 3. 构建生产包
pnpm build

# 4. 启动服务 (项目默认监听 3721 端口)
PORT=3721 pnpm start
```

---

## ⚙️ 核心环境变量清单 (Environment Variables)

| 环境变量名 | 默认值 | 必填 | 说明 |
| :--- | :--- | :---: | :--- |
| `PORT` | `3721` | 否 | 服务监听的 HTTP 端口（项目默认标准为 `3721`） |
| `NODE_ENV` | `production` | 否 | 运行环境模式 (`production` / `development`) |
| `NAVELIX_ADMIN_PASSWORD` | *(自动生成随机强密码)* | 否 | 首次初始化时默认管理员 `admin` 的初始密码（若未配置，系统会自动生成并输出到控制台与 `data/navelix-admin-password.txt`） |
| `NAVELIX_COOKIE_SECURE` | `false` | 否 | 认证 Cookie 是否强制 `Secure` 标头（局域网 HTTP 保持 `false`；使用域名并启用 HTTPS 反代时设为 `true`） |
| `TRUST_PROXY` | `false` | 否 | 是否信任上游反向代理的 `X-Forwarded-For` 真实 IP 标头（若前置部署了 Nginx/Caddy/Cloudflare，**务必设为 `true`** 以启用精准限流） |
| `DATABASE_PATH` | `/app/data/navelix.db` | 否 | SQLite 主数据库文件存储路径 |
| `TZ` | `Asia/Shanghai` | 否 | 容器运行时区设置 |

---

## 🔑 首次登录与初始化配置

1. 打开浏览器，访问 `http://your-server-ip:3721`；
2. 系统预置管理员账号：
   - **默认用户名**：`admin`
   - **默认密码**：您在环境变量中设置的 `NAVELIX_ADMIN_PASSWORD`（或查看容器控制台输出的随机强密码）；
3. **安全建议**：首次登录后，请立即进入 **「设置 → 账号管理」** 修改管理员密码，并根据需求创建子账号或配置个人 API Token。

---

## 🌐 反向代理与 HTTPS 配置建议 (Nginx 示例)

若您使用 Nginx 作为反向代理并配置 SSL 证书（代理至 Navelix 默认端口 `3721`）：

```nginx
server {
    listen 80;
    server_name navelix.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name navelix.yourdomain.com;

    ssl_certificate /etc/nginx/ssl/navelix.crt;
    ssl_certificate_key /etc/nginx/ssl/navelix.key;

    location / {
        proxy_pass http://127.0.0.1:3721;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

*下一步：请参阅 [[功能使用全手册|User-Guide-功能使用指南]] 了解 Navelix 的各项高级工作流与效率功能。*
