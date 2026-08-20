# Navelix 收藏助手 (Chrome / Edge 扩展)

工具栏 / 右键一键收藏网页到你的 Navelix 库。不接管新标签页，纯导航辅助。

## 功能

- 📌 **工具栏一键收藏**：点图标弹出面板，内建「收藏 / 设置」两个 Tab。收藏页自动预填当前页标题/URL + 分类下拉；设置页直接在里面填实例地址 + API 令牌，无需打开任何外部网页。
- 🖱️ **右键收藏**：在页面任意处右键「收藏当前页」、在链接上右键「收藏此链接」。
- ⚙️ **配置全部内联在扩展里**：popup「设置」Tab 内即可填地址/令牌并测试连接；无独立设置网页，也不改动 Chrome 新标签页。

## 安装（开发者模式加载解压扩展）

1. 下载/克隆本仓库的 `extension/` 目录。
2. Chrome/Edge 打开 `chrome://extensions`（或 `edge://extensions`）。
3. 右上角开启「开发者模式」→「加载已解压的扩展程序」→ 选择 `extension/` 目录。
4. 首次使用：点击工具栏扩展图标 → 切到「设置」→ 填写：
   - **实例地址**：你的 Navelix 地址，如 `https://navelix.example.com` 或 `http://[IP]:3721`
   - **API 令牌**：后台 → API 令牌 → 新建，得到 `nvx_live_xxx`
   - 点「测试连接」确认通过。
5. 切回「收藏」Tab，点击收藏即保存当前页。

## 权限说明

- `storage`：仅在本地保存 实例地址 + API 令牌（`chrome.storage.sync`）。
- `contextMenus` / `tabs`：实现右键与一键收藏当前页。
- `notifications`：收藏成功/失败桌面提醒。
- `host_permissions <all_urls>`：向你的 Navelix 实例发送 API 请求（跨域）。

> 令牌等于你的账号密码，仅在本地存储；请通过 HTTPS/内网使用。

## 发布

打包为 `.zip`（含 `manifest.json` 等全部文件）后上传 Web Store。图标已提供 `icons/icon-{16,32,48,128}.png`（由 `public/logo.svg` 光栅化），可直接用于商店审核。

## API 依赖

- `GET /api/links`：读取书签与分类（收藏弹窗分类下拉）
- `POST /api/links`：新增单条书签（幂等去重）

这两个接口随 Navelix 主仓库交付。