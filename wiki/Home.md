# 🚀 欢迎使用 Navelix 官方 Wiki 知识库

> **Navelix (Personal Digital Hub)** 是一款专为极客、开发者、独立创作者与敏捷团队打造的**现代化全功能个人数字工作空间与数字导航系统**。
> 它融合了 **AI 智能项目拆解、多用户协同工作空间、交互式甘特图、日历日程规划、全站链接健康巡检与商汤大模型监控**，提供极致流畅的一站式工作流体验。

---

## 🗺️ 核心功能模块总览 (Modules Architecture)

```mermaid
graph TD
    Navelix["Navelix 个人数字工作空间"]
    
    Navelix --> Mod1["🔖 智能导航与资产管理"]
    Navelix --> Mod2["📊 项目看板与交互式甘特图"]
    Navelix --> Mod3["📅 日历日程与团队协同待办"]
    Navelix --> Mod4["🤖 AI 智能中枢与大模型监控"]
    Navelix --> Mod5["🌐 跨设备云漫游与 OpenAPI 开放生态"]
    Navelix --> Mod6["🛡️ 企业级多层安全防御体系"]

    Mod1 --> F1["无限层级分类 / 色彩图标系统"]
    Mod1 --> F2["书签 HTML / JSON 导入导出"]
    Mod1 --> F3["全站链接在线健康自动巡检"]

    Mod2 --> F4["四维指标: 进度 / 任务 / 风险 / 更新"]
    Mod2 --> F5["21天交互式甘特图时间轴"]
    Mod2 --> F6["原子化里程碑动作清单编辑"]

    Mod3 --> F7["本地时区对齐与跳日防御"]
    Mod3 --> F8["逾期任务一键/定时智能顺延 Rollover"]
    Mod3 --> F9["Apple / Google / Outlook 日历标准订阅"]

    Mod4 --> F10["AI 复杂项目一键拆解与分工指派"]
    Mod4 --> F11["AI 每日日程规划建议"]
    Mod4 --> F12["全工作区上下文智能助理问答"]
    Mod4 --> F13["商汤 SenseNova 5h 窗口实时用量监控"]

    Mod5 --> F14["35+ 项偏好设置毫秒级中心化持久化"]
    Mod5 --> F15["iOS 快捷指令 / NAS 脚本 / Webhook 集成"]
    Mod5 --> F16["SHA-256 个人 Access Token 鉴权"]

    Mod6 --> F17["CSRF 校验 / SSRF 私有网段隔离"]
    Mod6 --> F18["防爆破限流 / 存储型 XSS 过滤"]
    Mod6 --> F19["SQLite 物理快照在线热备 VACUUM INTO"]
```

---

## 📚 知识库文档导航 (Documentation Hub)

为了帮助您快速熟悉并深度使用 Navelix，Wiki 知识库分为以下专题章节：

| 文档章节 | 核心内容介绍 | 快速直达 |
| :--- | :--- | :---: |
| **🚀 [快速入门指南]** | Docker / Compose 一键部署 (默认 3721 端口)、Node.js 源码部署与首次初始化 | [[查看指南|Quick-Start-快速入门]] |
| **📖 [功能使用全手册]** | 书签管理、甘特图大盘、日历日程、AI 拆解、外观定制与商汤监控实战 | [[查看手册|User-Guide-功能使用指南]] |
| **🏗️ [系统架构与技术选型]** | Next.js 16、React 19、SQLite WAL 架构设计与数据库版本迁移体系 | [[查看架构|Architecture-系统架构与技术选型]] |
| **🛡️ [安全机制与运维规范]** | RBAC 权限、CSRF、SSRF、限流防爆破、数据库物理快照与热备规范 | [[查看规范|Security-安全机制与运维规范]] |
| **🔌 [REST API 开放接口规范]** | 全量 OpenAPI 规范、Token 鉴权、日历订阅及 iOS 快捷指令/CI 自动化案例 | [[查看接口|REST-API-开放接口文档]] |
| **❓ [常见问题与故障排查]** | 部署运维、时区日历、商汤监控、备份恢复等高频疑难解答 | [[查看 FAQ|FAQ-常见问题与故障排查]] |

---

## ⚡ 30 秒极速体验 (Quick Launch)

使用 Docker 仅需一行命令即可完成部署启动（项目默认标准端口为 **`3721`**）：

```bash
docker run -d \
  --name navelix \
  -p 3721:3721 \
  -v $(pwd)/data:/app/data \
  -e NAVELIX_ADMIN_PASSWORD=your_strong_password \
  -e TZ=Asia/Shanghai \
  --restart unless-stopped \
  timorpic/navelix:latest
```

启动完成后在浏览器访问 `http://localhost:3721` 即可登录并开启您的专属数字工作空间！

---

*Navelix Core 遵循 MIT 开源协议 | 长期主义，让技术创造更多价值。*
