# 📖 Navelix REST API & Personal Access Token 开放接口 Wiki 文档

欢迎使用 **Navelix 个人数字工作空间 (Personal Digital Hub)** 的 REST API。
通过开放接口与个人 API Access Token，你可以方便地在 **iOS 快捷指令、Docker 构建流水线、Python/Node.js 自动化脚本、家庭服务器 (NAS) 巡检、外部日历订阅 (Apple/Google/Outlook) 以及 AI 智能体 (Custom GPTs / Dify)** 中集成 Navelix。

---

## 📌 目录 (Table of Contents)

- [1. 🔐 鉴权机制与安全 (Authentication)](#1--鉴权机制与安全-authentication)
- [2. 🔑 密钥管理接口 (API Tokens Management)](#2--密钥管理接口-api-tokens-management)
- [3. 📅 日历日程、待办清单与自动顺延 (Todos & Schedules API)](#3--日历日程待办清单与自动顺延-todos--schedules-api)
  - [3.1 获取待办事项列表](#31-获取待办事项列表)
  - [3.2 创建新待办事项 (支持指派责任人)](#32-创建新待办事项-支持指派责任人)
  - [3.3 更新待办状态与信息](#33-更新待办状态与信息)
  - [3.4 删除待办事项](#34-删除待办事项)
  - [3.5 逾期待办一键/定时顺延 (Rollover API)](#35-逾期待办一键定时顺延-rollover-api)
  - [3.6 iCalendar 标准外部日历订阅 (Apple / Google / Outlook)](#36-icalendar-标准外部日历订阅-apple--google--outlook)
- [4. 📊 项目管理与动作清单 (Projects API)](#4--项目管理与动作清单-projects-api)
  - [4.1 获取项目列表](#41-获取项目列表)
  - [4.2 创建新项目 (支持原子化里程碑待办同步)](#42-创建新项目-支持原子化里程碑待办同步)
  - [4.3 更新项目信息与里程碑清单](#43-更新项目信息与里程碑清单)
  - [4.4 删除项目](#44-删除项目)
- [5. 🤖 AI 智能中枢与拆解服务 (AI Engine API)](#5--ai-智能中枢与拆解服务-ai-engine-api)
  - [5.1 AI 项目拆解与成员智能指派](#51-ai-项目拆解与成员智能指派)
  - [5.2 AI 智能每日日程规划与建议](#52-ai-智能每日日程规划与建议)
  - [5.3 AI 智能对话 (携带工作空间全量实时数据)](#53-ai-智能对话-携带工作空间全量实时数据)
- [6. 👥 工作区成员 (Workspace Members API)](#6--工作区成员-workspace-members-api)
- [7. 🔔 消息通知与活动推送 (Notifications API)](#7--消息通知与活动推送-notifications-api)
  - [7.1 推送新通知 (支持声明来源)](#71-推送新通知-支持声明来源)
  - [7.2 获取通知列表](#72-获取通知列表)
  - [7.3 标记通知已读 / 全部已读](#73-标记通知已读--全部已读)
  - [7.4 删除通知](#74-删除通知)
- [8. 🔖 导航书签与全量配置 (Categories & System Config API)](#8--导航书签与全量配置-categories--system-config-api)
  - [8.1 获取全量工作台数据与偏好配置](#81-获取全量工作台数据与偏好配置)
  - [8.2 批量保存或更新工作台数据](#82-批量保存或更新工作台数据)
  - [8.3 书签与分类接口](#83-书签与分类接口)
- [9. 💡 实战集成案例 (Integration Cookbooks)](#9--实战集成案例-integration-cookbooks)
  - [案例 A: GitHub Actions / Docker CI 自动化构建通知](#案例-a-github-actions--docker-ci-自动化构建通知)
  - [案例 B: iOS 快捷指令一键录入日程待办并指派负责人](#案例-b-ios-快捷指令一键录入日程待办并指派负责人)
  - [案例 C: Apple Calendar / 手机日历无缝实时订阅 Navelix 日程](#案例-c-apple-calendar--手机日历无缝实时订阅-navelix-日程)
  - [案例 D: 定时脚本每晚自动顺延未完成待办 (Cron Rollover)](#案例-d-定时脚本每晚自动顺延未完成待办-cron-rollover)
- [10. 🧩 扩展接口一览 (Additional Endpoints)](#10--扩展接口一览-additional-endpoints)

---

## 1. 🔐 鉴权机制与安全 (Authentication)

Navelix 支持通过 **HTTP Authorization Header** 传递 Bearer Token 进行 REST API 请求鉴权。

### 🔑 Token 格式
每个 API Token 的前缀均为 `nvx_live_`，其后为 **48 位十六进制字符**（24 字节随机数），形如：
```text
nvx_live_a1b2c3d4e5f678901234567890abcdef0123456789abcdef
```

> 校验 Token 时请勿按固定长度截断或写死正则；请以 `nvx_live_` 前缀 + 后续 hex 字符判断。

### 🛡️ 请求头结构
在所有 HTTP 请求中，附加以下 Request Header：
```http
Authorization: Bearer nvx_live_YOUR_API_TOKEN
Content-Type: application/json
```

### ⚠️ CSRF / Origin 校验（外部调用的常见 403 原因）
除 `GET` / `HEAD` / `OPTIONS` 外，所有 `/api/**` 写操作都会经过 **CSRF 与 Origin/Referer 校验**：请求若既没有可校验的 `Origin`/`Referer`，也没有 `Authorization: Bearer` 头，将被直接拒绝（403）。

> 结论：**用脚本 / curl / 快捷指令调用写接口时，必须携带 `Authorization: Bearer nvx_live_...`**——带 Bearer 的请求会被自动豁免 CSRF 校验。反之，仅靠 Cookie 会话的裸 curl 调用会被拦截。

> 💡 **安全提示**：
> 1. API Token 拥有对应账号的所有业务读写权限，请勿将 Token 提交至公开代码仓库。
> 2. 系统底层采用 **SHA-256 哈希加密存储**，即使数据库泄露也无法逆向还原明文密钥。
> 3. 特殊订阅场景（如 Apple / Google Calendar Webcal 订阅 URL）可使用 URL Query 参数鉴权，但**仅限日历导出这一条路由**，且该路由同时接受 `?token=` 与 `?key=` 两个参数名：
>    ```text
>    /api/calendar/export?token=nvx_live_...   （等价写法：?key=nvx_live_...）
>    ```
>    其它任何接口都不支持 Query 参数鉴权。
> 4. **Token 可自我续期**：密钥管理接口（创建 / 撤销 Token）同样接受 Bearer Token 鉴权，即一个 Token 有权创建新 Token 并撤销同账号的其它 Token。一旦泄露，仅靠「撤销单个 Token」无法止损，请同时检查 Token 列表。

---

## 2. 🔑 密钥管理接口 (API Tokens Management)

*可通过 Web 前端后台、登录 Session **或 Bearer Token 本身**进行密钥的创建与销毁。*

### 2.1 创建 API Token
- **请求方式**: `POST /api/auth/api-tokens`
- **请求体**:
```json
{
  "name": "iOS 快捷指令与自动化流水线"
}
```
- **响应示例**:
```json
{
  "success": true,
  "token": "nvx_live_a1b2c3d4e5f678901234567890abcdef0123456789abcdef",
  "tokenId": "tok_123456",
  "name": "iOS 快捷指令与自动化流水线",
  "tokenPrefix": "nvx_live_a1b2...cdef",
  "message": "API 密钥生成成功！请务必妥善保管，该密钥仅显示一次。"
}
```

### 2.2 获取 Token 列表
- **请求方式**: `GET /api/auth/api-tokens`

### 2.3 撤销 Token
- **请求方式**: `DELETE /api/auth/api-tokens`
- **请求体**: `{ "id": "tok_123456" }`

---

## 3. 📅 日历日程、待办清单与自动顺延 (Todos & Schedules API)

### 3.1 获取待办事项列表
- **请求方式**: `GET /api/todos`
- **请求头**: `Authorization: Bearer nvx_live_YOUR_TOKEN`
- **响应示例**:
```json
{
  "todos": [
    {
      "id": "todo-1786682000000-a1b2c3",
      "title": "完成 API 开放接口文档升级",
      "priority": "high",
      "done": false,
      "dueDate": "2026-08-15",
      "projectId": "proj_core",
      "assigneeId": "usr_01",
      "assigneeName": "Admin",
      "ownerId": "usr_01",
      "ownerName": "Admin",
      "isDelegated": false,
      "createdAt": 1786680000000,
      "sortOrder": 0
    }
  ]
}
```

> **字段说明**：
> - `done` 为 **布尔值**（`true` / `false`），不是 0/1。
> - `id` 形如 `todo-<时间戳>-<6位随机串>`；`dueDate` / `projectId` / `assigneeId` / `assigneeName` 在未设置时**不出现**（而非 `null`）。
> - `ownerId` / `ownerName` 为待办的**创建者**；`isDelegated` 表示该条是他人指派给你的。
> - 该接口返回的是「自己创建的 + 他人指派给自己的」**并集**，请按 `isDelegated` 区分归属。

### 3.2 创建新待办事项 (支持指派负责人)
- **请求方式**: `POST /api/todos`
- **请求头**: `Authorization: Bearer nvx_live_YOUR_TOKEN`
- **请求体**:
| 字段 | 类型 | 必填 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `title` | string | 是 | - | 待办/日程标题 |
| `priority` | string | 否 | `"medium"` | 优先级: `"low"` / `"medium"` / `"high"` |
| `dueDate` | string | 否 | `null` | 本地截止日期，格式 `YYYY-MM-DD`（如 `2026-08-15`） |
| `projectId` | string | 否 | `null` | 关联的项目 ID |
| `assigneeId` | string | 否 | `null` | 负责人的用户 ID（可从 `/api/user/members` 获取） |
| `assigneeName`| string | 否 | `null` | 负责人名称（如 `Alice`、`张三`） |

```json
{
  "title": "核对主服务器 Docker 存储空间",
  "priority": "high",
  "dueDate": "2026-08-15",
  "assigneeName": "DevOps 运维"
}
```

### 3.3 更新待办状态与信息
- **请求方式**: `PATCH /api/todos/{id}`
- **请求头**: `Authorization: Bearer nvx_live_YOUR_TOKEN`
- **请求体**: 支持更新任意字段（`done: true/false`, `title`, `priority`, `dueDate`, `assigneeId`, `assigneeName` 等）。

### 3.4 删除待办事项
- **请求方式**: `DELETE /api/todos/{id}`

### 3.5 逾期待办一键/定时顺延 (Rollover API)
将当前所有已逾期未完成的待办事项自动延期。
- **请求方式**: `POST /api/todos/rollover`
- **请求头**: `Authorization: Bearer nvx_live_YOUR_TOKEN`
- **请求体**:
| 字段 | 类型 | 必填 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `action` | string | 否 | `"today"` | `"today"`（全部顺延至今天）或 `"week"`（平摊至今天~周日） |
| `today` | string | 否 | 服务器日期 | 客户端时区覆盖，格式 `YYYY-MM-DD`，用于校正跨时区调用时的「今天」 |

- **响应格式**（存在逾期项时）:
```json
{
  "success": true,
  "count": 3,
  "action": "today",
  "message": "已成功将 3 项过期任务一键顺延至今日！"
}
```
无逾期项时返回 `{ "success": true, "count": 0, "message": "当前没有需要顺延的过期待办事项" }` —— **该分支不含 `action` 字段**。

> ⚠️ **注意**：
> - 响应字段名是 **`count`**（不是 `updatedCount`）。
> - `"week"` 模式按「今天 → 周日」的**自然天数**平摊（`offset = 序号 % 剩余天数`），**不排除周六周日**，与「工作日」无关。
> - `action` 可省略，缺省等同于 `"today"`。

### 3.6 iCalendar 标准外部日历订阅 (Apple / Google / Outlook)
提供符合 RFC 5545 标准的 `.ics` 订阅源，让系统所有日程与里程碑无缝同步至手机日历。
- **请求方式**: `GET /api/calendar/export?token=nvx_live_YOUR_TOKEN`
- **响应 Content-Type**: `text/calendar; charset=utf-8`

---

## 4. 📊 项目管理与动作清单 (Projects API)

### 4.1 获取项目列表
- **请求方式**: `GET /api/projects`
- **请求头**: `Authorization: Bearer nvx_live_YOUR_TOKEN`
- **响应示例**:
```json
{
  "projects": [
    {
      "id": "proj_01",
      "name": "Navelix 2.0 升级重构",
      "description": "完成多端协同、甘特图与 OpenAPI 体系",
      "status": "in-progress",
      "color": "#00C776",
      "statusColor": "#00C776",
      "url": "",
      "sortOrder": 0,
      "createdAt": 1786680000000,
      "updatedAt": 1786683600000
    }
  ]
}
```

> **说明**：`color` / `statusColor` 为十六进制色值（未设置时默认 `#00C776`）。前端「四维指标」（进度 / 任务 / 风险 / 更新）是**由前端根据待办数据本地计算的**，不来自本接口，请勿在集成时依赖该接口返回指标字段。

### 4.2 创建新项目 (支持原子化里程碑待办同步)
- **请求方式**: `POST /api/projects`
- **请求体**:
```json
{
  "name": "官网改版项目",
  "description": "全新 UI 与品牌升级",
  "status": "in-progress",
  "color": "sky",
  "todos": [
    {
      "title": "确定设计主色调与视觉风格",
      "dueDate": "2026-08-18",
      "priority": "high",
      "assigneeName": "UI 设计师"
    },
    {
      "title": "前端组件库开发与集成",
      "dueDate": "2026-08-22",
      "priority": "medium",
      "assigneeName": "前端负责人"
    }
  ]
}
```

### 4.3 更新项目信息与里程碑清单
- **请求方式**: `PATCH /api/projects/{id}`
- **说明**: 传入 `todos` 数组将以 Diff 形式原子更新该项目关联的所有里程碑待办。

### 4.4 删除项目
- **请求方式**: `DELETE /api/projects/{id}`

---

## 5. 🤖 AI 智能中枢与拆解服务 (AI Engine API)

### 5.1 AI 项目拆解与智能指派
基于大模型与当前工作区成员名单，将复杂项目自动拆解为具体可执行的任务、截止时间与责任人。
- **请求方式**: `POST /api/ai/project-breakdown`
- **请求体**:
| 字段 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `projectName` | string | 是 | 项目名称 |
| `projectDescription` | string | 否 | 项目详细背景或目标要求 |
| `startDate` | string | 否 | 项目启动基准日期（默认今天，格式 `YYYY-MM-DD`） |

- **响应格式**:
```json
{
  "success": true,
  "source": "ai_model",
  "tasks": [
    {
      "title": "完成需求评审与架构设计",
      "priority": "high",
      "dueDate": "2026-08-17",
      "assigneeId": "usr_01",
      "assigneeName": "架构师"
    },
    {
      "title": "核心 API 开发与单元测试",
      "priority": "medium",
      "dueDate": "2026-08-20",
      "assigneeId": "usr_02",
      "assigneeName": "后端工程师"
    }
  ]
}
```

> **`source` 取值有三种，请全部处理**：
> | 取值 | 含义 |
> | :--- | :--- |
> | `ai_model` | 正常调用大模型拆解成功 |
> | `smart_rules` | 未配置 AI Key，使用内置敏捷拆分引擎 |
> | `smart_rules_fallback` | 已配置 Key 但模型调用失败，回落至内置引擎 |
>
> `tasks[]` 的字段固定为 `title` / `priority` / `dueDate` / `assigneeId` / `assigneeName`，**没有 `daysOffset`**。

### 5.2 AI 智能每日日程规划与建议
- **请求方式**: `POST /api/ai/daily-schedule`
- **请求体**: `{ "date": "2026-08-15" }`
- **响应示例**:
```json
{
  "success": true,
  "source": "ai_model",
  "advice": "今日重点推进发布与接口验证，建议上午完成核心构建，下午进行多端联调。",
  "tasks": [
    {
      "title": "核对主服务器 Docker 存储空间",
      "priority": "high",
      "dueDate": "2026-08-15"
    }
  ]
}
```

> **说明**：`tasks` **不会为空** —— 未配置 AI Key 或模型调用失败时，服务端会用内置规则兜底生成 3~4 条建议任务，并在 `source` 中标记来源（取值同 §5.1：`ai_model` / `smart_rules` / `smart_rules_fallback`）。

### 5.3 AI 智能对话 (携带工作空间全量实时数据)
- **请求方式**: `POST /api/ai/chat`
- **说明**: 自动注入当前用户的全量分类、书签、项目与日程上下文，提供高度定制化的智能助理服务。
- **请求体**:
| 字段 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `prompt` | string | 是 | 用户提问内容 |
| `history` | array | 否 | 多轮对话历史，元素形如 `{ "role": "user" \| "assistant", "content": "..." }` |

- **响应格式**:
```json
{
  "text": "模型回复正文（含可选的操作执行回执）"
}
```

> ⚠️ **注意**：本接口的响应结构与其它 AI 接口不同 —— **直接返回 `{ "text": "..." }`，没有 `success` / `source` / `tasks` 字段**；出错时同样返回 `{ "text": "错误说明" }` 而非 `{ "error": ... }`。客户端请以 `text` 是否存在来判断成败。

---

## 6. 👤 工作区成员 (Workspace Members API)

### 6.1 获取当前工作区成员列表
用于在任务指派、AI 拆解或外部系统录入时拉取用户列表。
- **请求方式**: `GET /api/user/members`
- **请求头**: `Authorization: Bearer nvx_live_YOUR_TOKEN`
- **响应示例**:
```json
{
  "members": [
    {
      "id": "usr_admin",
      "username": "timorpic",
      "displayName": "Timor",
      "avatar": "",
      "role": "admin"
    }
  ]
}
```

> **说明**：
> - 返回的是**实例内全部用户**（按创建时间升序），没有工作区/租户过滤。
> - `displayName` 未设置时会是**空字符串**（不会自动回退为 `username`），集成时请自行兜底：`displayName || username`。

---

## 7. 🔔 消息通知与活动推送 (Notifications API)

### 7.1 推送新通知 (支持声明来源)
- **请求方式**: `POST /api/notifications`
- **请求头**: `Authorization: Bearer nvx_live_YOUR_TOKEN`
- **请求体**:
```json
{
  "title": "🖥️ 服务器 CPU 高负载告警",
  "content": "节点 node-01 CPU 占用率超过 90%，请检查是否有异常进程",
  "source": "nas_monitor"
}
```

### 7.2 获取通知列表
- **请求方式**: `GET /api/notifications`

### 7.3 标记通知已读
**全部标记已读**
- **请求方式**: `POST /api/notifications/read`
- **请求体**: **无**（该接口不读取请求体，恒为「全部已读」）
- **响应**: `{ "ok": true }`

**单条通知已读 / 修改通知字段**
- **请求方式**: `PATCH /api/notifications/{id}`
- **请求体**（可选字段，至少传一个）:
| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `read` | boolean | 标记已读 / 未读 |
| `title` | string | 修改标题 |
| `content` | string | 修改正文 |
| `source` | string | 修改来源标记 |

### 7.4 删除通知
- **请求方式**: `DELETE /api/notifications/{id}`

---

## 8. 🔖 导航书签与全量配置 (Categories & System Config API)

### 8.1 获取全量工作台数据与偏好配置
- **请求方式**: `GET /api/user/data`
- **响应内容**: 顶层包含 **5 个键** —— `categories`、`links`、`projects`、**`todos`** 以及全量 `config`（主题、壁纸、搜索引擎、模型账号等跨端偏好）。

> 注意包含 `todos`：按早期版本文档实现的脚本会漏掉待办数据。

### 8.2 批量保存或更新工作台数据
- **请求方式**: `POST /api/user/data`

### 8.3 书签与分类接口
`/api/links` 与 `/api/categories/team` 才是书签与分类的**真实读写端点**（详见 [§10.1](#101-书签与分类)）：

| 方法 | 路径 | 说明 |
| :--- | :--- | :--- |
| `GET` | `/api/links` | 返回全部书签与分类，响应形如 `{ links, categories }` |
| `POST` | `/api/links` | 新增书签（仅接受 `http`/`https`，同 URL 幂等） |
| `GET` | `/api/categories/team` | 团队共享分类列表 |
| `POST` | `/api/categories/team` | 订阅他人的共享分类 |

---

## 9. 💡 实战集成案例 (Integration Cookbooks)

### 案例 A: GitHub Actions / Docker CI 自动化构建通知
```yaml
- name: 发送构建通知至 Navelix 个人大盘
  if: always()
  run: |
    curl -s -k -X POST "https://your-navelix-domain.com/api/notifications" \
      -H "Authorization: Bearer ${{ secrets.NAVELIX_API_TOKEN }}" \
      -H "Content-Type: application/json" \
      -d '{
        "title": "🐳 Docker 镜像构建完成 ['"${{ job.status }}"']",
        "content": "分支 '${{ github.ref_name }}' 的 Docker 镜像已在 GitHub Actions 编译并测试完毕。",
        "source": "github_ci"
      }'
```

---

### 案例 B: iOS 快捷指令一键录入日程待办并指派负责人
在 iPhone / iPad 快捷指令应用中：
1. **新建快捷指令**，添加“请求文本输入”（例如：“今天要做什么？”）；
2. 添加 **“获取 URL 内容”** 操作：
   - **URL**: `https://your-navelix-domain.com/api/todos`
   - **方法 (Method)**: `POST`
   - **标头 (Headers)**:
     - `Authorization`: `Bearer nvx_live_your_token`
     - `Content-Type`: `application/json`
   - **请求主体 (JSON)**:
     ```json
     {
       "title": "快捷指令输入的文本",
       "priority": "high",
       "dueDate": "2026-08-15"
     }
     ```

---

### 案例 C: Apple Calendar / 手机日历无缝实时订阅 Navelix 日程
1. 打开 Mac 或 iPhone 的 **“日历” 应用 -> 文件 / 菜单 -> 新建日历订阅**；
2. 粘贴您的专属 Webcal 订阅地址：
   ```text
   webcal://your-navelix-domain.com/api/calendar/export?token=nvx_live_YOUR_TOKEN
   ```
3. 设置自动刷新周期为 **“每 15 分钟”** 或 **“每小时”**，系统内的所有项目里程碑与工作待办即可实时同步显示在系统日历中！

---

### 案例 D: 定时脚本每晚自动顺延未完成待办 (Cron Rollover)
在家庭服务器或 NAS crontab 中设置每晚 23:59 自动延期未完成待办：
```bash
59 23 * * * curl -s -X POST "https://your-navelix-domain.com/api/todos/rollover" \
  -H "Authorization: Bearer nvx_live_YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"today"}'
```

---

## 10. 🧩 扩展接口一览 (Additional Endpoints)

以下端点同样接受 `Authorization: Bearer nvx_live_...` 鉴权（除特别标注外），属于开放接口范畴。这里只列**方法与用途**，字段细节以代码为准（`src/app/api/**/route.ts`）。

### 10.1 书签与分类
| 方法 | 路径 | 说明 |
| :--- | :--- | :--- |
| `GET` | `/api/links` | 返回全部书签与分类，响应形如 `{ links, categories }` |
| `POST` | `/api/links` | 新增书签；仅接受 `http`/`https`，**同 URL 幂等**（已存在时返回既有记录并带 `duplicate: true`） |
| `GET` | `/api/categories/team` | 返回可订阅的团队共享分类 |
| `POST` | `/api/categories/team` | 订阅他人的共享分类（需分类与所有者参数，不能订阅自己的） |

### 10.2 AI 能力
| 方法 | 路径 | 说明 |
| :--- | :--- | :--- |
| `POST` | `/api/ai/summarize` | 传 `{ "url": "..." }`，服务端抓取网页并由 AI 生成摘要，响应形如 `{ notes, title, generated? }`（未配置 Key 时返回内置兜底笔记） |

### 10.3 分享与订阅
| 方法 | 路径 | 说明 |
| :--- | :--- | :--- |
| `POST` | `/api/share/token` | 生成对外分享链接：`{ type: "project" \| "category", id, days }`，`days` 默认 30、上限 365 |
| `GET` | `/api/calendar/export` | 见 [§3.6](#36-icalendar-标准外部日历订阅-apple--google--outlook)，**唯一**支持 Query 参数鉴权的路由 |

### 10.4 系统与运维
| 方法 | 路径 | 说明 |
| :--- | :--- | :--- |
| `GET` | `/api/healthz` | **完全公开、无需鉴权**：返回迁移版本、守护进程状态与 SQLite 数据库 / WAL 文件大小 |
| `GET` | `/api/update-check` | 版本更新检测 |
| `GET` | `/api/weather` | 天气数据 |
| `GET` | `/api/favicon` | 站点图标抓取 |
| `GET` | `/api/realtime` | SSE 实时事件流 |
| `POST` | `/api/analytics/track` | 埋点上报 `{ event, meta }` |
| `GET` | `/api/link-status` | 站点连通性与网络延迟探测（**Pro 专享**，需官方 EE 驱动；单次最多 25 个 URL） |

### 10.5 账号与会话
| 方法 | 路径 | 说明 |
| :--- | :--- | :--- |
| `GET` | `/api/auth/me` | 当前登录用户信息 |
| `PATCH` | `/api/auth/profile` | 修改个人资料 |
| `GET` / `DELETE` | `/api/auth/sessions` | 列出 / 撤销登录会话 |
| `POST` | `/api/auth/refresh` | 刷新会话 |
| `POST` | `/api/auth/logout` | 登出 |
| `POST` | `/api/auth/login` · `/api/auth/register` | 公开端点；登录带**防爆破限流** |

### 10.6 管理端与账号监控
- `POST`/`GET`/`PATCH` `/api/admin/*` —— 系统设置、用户管理、备份、存储、许可证、遥测配置等，全部要求 `role === "admin"`。
- `/api/monitor/*` —— 反重力 / Codex 等模型账号的额度监控与 OAuth 授权流程（`oauth/start`、`oauth/callback`、`oauth/status`、`disconnect`、`refresh`、`accounts`）。

---

*文档版本: 2.0 · 对应 Navelix v2.9.5 | Navelix 遵循**自定义许可证**（详见 [LICENSE](https://github.com/timorpic/Navelix/blob/main/LICENSE)）*
