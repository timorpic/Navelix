# Navelix · Personal Digital Hub

你的个人数字工作空间——网址导航、AI 助手、项目看板、效率工具，收进同一个首页。零外部数据库依赖，单容器轻量高效运行。

## 界面预览

<table width="100%">
  <tr>
    <td align="center"><img src="public/screenshots/light1.jpg" width="100%" alt="界面预览 1"></td>
    <td align="center"><img src="public/screenshots/light2.jpg" width="100%" alt="界面预览 2"></td>
  </tr>
  <tr>
    <td align="center"><img src="public/screenshots/dark1.jpg" width="100%" alt="界面预览 3"></td>
    <td align="center"><img src="public/screenshots/dark2.jpg" width="100%" alt="界面预览 4"></td>
  </tr>
</table>

## 功能特性

- **网址导航**：链接管理、分类筛选、快捷访问、多搜索引擎支持、全局 `⌘ K` / `Ctrl+K` 快速聚焦搜索、图标自定义（上传 / Iconify / favicon）、在线状态检测、书签导入导出（Sun-Panel / Chrome / HTML）
- **安全与防护**：内置 SSRF 防护（SafeFetch 校验）、全局 CSRF 校验、登录 Rate Limit 防伪造、HttpOnly Cookie 会话控制、密钥安全不下发
- **高可用与自动备份**：SQLite 级联删除 (CASCADE)、外键约束校验、`VACUUM INTO` 零锁定热备份（自动循环保留最近 7 份备份）
- **AI 智能助手**：集成标准 OpenAI 兼容 API（DeepSeek、ChatGPT、Ollama、Qwen 等），服务端代理请求，Key 不暴露前端
- **个性化工作台**：浅色/深色/跟随系统主题、自定义 LOGO 与网站文案、自定义头像、专注统计、侧边栏天气与时钟、项目看板
- **管理后台**（`/admin`）：链接/分组/项目/用户管理、个性化外观设置、配置导入导出、访问统计、实时版本更新自检
- **消息通知**：后台关键操作自动记录，前后台独立通知中心查看与一键标已读

## 技术栈

Next.js 16 (Turbopack) + React 19 + TypeScript + Tailwind CSS 4 + SQLite (`node:sqlite`) + pnpm

## 快速开始

```bash
pnpm install
pnpm dev          # 本地开发，http://localhost:3721
```

首次启动自动创建管理员 `admin`，随机密码输出到控制台及 `data/navelix-admin-password.txt`。

### Docker 部署（推荐）

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
      - NAVELIX_ADMIN_PASSWORD=your_secure_password  # 可选：指定初始管理员密码
      - NAVELIX_COOKIE_SECURE=false                  # 局域网 http 保持 false；HTTPS 时改为 true
      - TZ=Asia/Shanghai
    volumes:
      - ./data:/app/data
```

运行命令：

```bash
docker compose up -d
# 浏览器访问 http://<主机IP>:3721
```

## 环境变量说明

| 环境变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3721` | 容器内服务监听端口 |
| `HOSTNAME` | `0.0.0.0` | 绑定网络主机地址 |
| `NAVELIX_ADMIN_PASSWORD` | *(留空)* | 初始管理员密码，留空则自动生成强密码 |
| `NAVELIX_COOKIE_SECURE` | `false` | Cookie Secure 属性；HTTP 保持 `false`，HTTPS 设为 `true` |
| `TRUST_PROXY` | `false` | 是否信任反向代理 `X-Forwarded-For` 标头 |
| `NAVELIX_IMAGE_REPO` | `timorpic/navelix` | 版本更新检测使用的镜像仓库 |
| `TZ` | `Asia/Shanghai` | 容器运行时时区配置 |

## 项目结构

```text
navelix/
├── src/
│   ├── app/          # Next.js App Router 页面与 API 路由
│   ├── components/   # UI 组件库
│   ├── context/      # 全局状态 NavelixProvider
│   ├── hooks/        # 自定义 React Hooks
│   ├── lib/          # 安全/数据库/备份/SSRF/CSRF 核心逻辑
│   └── types/        # TypeScript 类型定义
├── data/             # SQLite 数据库持久化目录（运行时生成）
├── .github/workflows/ # GitHub Actions CI/CD Pipeline
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## 数据与隐私

所有数据存储在本地 SQLite（`data/nexus.db`）。AI API Key / 天气 Key 加密防下发，导出配置时不会泄露。系统具有内置自动热备份与崩溃数据恢复。

## 许可证

本项目采用**自定义许可证**（详见 [LICENSE](LICENSE)）：

- 个人非商业用途可免费使用
- **禁止修改**（不得创建衍生作品）
- **禁止商用**，商业使用必须联系作者获得书面授权

---

**Navelix · Personal Digital Hub** — 让每一个常用入口，都在它该在的地方。
