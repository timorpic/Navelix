<p align="center">
  <img src="public/logo.svg" width="108" height="108" alt="Navelix Logo" style="border-radius: 24px;">
</p>

<p align="center">
  <img src="public/navelix-title.svg" width="700" alt="Navelix · Personal Digital Hub">
</p>

<p align="center">
  <strong>现代化全栈个人数字工作空间</strong><br>
  网址导航 · AI 智能助手 · 21天甘特图 · 日历日程 · 跨设备漫游 · 本地优先 SQLite
</p>

<p align="center">
  <a href="https://github.com/timorpic/Navelix/releases"><img src="https://img.shields.io/github/v/release/timorpic/Navelix?color=00C776&label=Version" alt="Release"></a>
  <a href="https://github.com/timorpic/Navelix/pkgs/container/navelix"><img src="https://img.shields.io/badge/Docker-3721:3721-00C776?logo=docker" alt="Docker"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Custom-00C776" alt="License"></a>
  <a href="https://github.com/timorpic/Navelix/wiki"><img src="https://img.shields.io/badge/Wiki-Documentation-00C776?logo=gitbook" alt="Wiki"></a>
</p>

---

你的个人数字工作空间——网址导航、AI 智能助手、项目管理看板、交互式甘特图、日历日程与效率工具，收进同一个首页。零外部数据库依赖，单容器轻量高效运行。

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

- 🧭 **网址导航**：链接/分类管理、快捷访问、多引擎搜索、`⌘K` 快速聚焦、Favicon 自动提取、书签多格式导入导出
- 🤖 **AI 智能助手**：接入标准 OpenAI 兼容 API（DeepSeek / ChatGPT / Ollama / Qwen 等），服务端代理不泄露 Key；项目一键拆解为行动清单、每日日程智能规划
- 👥 **成员与指派**：支持成员账号与任务责任人指派，服务端统一存储，跨设备漫游
- 📊 **项目与甘特图**：四维指标看板、21 天交互式甘特图（周末高亮 / 今日指示线 / 里程碑进度）
- 📅 **日历与效率**：月/周/今日视图、本地时区严格计算、过期待办一键顺延、番茄钟、天气与指针表盘
- 🔒 **安全可控**：公开/私有两种访问模式、开放/关闭注册、SSRF / CSRF / 登录限流 / HttpOnly 会话
- 💾 **备份还原**：SQLite `VACUUM INTO` 热备份、`.db` 物理快照一键下载还原、全量 JSON 导入导出
- ⚙️ **系统扩展**：自定义搜索引擎（`%s` 模板）、无源码注入统计探针与全局 CSS、一键存储清理
- 🔌 **开放 API**：Personal Access Token（`nvx_live_...`）Bearer 鉴权，完整 [API 文档](wiki/REST-API-开放接口文档.md) 集成脚本与自动化
- 🛠️ **管理后台**（`/admin`）：链接/项目/用户/Token/会话管理、外观定制、版本自检

---

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

---

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

---

## 数据与隐私

所有数据存储在本地 SQLite（`data/nexus.db`）。AI API Key / 天气 Key 仅保存在本地数据库且由服务端安全代理，导出配置时不会泄露。系统具备内置物理热备份与快速数据恢复。

---

## 许可证

本项目采用**自定义许可证**（详见 [LICENSE](LICENSE)）：

- 个人非商业用途可免费使用
- **禁止修改**（不得创建衍生作品）
- **禁止商用**，商业使用必须联系作者获得书面授权

---

**Navelix · Personal Digital Hub** — 让每一个常用入口，都在它该在的地方。
