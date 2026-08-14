# 📖 Navelix REST API & Personal Access Token 开放接口 Wiki 文档

欢迎使用 **Navelix 个人数字工作空间 (Personal Digital Hub)** 的 REST API。
通过开放接口与个人 API Access Token，你可以方便地在 **iOS 快捷指令、Docker 构建流水线、Python/Node.js 自动化脚本、家庭服务器 (NAS) 巡检、以及 AI 智能体 (Custom GPTs / Dify)** 中集成 Navelix。

---

## 📌 目录 (Table of Contents)

- [1. 🔐 鉴权机制与安全 (Authentication)](#1--鉴权机制与安全-authentication)
- [2. 🔑 密钥管理接口 (API Tokens Management)](#2--密钥管理接口-api-tokens-management)
- [3. 🔔 消息通知与活动推送 (Notifications API)](#3--消息通知与活动推送-notifications-api)
- [4. 🔖 导航书签与分类数据 (Categories & Links API)](#4--导航书签与分类数据-categories--links-api)
- [5. 📋 个人项目与待办清单 (Projects & Todos API)](#5--个人项目与待办清单-projects--todos-api)
- [6. 💡 实战集成案例 (Integration Cookbooks)](#6--实战集成案例-integration-cookbooks)
  - [案例 A: GitHub Actions / Docker CI 自动化构建通知](#案例-a-github-actions--docker-ci-自动化构建通知)
  - [案例 B: iOS 快捷指令一键保存网页书签](#案例-b-ios-快捷指令一键保存网页书签)
  - [案例 C: Python 脚本检测 NAS 状态并推送](#案例-c-python-脚本检测-nas-状态并推送)

---

## 1. 🔐 鉴权机制与安全 (Authentication)

Navelix 支持通过 **HTTP Authorization Header** 传递 Bearer Token 进行 REST API 请求鉴权。

### 🔑 Token 格式
每个 API Token 的前缀均为 `nvx_live_`，形如：
```text
nvx_live_a1b2c3d4e5f678901234567890abcdef
```

### 🛡️ 请求头结构
在所有 HTTP 请求中，附加以下 Request Header：
```http
Authorization: Bearer nvx_live_YOUR_API_TOKEN
Content-Type: application/json
```

> 💡 **安全提示**：
> 1. API Token 拥有对应账号的所有写与增删权限，请勿将 Token 提交至公开代码仓库。
> 2. 建议为不同设备或场景创建独立的 Token（如 “iOS 手机”、“NAS 服务器”），方便随时单独撤销。
> 3. Token 仅在创建时完整显示一次，系统底层采用 **SHA-256 哈希加密存储**，保证即使数据库泄露也无法还原明文密钥。

---

## 2. 🔑 密钥管理接口 (API Tokens Management)

*仅可通过 Web 前端或内部登录 Session 进行密钥的创建与销毁。*

### 2.1 创建 API Token
- **请求方式**: `POST /api/auth/api-tokens`
- **请求体**:
```json
{
  "name": "iOS 快捷指令密钥"
}
```
- **响应示例**:
```json
{
  "success": true,
  "token": "nvx_live_a1b2c3d4e5f678901234567890abcdef",
  "tokenId": "tok_123456",
  "name": "iOS 快捷指令密钥",
  "tokenPrefix": "nvx_live_a1b2...cdef",
  "message": "API 密钥生成成功！请务必妥善保管，该密钥仅显示一次。"
}
```

### 2.2 获取 Token 列表
- **请求方式**: `GET /api/auth/api-tokens`
- **响应示例**:
```json
{
  "tokens": [
    {
      "id": "tok_123456",
      "name": "iOS 快捷指令密钥",
      "tokenPrefix": "nvx_live_a1b2...cdef",
      "createdAt": 1786680000000,
      "lastUsedAt": 1786681200000
    }
  ]
}
```

### 2.3 撤销 Token
- **请求方式**: `DELETE /api/auth/api-tokens`
- **请求体**:
```json
{
  "id": "tok_123456"
}
```

---

## 3. 🔔 消息通知与活动推送 (Notifications API)

利用此接口，外部系统（如 NAS、GitHub Actions、服务器巡检脚本）可以向 Navelix 前台面板推送实时消息提醒。

### 3.1 推送新通知
- **请求方式**: `POST /api/notifications`
- **请求头**: `Authorization: Bearer nvx_live_YOUR_TOKEN`
- **请求体**:
| 字段 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `title` | string | 是 | 通知标题（建议附带 Emoji 图标） |
| `content` | string | 否 | 通知详细内容或说明文案 |

#### cURL 示例
```bash
curl -X POST https://your-navelix-domain.com/api/notifications \
  -H "Authorization: Bearer nvx_live_YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "🖥️ 服务器高负载告警",
    "content": "节点 node-01 CPU 占用率超过 90%，请检查是否有异常进程"
  }'
```

- **响应格式 (201 Created)**:
```json
{
  "notification": {
    "id": "a1b2c3d4e5f67890",
    "title": "🖥️ 服务器高负载告警",
    "content": "节点 node-01 CPU 占用率超过 90%，请检查是否有异常进程",
    "createdAt": 1786682000000,
    "read": false
  }
}
```

### 3.2 获取通知列表
- **请求方式**: `GET /api/notifications`
- **请求头**: `Authorization: Bearer nvx_live_YOUR_TOKEN`
- **响应格式**:
```json
{
  "notifications": [
    {
      "id": "a1b2c3d4e5f67890",
      "title": "🖥️ 服务器高负载告警",
      "content": "节点 node-01...",
      "createdAt": 1786682000000,
      "read": false
    }
  ]
}
```

---

## 4. 🔖 导航书签与分类数据 (Categories & Links API)

### 4.1 获取分类与全量书签数据
- **请求方式**: `GET /api/user/data`
- **请求头**: `Authorization: Bearer nvx_live_YOUR_TOKEN`
- **响应格式**:
```json
{
  "categories": [
    { "id": "cat_dev", "name": "开发工具", "icon": "💻" }
  ],
  "links": [
    {
      "id": "lnk_01",
      "title": "GitHub",
      "url": "https://github.com",
      "categoryId": "cat_dev",
      "description": "代码托管平台"
    }
  ]
}
```

### 4.2 添加新的导航书签
- **请求方式**: `POST /api/user/data`
- **请求头**: `Authorization: Bearer nvx_live_YOUR_TOKEN`
- **请求体**:
```json
{
  "action": "add_link",
  "link": {
    "title": "Tailwind CSS 文档",
    "url": "https://tailwindcss.com",
    "description": "实用优先的 CSS 框架",
    "icon": "🎨",
    "categoryId": "cat_dev"
  }
}
```

---

## 5. 📋 个人项目与待办清单 (Projects & Todos API)

### 5.1 获取待办事项列表
- **请求方式**: `GET /api/todos`
- **请求头**: `Authorization: Bearer nvx_live_YOUR_TOKEN`

### 5.2 创建新待办事项
- **请求方式**: `POST /api/todos`
- **请求头**: `Authorization: Bearer nvx_live_YOUR_TOKEN`
- **请求体**:
| 字段 | 类型 | 必填 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `title` | string | 是 | - | 待办标题 |
| `priority` | string | 否 | `"medium"` | 优先级: `"low"` / `"medium"` / `"high"` |
| `dueDate` | number/string | 否 | `null` | 截止时间戳或日期字符串 |
| `projectId` | string | 否 | `null` | 关联的项目 ID |

```json
{
  "title": "核对主节点 Docker 存储空间",
  "priority": "high"
}
```

---

## 6. 💡 实战集成案例 (Integration Cookbooks)

### 案例 A: GitHub Actions / Docker CI 自动化构建通知
在仓库 `.github/workflows/docker.yml` 的末尾添加自动通知 Step：

```yaml
- name: 发送构建通知至 Navelix 个人大盘
  if: always()
  run: |
    curl -s -k -X POST "https://hei.timor.eu.org:2096/api/notifications" \
      -H "Authorization: Bearer ${{ secrets.NAVELIX_NOTIFICATION_TOKEN }}" \
      -H "Content-Type: application/json" \
      -d '{
        "title": "🐳 Docker 镜像构建完成 ['"${{ job.status }}"']",
        "content": "分支 '${{ github.ref_name }}' 的 Docker 镜像已在 GitHub Actions 编译并测试完毕。"
      }'
```

---

### 案例 B: iOS 快捷指令一键保存网页书签
在 iPhone / iPad 快捷指令应用中：
1. **新建快捷指令**，添加“从共享表单获取 URL”。
2. 添加 **“获取 URL 内容”** 操作：
   - **URL**: `https://hei.timor.eu.org:2096/api/user/data`
   - **标头 (Headers)**:
     - `Authorization`: `Bearer nvx_live_your_token`
     - `Content-Type`: `application/json`
   - **请求主体 (JSON)**:
     ```json
     {
       "action": "add_link",
       "link": {
         "title": "来自 iOS 快捷指令保存",
         "url": "快捷指令输入的 URL",
         "categoryId": "default"
       }
     }
     ```
3. 保存后在任意浏览器点击“分享 -> 快捷指令”即可一键收藏。

---

### 案例 C: Python 脚本检测 NAS 状态并推送
```python
import requests

NAVELIX_HOST = "https://hei.timor.eu.org:2096"
API_TOKEN = "nvx_live_a1b2c3d4e5f678901234567890abcdef"

def send_navelix_notice(title: str, content: str):
    url = f"{NAVELIX_HOST}/api/notifications"
    headers = {
        "Authorization": f"Bearer {API_TOKEN}",
        "Content-Type": "application/json"
    }
    payload = {
        "title": title,
        "content": content
    }
    try:
        response = requests.post(url, json=payload, headers=headers, verify=False)
        return response.json()
    except Exception as e:
        print(f"推送失败: {e}")

# 脚本调用示例
send_navelix_notice(
    title="💾 NAS 外置硬盘自动巡检结果",
    content="RAID 阵列健康度 100%，已完成每周 SMART 检修扫描。"
)
```

---

*文档版本: 1.0.0 | Navelix Core | 遵循 MIT 开源协议*
