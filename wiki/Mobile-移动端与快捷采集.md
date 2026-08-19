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
| **记待办** | 打开应用日历视图，可直接新建待办 |

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

### 3.2 快捷存书签（2 个 HTTP 动作）

书签走全量快照接口 `/api/user/data`，因此快捷指令需要"先读后写"：

1. **读取**：「获取 URL 内容」`<BASE>/api/user/data`（GET，`Authorization: Bearer`）→ 存入变量 `data`
2. **追加**：「Get Dictionary Value」`links` →「Count」+ 程序化追加一条记录（`title`/`url`）
3. **写回**：「获取 URL 内容」`<BASE>/api/user/data`（POST，Bearer），请求体为 `{ "links": <更新后的列表> }`

> 快捷指令的 JSON 编辑较繁琐；若日常以"手动添加待办"为主，建议优先用 **3.1 记待办**。

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