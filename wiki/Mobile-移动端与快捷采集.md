# 📱 移动端 PWA 与快捷采集

> Navelix 已支持 **PWA**：手机浏览器"添加到主屏幕"后，可全屏独立运行、离线打开核心页面，并配合 **iOS 快捷指令 / Scriptable 小组件**实现"掏出手机一键采集"。

---

## 1. 🏠 安装为 PWA（添加到主屏幕）

- **iOS（Safari）**：打开 Navelix → 分享按钮 → 「添加到主屏幕」→ 从主屏幕图标全屏打开。
- **Android（Chrome）**：右上角菜单 → 「安装应用 / 添加到主屏幕」。
- **桌面 Chrome/Edge**：地址栏安装图标 → 作为独立窗口应用运行。

> 首次添加到主屏幕后建议**完整打开一次所有常用页面**，让 Service Worker 缓存离线壳。
> 离线时（无网络）仍可打开已缓存的页面；数据类操作需联网。

## 2. ⚡ 快速采集（PWA 快捷方式）

沿主屏幕图标长按（iOS）或右键 PWA 窗口（桌面），可出现快捷方式：

| 快捷方式 | 行为 |
| --- | --- |
| **存书签** | 打开应用并自动弹出「添加书签」弹窗（`?action=quick-add-bookmark`） |
| **快速记待办** | ⚠️ 当前版本**尚未接线**：manifest 已声明 `?action=quick-add-todo`，但前端没有对应处理分支，点击后只会打开首页、不弹任何窗口。录入待办请改用 [§3.1 的 iOS 快捷指令](#31-快捷记待办1-个-http-动作)。 |

## 3. 🍎 iOS 快捷指令（Shortcuts）模板

需要一个 **Personal Access Token**（API Token）：
`后台 → API 令牌 → 新建`，得到形如 `nvx_live_xxx` 的令牌。

> 令牌 = 你的密码，切勿分享。以下以你的实例地址 `<BASE>`（如 `https://navelix.example.com`）为例。

### 3.1 快捷记待办（1 个 HTTP 动作）

1. 新建快捷指令 → 「获取当前日期」→「文本」填入 `{  "title": "提醒事项", "priority": "medium" }`
2. 「获取 URL 内容」：
   - URL：`<BASE>/api/todos`
   - 方法：POST；头：`Authorization: Bearer 你的令牌`
   - 请求体：选择上面的文本
   - 网络 → 显示响应，失败时忽略

> 进阶：配合「快捷指令 → 显示输入框」接收文本，或接入"共享菜单"把网页链接转为待办标题。

### 3.2 快捷存书签（1 个 HTTP 动作）

`POST /api/links` 是**幂等**的书签写入接口（同 URL 重复提交会返回既有记录并带 `duplicate: true`），因此不再需要"先读后写"：

1. 「获取 URL 内容」：
   - URL：`<BASE>/api/links`
   - 方法：POST
   - 头：`Authorization: Bearer 你的令牌`、`Content-Type: application/json`
   - 请求体（JSON）：
     ```json
     {
       "url": "https://example.com",
       "title": "可选，缺省取域名",
       "description": "可选",
       "category": "可选，缺省 favorites",
       "notes": "可选，Markdown 笔记",
       "isQuickAccess": false
     }
     ```
2. 「显示结果」查看返回的书签对象。

> 仅接受 `http` / `https` 链接。旧写法（GET `/api/user/data` 取全量快照 → 追加 → POST 写回）已无必要。

### 3.3 查看模型额度

「获取 URL 内容」`<BASE>/api/monitor/accounts`（GET，Bearer）→「显示结果」。响应为 JSON，包含反重力 / Codex 各账号的额度窗口与订阅状态。

## 4. 🔲 iOS 小组件（Scriptable 模板）

不支持快捷指令的小组件场景，可用免费国产 [Scriptable](https://scriptable.app) 渲染：

```javascript
// 复制为 Scriptable 脚本 → 添加"scriptable"小组件，每 15 分钟刷新
const BASE = "https://你的实例";   // ← 改为你的地址
const TOKEN = "nvx_live_xxx";      // ← 你的 API 令牌
const req = new Request(BASE + "/api/monitor/accounts");
req.headers = { Authorization: "Bearer " + TOKEN };
const data = await req.loadJSON();

let body = "";
(data.accounts || []).forEach((a) => {
  const per = a.quotaSummary?.groups
    ?.map((g) => g.windows.map((w) => `${g.shortName} ${w.label} ${Math.round((w.remainingFraction || 0) * 100)}%`).join("  "))
    .join("\n");
  body += `${a.provider === "antigravity" ? "🌀" : "🧠"} ${a.label}\n${per || a.codexUsage ? "额度见 App" : "未查询"}\n`;
});

const w = new ListWidget();
w.backgroundColor = new Color("#151218");
const t = w.addText("🧠 Navelix 额度");
t.font = Font.boldSystemFont(16); t.textColor = Color.white();
const b = w.addText(body || "暂无账号");
b.font = Font.systemFont(12); b.textColor = new Color("#9ca3af");
Script.setWidget(w);
```

---

*相关：[[REST API 开放接口文档|REST-API-开放接口文档]] · [[安全机制与运维规范|Security-安全机制与运维规范]]*