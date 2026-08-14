# 通用 Web 应用设计系统与架构规范 (Design.md)

**版本**: 2.0 (通用版)  
**适用范围**: 现代 Web 应用 · 全栈 SaaS · 个人/团队工作空间项目  
**核心理念**: 功能驱动 · 视觉卓越 · 极简高效 · 纵深防御  

---

## 目录
1. [通用架构与分层设计 (Architecture)](#1-通用架构与分层设计-architecture)
2. [设计系统与视觉规范 (Design System)](#2-设计系统与视觉规范-design-system)
3. [图标与品牌标识体系 (Iconography & Branding)](#3-图标与品牌标识体系-iconography--branding)
4. [全栈安全防护体系 (Security Engineering)](#4-全栈安全防护体系-security-engineering)
5. [持久化与数据完整性规范 (Data & Persistence)](#5-持久化与数据完整性规范-data--persistence)
6. [质量保障与工程自动化 (DevOps & CI/CD)](#6-质量保障与工程自动化-devops--cicd)

---

## 1. 通用架构与分层设计 (Architecture)

应用应当遵循清晰的高内聚、低耦合分层架构，确保代码的可测试性、可扩展性与可维护性：

```mermaid
graph TD
    Client[客户端/浏览器 (Presentation Layer)] --> API[API 路由 / Web Server (Application Layer)]
    API --> Security[安全引擎 (Security Gatekeeper)]
    Security --> Domain[核心业务逻辑 (Domain & Service Layer)]
    Domain --> Infra[数据持久化 / 数据库 (Infrastructure Layer)]
  
    subgraph 核心规范
        Security --> CSRF[CSRF / SSRF / RateLimit]
        Domain --> Validation[输入校验 / Zod / Type Check]
        Infra --> Storage[SQLite / ORM / File Backup]
    end
```

### 1.1 分层架构规范
- **视图展示层 (Presentation Layer)**：基于 React / Next.js Component 构建，仅关注 UI 渲染与本地交互状态，不直接侵入底层数据库。
- **应用/API 层 (Application Layer)**：暴露标准的 RESTful / GraphQL 接口，负责 Request 校验、统一 Response 包装与错误状态码映射。
- **领域服务层 (Domain Layer)**：纯业务逻辑，具备可被单元测试独立覆盖的独立函数（Server-only）。
- **基础设施/持久化层 (Infrastructure Layer)**：封装数据库连接（如 SQLite / PostgreSQL）、缓存与第三方 API 集成。

---

## 2. 设计系统与视觉规范 (Design System)

### 2.1 设计四大核心原则
1. **功能驱动 (Function-Driven Design)**：以用户最高效完成目标为唯一导向，剥离无意义的装饰性堆砌。
2. **主题 Token 语义化 (Semantic Design Tokens)**：禁止使用硬编码色值，使用 CSS 变量统一声明：

| Token 名称 | 用途 | 示例 (浅色 / 深色) |
| :--- | :--- | :--- |
| `--color-bg-primary` | 页面基础背景 | `#F8FAFC` / `#0F172A` |
| `--color-bg-surface` | 卡片/容器表面背景 | `#FFFFFF` / `#1E293B` |
| `--color-brand-primary` | 品牌/强调色 | `#00C776` (翡翠绿) |
| `--color-text-primary` | 正文一级文本 | `#0F172A` / `#F8FAFC` |
| `--color-border-subtle` | 边框线 | `#E2E8F0` / `#334155` |

3. **双引擎无闪烁主题 (Zero-FOUC Theme Engine)**：
   在 HTML `<body>` 解析前通过极简 inline 脚本同步读取 `localStorage` / `Cookie` 并设置 `.dark` class，彻底杜绝首屏白屏/暗色闪烁。

4. **禁止常见的陈词滥调模式 (Forbidden Tropes)**：
   - ✖ 严禁在不需要仪表盘的界面硬套 Dashboard 布局。
   - ✖ 严禁暗色主题下使用高饱和紫字/霓虹发光文字。
   - ✖ 严禁不带字距调整（Letter-spacing）的大号标题字。
   - ✖ 严禁嵌套超过 3 层的卡片布局。

---

## 3. 图标与品牌标识体系 (Iconography & Branding)

### 3.1 统一矢量图标规范
- **网格对齐与 ViewBox**：图标统一采用 24×24 或 16×16 viewBox，保持 `stroke-width: 2` 的一致线条质感。
- **系统集成**：优先集成 Iconify / Tabler / Material Symbols 等开源成熟图标系统，避免混用样式脱节的图样。

### 3.2 响应式矢量 Emblem (Logo System)
- **品牌 Symbol**：包含独立 SVG logo 规范，能够自适应 16px (Favicon)、32px (App header)、512px (Manifest/Splash)。
- **Favicon 适配**：同时提供 `icon.svg` 与 `favicon.ico` 格式，保障跨终端浏览器标签页效果。

---

## 4. 全栈安全防护体系 (Security Engineering)

所有现代 Web 应用必须建立**纵深防御 (Defense-in-Depth)** 体系：

```
[用户请求] ➔ [1. CSRF Same-Origin 校验] ➔ [2. 限流 Rate-Limit] ➔ [3. SSRF 域名/IP 校验] ➔ [业务逻辑]
```

### 4.1 安全四大防线
1. **SSRF 局域网与元数据防御 (SSRF Protection)**：
   - 默认拦截所有私有网段 IP（`127.0.0.1`, `10.0.0.0/8`, `192.168.0.0/16`）及云元数据 IP（`169.254.169.254`）。
   - 若功能需要访问内网服务，需显式开启 `allowPrivateIPs` 控制选项，且**云元数据 IP 必须绝对封禁**。
2. **CSRF Same-Origin 校验**：
   - 对所有 POST / PUT / DELETE 写操作强校验 `Host` 与 `Origin` / `Referer` 标头。
3. **爆破防护与滑动窗口限流 (Rate Limiting)**：
   - 对登录/注册/敏感接口建立基于客户端 IP + ID 的滑动窗口频率限制。
4. **密码学与数据保护**：
   - 敏感密码采用 PBKDF2 / Argon2 / bcrypt 加盐哈希；Session 存放在 HTTP-Only + SameSite Cookie 中。

---

## 5. 持久化与数据完整性规范 (Data & Persistence)

### 5.1 数据完整性与级联删除 (CASCADE)
- 关系型数据库（如 SQLite / PostgreSQL）必须显式开启外键约束。
- 父节点数据被删除时，子节点关联数据必须显式配置 `ON DELETE CASCADE` 级联清理，防止残留孤儿数据。

### 5.2 零中断在线热备份 (Zero-Downtime Backup)
- 数据库需提供无锁化增量/原子热备份机制（如 SQLite `VACUUM INTO`），确保备份过程不影响主进程读写。

### 5.3 数据库版本迁移 (Schema Migration)
- 采用版本号机制（如 `PRAGMA user_version` 或 migration 脚本）记录变更，每次系统升级前自动校验并渐进式应用 SQL 迁移。

---

## 6. 质量保障与工程自动化 (DevOps & CI/CD)

### 6.1 代码质量门禁 (Code Quality Gates)
提交与 CI 构建前必须通过以下三重校验：
1. **静态类型检查 (TypeScript)**: `tsc --noEmit` 零类型错误。
2. **代码风格与语法检查 (ESLint)**: `pnpm lint` 零 Error、零 Warning。
3. **单元与集成测试 (Unit Testing)**: 关键业务函数与安全模块 100% 测试覆盖。

### 6.2 容器化构建规范 (Containerization)
- **多阶段构建 (Multi-stage Build)**：分离编译依赖与运行依赖，产出极简瘦容器。
- **非 Root 权限运行**：Docker 镜像中禁止使用 `root` 用户直接运行主进程。

---

> **设计总结**：优秀的软件设计是实用性、美学、安全性与工程质量的完美交融。本规范旨在为所有全栈项目提供通用、标准且可持续迭代的发展基石。
