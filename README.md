# Navelix · Personal Digital Hub

你的个人数字工作空间——网址导航、AI 助手、项目看板、效率工具，收进同一个首页。

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

- **网址导航**：链接管理、分类筛选、搜索、快捷访问、图标自定义（上传 / Iconify / favicon）、在线状态检测、书签导入导出（Sun-Panel / Chrome）
- **AI 智能助手**：集成 OpenAI 兼容 API（DeepSeek、ChatGPT、Ollama 等），服务端代理，密钥不暴露前端
- **个性化工作台**：浅色/深色主题、自定义 LOGO、站点标题、头像、内容宽度、侧边栏时钟/天气、每日数据概览、当前项目看板
- **多用户 & 权限**：注册/登录/登出，密码 scrypt 加盐哈希，会话 HttpOnly Cookie，管理员控制台
- **管理后台**（/admin）：链接/分组/项目/用户管理、个性化设置、配置导入导出、访问统计、版本更新自检、系统设置
- **消息通知**：后台操作自动记录，前台与后台铃铛中查看

## 技术栈

Next.js 16 + React 19 + TypeScript + Tailwind CSS 4 + SQLite（`node:sqlite`） + pnpm

## 快速开始

```bash
pnpm install
pnpm dev          # 本地开发，http://localhost:3721
```

首次启动自动创建管理员 `admin`，随机密码输出到控制台及 `data/navelix-admin-password.txt`。

### Docker 部署

```bash
docker compose up -d
# 局域网内 http://<主机IP>:3721 即可访问
```

环境变量：`NAVELIX_ADMIN_PASSWORD`（指定初始密码）、`NAVELIX_COOKIE_SECURE`（HTTPS 时设为 true）、`NAVELIX_IMAGE_REPO`（更新检测仓库）。

## 项目结构

```text
navelix/
├── src/
│   ├── app/          # 页面与 API 路由
│   ├── components/   # UI 组件
│   ├── context/      # 全局数据 Context
│   ├── lib/          # 服务端逻辑（数据库、认证）
│   └── types/        # TypeScript 类型
├── data/             # SQLite 数据库（运行时生成，已 gitignore）
├── .github/workflows/ # CI/CD
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## 数据与隐私

数据存储在本地 SQLite（`data/`），AI API Key 存储在数据库，导出配置时不会写入 Key。`.env*`、`.next`、`node_modules` 均不会提交到仓库。

## 许可证

本项目采用**自定义许可证**（详见 [LICENSE](LICENSE)）：

- 个人非商业用途可免费使用
- **禁止修改**（不得创建衍生作品）
- **禁止商用**，商业使用必须联系作者获得书面授权

---

**Navelix · Personal Digital Hub** — 让每一个常用入口，都在它该在的地方。
