<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/navelix-logo-dark.svg">
    <img src="public/navelix-logo.svg" width="520" alt="Navelix · Personal Digital Hub">
  </picture>
</p>

<p align="center">
  <strong>Your all-in-one personal digital workspace</strong><br>
  Bookmark hub · AI assistant · Multi-scale Gantt · Calendar & todos · Cross-device sync · Local-first SQLite
</p>

<p align="center">
  🌐 <strong>English</strong> · <a href="README.md">简体中文</a>
</p>

<p align="center">
  <a href="https://github.com/timorpic/Navelix/releases"><img src="https://img.shields.io/github/v/release/timorpic/Navelix?color=00C776&label=Version" alt="Release"></a>
  <a href="https://hub.docker.com/r/timorpic/navelix"><img src="https://img.shields.io/docker/pulls/timorpic/navelix?color=00C776&logo=docker" alt="Docker Pulls"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Custom-00C776" alt="License"></a>
  <a href="https://github.com/timorpic/Navelix/wiki"><img src="https://img.shields.io/badge/Wiki-Documentation-00C776?logo=gitbook" alt="Wiki"></a>
  <a href="https://t.me/+c6qtFiK5Lk9hZDZl"><img src="https://img.shields.io/badge/Telegram-Community-26A5E4?logo=telegram" alt="Telegram"></a>
</p>

---

## Your personal digital hub, all on one home page

**Navelix (Personal Digital Hub)** is a modern, full-featured personal digital workspace built for geeks, developers, and independent creators:
bookmark navigation, AI assistant, project kanban, interactive Gantt charts, calendar & todos — all on a single home page.

Zero external database dependencies, single lightweight container, and 100% of your data stays on your own machine.

### Why Navelix?

- 🧭 **One-stop workspace**: bookmarks, AI assistant, project board, Gantt, calendar & productivity tools in a single home page
- 🤖 **Deep AI integration**: standard OpenAI-compatible API, one-click project breakdown into action lists, daily schedule planning, real-time model quota monitoring
- 📱 **Multi-device sync**: cross-device roaming, Chrome extension quick capture, PWA / iOS Shortcuts widgets
- 🔒 **Privacy-first & local storage**: zero external dependencies, data on your own machine, SQLite hot backups, S3 / WebDAV cloud disaster recovery, public/private access & brute-force rate limiting

## Screenshots

<table width="100%">
  <tr>
    <td align="center"><img src="public/screenshots/light1.jpg" width="100%" alt="Light preview 1"></td>
    <td align="center"><img src="public/screenshots/light2.jpg" width="100%" alt="Light preview 2"></td>
  </tr>
  <tr>
    <td align="center"><img src="public/screenshots/dark1.jpg" width="100%" alt="Dark preview 1"></td>
    <td align="center"><img src="public/screenshots/dark2.jpg" width="100%" alt="Dark preview 2"></td>
  </tr>
</table>

## Core Features

| Module | Highlights |
| :--- | :--- |
| 🔖 **Bookmark hub** | Link/category management, quick access, multi-engine search, `⌘K` quick focus, multi-format bookmark import/export, link health monitoring |
| 📊 **Projects & Gantt** | 4-dimension dashboard (progress/tasks/risk/updates), multi-scale interactive Gantt (21-day agile / 12-month yearly / 3-year roadmap) |
| 📅 **Calendar & productivity** | Month/week/today views, strict local-timezone handling, overdue auto-rollover, ICS calendar two-way subscription, pomodoro |
| 🤖 **AI hub** | Standard OpenAI-compatible API, project breakdown into action lists, daily schedule planning, Antigravity / Codex quota monitoring |
| 📱 **Multi-device ecosystem** | Chrome extension capture, PWA / iOS Shortcuts, offline Service Worker, cross-device roaming |
| 🔌 **Open API** | Personal Access Token (`nvx_live_...`) Bearer auth, full [REST API docs](wiki/REST-API-开放接口文档.md) |
| 🔒 **Security** | Public/private access, SSRF loopback isolation, CSRF header defense, brute-force rate limiting, AES-256-GCM secret encryption |

## Documentation

Full user guide, architecture, security specs and API docs live in the [Wiki](https://github.com/timorpic/Navelix/wiki):

| Doc | What's inside |
| :--- | :--- |
| [📖 User Guide](wiki/User-Guide-功能使用指南.md) | Bookmarks, Gantt, calendar, AI breakdown, appearance customization |
| [🚀 Quick Start](wiki/Quick-Start-快速入门.md) | Docker / Compose one-click deploy, Node.js source deploy & first-run setup |
| [🏗️ Architecture](wiki/Architecture-系统架构与技术选型.md) | Next.js 16, React 19, SQLite WAL design & migration system |
| [🛡️ Security & Ops](wiki/Security-安全机制与运维规范.md) | Permissions, CSRF, SSRF, rate limiting, hot-snapshot & backup rules |
| [🔌 REST API Reference](wiki/REST-API-开放接口文档.md) | Full OpenAPI spec, token auth, calendar subscription & automation |
| [❓ FAQ & Troubleshooting](wiki/FAQ-常见问题与故障排查.md) | Deployment, timezone/calendar, backup-restore and common issues |

---

## Quick Start

```bash
pnpm install
pnpm dev          # Local dev, http://localhost:3721
```

On first launch an admin `admin` is created automatically; a random password is printed to the console and saved to `data/navelix-admin-password.txt`.

### Docker deploy (recommended)

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
      - NAVELIX_ADMIN_PASSWORD=your_secure_password  # optional: set the initial admin password
      - NAVELIX_COOKIE_SECURE=false                  # keep false for LAN http; set true behind HTTPS
      - TZ=Asia/Shanghai
    volumes:
      - ./data:/app/data
```

Run it:

```bash
docker compose up -d
# Open http://<host-ip>:3721 in your browser
```

---

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3721` | Port the service listens on inside the container |
| `HOSTNAME` | `0.0.0.0` | Network bind address |
| `NAVELIX_ADMIN_PASSWORD` | *(empty)* | Initial admin password; if empty a strong one is auto-generated |
| `NAVELIX_COOKIE_SECURE` | `false` | Cookie Secure attribute; keep `false` on HTTP, set `true` behind HTTPS |
| `TRUST_PROXY` | `false` | Whether to trust the `X-Forwarded-For` header from a reverse proxy |
| `NAVELIX_IMAGE_REPO` | `timorpic/navelix` | Image repo used for update checks |
| `TZ` | `Asia/Shanghai` | Container timezone |

---

## Data & Privacy

All data is stored in local SQLite (`data/navelix.db`). AI / weather API keys live only in the local database and are proxied server-side; they are never leaked when exporting config. Built-in physical hot backup and fast restore are included.

---

## License

This project is released under the **Navelix Source-Available License** (source-available with commercial terms, see [LICENSE](LICENSE)):

- **Personal & non-commercial use**: free to download, install and self-host;
- **Open-source contribution**: PRs, issues and ecosystem widget adaptations are welcome;
- **Commercial & enterprise use**: a commercial license is required to deploy in a commercial production environment;
- **Prohibited**: without written permission, reselling as SaaS, charging for redistribution, or repackaging into competing products.

---

**Navelix · Personal Digital Hub** — every everyday entry point, right where it belongs.