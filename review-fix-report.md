# Navelix 评审问题修复报告（基于 v1.0.4 评审）

**修复日期**: 2026-08-14
**依据**: `review-report-v1.0.4.md`
**范围**: 安全性 + 正确性加固（4 项代码修复 + 1 项文档）
**验证**: `tsc --noEmit` 0 错误 · `eslint .` 0 错误 · `node --test` 38/38 通过 · `next build` 成功
**Git**: 全程未执行任何 commit / push / tag（按主人要求）

---

## 一、已修复项

### 🔴 P0-1 License 硬编码签名密钥（`src/lib/license.ts`）
- **问题**: `LICENSE_SECRET` 使用硬编码默认值 `"navelix-open-source-pro-license-secret-2026"`，任何拿到源码的人都能反编译并重放/伪造 `NAVPRO-*` 签名授权码。
- **修复**:
  - 删除硬编码默认值，`LICENSE_SECRET` 仅取自 `process.env.LICENSE_SECRET_KEY`（需显式配置）。
  - 新增 `getLicenseSecret()`：未配置返回 `null`，HMAC 路径据此**禁用**而非回退到已知默认值。
  - `verifyProLicenseKey()`：HMAC 分支在未配置密钥时返回"无效"并明确提示配置 `LICENSE_SECRET_KEY`。
  - `generateProLicenseKey()`：未配置密钥时**抛错**（避免基于默认密钥生成可被重放的码）。
  - 社区模式（`ENABLE_COMMUNITY_PRO=true` / 通用码 `NAV-PRO-2026` / `PRO-COMMUNITY` / `PRO_LICENSE_KEY`）不受影响，自托管仍可用。

### 🟡 P1-2 自定义 CSS/JS 注入收口为管理员专属
- **问题**: `customHeadScripts` / `customCss` 经 `dangerouslySetInnerHTML` 注入所有访客页面；而 CSP 放行 `unsafe-inline`，且 `POST /api/user/data` 仅校验登录态、**不限角色**——任意登录用户都能写入注入内容，形成存储型 XSS / 数据外泄面。
- **修复**:
  - `src/app/api/user/data/route.ts`：新增 admin 角色门禁，非管理员提交非空 `customHeadScripts`/`customCss` 时拒绝（403）。
  - `src/lib/user-data.ts`：保存非空注入内容时打印 `[Security]` 告警日志，供运维审计。
  - `src/types/index.ts`：补充安全警告注释（仅限管理员、会绕过 CSP）。

### 🟡 P1-3 Session 注销增加速率限制（`src/app/api/auth/sessions/route.ts` + 新文件 `src/lib/rate-limit.ts`）
- **问题**: 会话注销 `DELETE` 无频率限制，攻击者可暴力枚举 session ID 或大规模注销。
- **修复**: 新增轻量内存固定窗口限流工具 `simpleRateLimit()`，对 `DELETE /api/auth/sessions` 按用户维度限流（30 次/分钟），超限返回 429 + `Retry-After`。

### 🟡 P1-4 备份恢复增加密码二次确认（`src/app/api/admin/backup/route.ts`）
- **问题**: 数据库恢复 `POST` 仅依赖 admin 角色，管理员会话被盗（密码未泄露）即可被直接覆写数据库。
- **修复**: 恢复操作须提交 `confirmPassword`，与 `users.password_hash` 校验；不匹配返回 403。

### 📄 文档：License 社区策略说明（`.env.example`）
- 补充 `LICENSE_SECRET_KEY` / `ENABLE_COMMUNITY_PRO` / `PRO_LICENSE_KEY` 说明，明确通用激活码是有意设计的社区策略。

---

## 二、评审误判项（无需修改）

- **天气模块代码残留**：评审假设 `user_configs` 已无 `weather_*` 列。经核查 `migrations/index.ts` 的 `ensureColumn` 与 v5 重建表**仍包含** `weather_enabled`/`weather_api_key`/`weather_location`/`weather_api_base_url`，`saveUserConfigs` 引用合法、不会崩溃。**天气功能保持原样，未误删。**

---

## 三、已记录但暂缓的项（评估后决定不改动）

| 评审建议 | 结论 | 理由 |
|---------|------|------|
| `user_configs` 表字段膨胀（22+ 列）拆分为偏好表 / JSON 列 | **暂缓** | 属可维护性"建议"；拆分需新增迁移与改 `getUserData`/`saveUserConfigs`，存在破坏现有 Schema 与业务逻辑的风险。单容器个人部署场景下列数可控，维持现状更稳。建议后续单独立项、以新增 `ui_prefs` JSON 列方式演进。 |
| License 通用激活码可能被传播 | **已文档化** | 属有意的开源社区设计（`NAV-PRO-2026`/`PRO-COMMUNITY`），已在 `.env.example` 说明。 |

---

## 四、改动的代码清单

| 文件 | 类型 | 改动 |
|------|------|------|
| `src/lib/license.ts` | 修改 | 移除硬编码密钥，密钥缺失时禁用 HMAC 路径 |
| `src/app/api/user/data/route.ts` | 修改 | 自定义脚本/CSS 写入增加 admin 角色门禁 |
| `src/lib/user-data.ts` | 修改 | 注入内容保存时打印安全告警 |
| `src/types/index.ts` | 修改 | 自定义脚本/CSS 字段补充安全警告注释 |
| `src/lib/rate-limit.ts` | **新增** | 通用内存固定窗口限流工具 |
| `src/app/api/auth/sessions/route.ts` | 修改 | DELETE 增加限流 |
| `src/app/api/admin/backup/route.ts` | 修改 | 恢复操作增加密码二次确认 |
| `.env.example` | 修改 | 补充 License 相关环境变量说明 |
