# 从 Sun-Panel 迁移到 Navelix

正在寻找 Sun-Panel 迁移方法，或评估 Sun-Panel 替代方案（sun-panel alternative self-hosted）？这份指南面向寻找自托管导航推荐的用户：保留已有分类与网址，再按需使用 Navelix 的 AI、项目甘特图和日历待办。Sun-Panel 很适合专注导航；只有需要这些扩展能力时，才值得考虑迁移。

你的 Sun-Panel 配置不用丢：导出 JSON，上传，分类和网址自动搬进来；搬完你还多了 AI、甘特图和日历。

## 支持范围

| 数据 | 支持情况 |
| --- | --- |
| 分类与链接 | 自动解析；同名分类忽略首尾空白与大小写后合并到本人分类 |
| 描述 | 读取 `description` / `remark` / `subTitle` / `info` |
| 图标 | 保留图标字段（字符串或对象的 `src` / `text`）；不复制外部图片文件 |
| 用户、权限、公开状态 | 不迁移；按 Navelix 自身的用户和分享设置管理 |
| Sun-Panel 的主题、布局、组件及其他设置 | 不迁移；仅迁导航数据 |

支持 v1.8.x `icons` 分组、`itemGroupList`、`groups` / `categories`、根数组（分组或链接）以及根对象 `items`。这不是任意版本全部配置项的完整恢复工具；文件必须包含有效链接。链接优先读取 `url`，再依次读取 `link` / `href` / `targetUrl` / `lanUrl`，不会同时搬入同条记录的内外网双地址。

## 迁移步骤

1. **先备份 Navelix**：在「用户设置 → 账号与数据 → 导出 Navelix JSON」保存个人备份。
2. **在 Sun-Panel 导出 JSON**：以 v1.8.1 为例，点击首页右上角四格按钮打开「系统应用」→「导出导入」→「导出配置」，勾选「图标配置」后点击「继续」，保存下载的 `*.sun-panel.json` 文件。具体位置随版本而异。
3. **在 Navelix 上传**：登录后，空导航工作区首页点击「选择 Sun-Panel JSON」。已有导航数据时，进入「用户设置 → 账号与数据 → 导入 Sun-Panel 配置文件」，选择导出的 JSON。
4. **等待保存结果**：成功弹窗显示实际新增分组、链接和跳过的重复网址数。刷新首页可确认数据已保存。同名分类可能合并，因此新增分组数可以为 0。
5. **探索下一步**：前往项目页创建项目、使用甘特图，或查看日历待办。AI 拆解需要先配置 AI 服务；Chrome 扩展需单独安装和配置。

通常几分钟即可上手，实际耗时取决于文件大小和实例性能。迁移全程不会修改 Sun-Panel 原实例，两个实例可并行保留。

## 分步操作截图

### 1. 在 Sun-Panel 导出配置

以下是独立测试实例运行官方 Docker 镜像 `hslr/sun-panel:1.8.1` 的真实界面。点击首页右上角四格按钮，在「系统应用」选择「导出导入」，再点击「导出配置」：

![Sun-Panel 导出配置入口](https://raw.githubusercontent.com/timorpic/Navelix/main/public/screenshots/sun-panel-export-entry.png)

保留「图标配置」勾选，点击「继续」下载 JSON。这里的「图标配置」包含分组、链接和描述，不包含上传的图片文件：

![Sun-Panel 导出选项](https://raw.githubusercontent.com/timorpic/Navelix/main/public/screenshots/sun-panel-export-options.png)

### 2. 在 Navelix 上传 JSON

空导航工作区的上传入口：

![空工作区迁移入口](https://raw.githubusercontent.com/timorpic/Navelix/main/public/screenshots/sun-panel-import-empty.png)

### 3. 查看保存结果

保存成功后显示实际新增与跳过数量：

![Sun-Panel 导入结果](https://raw.githubusercontent.com/timorpic/Navelix/main/public/screenshots/sun-panel-import-result.png)

窄屏深色界面：

![移动端深色迁移入口](https://raw.githubusercontent.com/timorpic/Navelix/main/public/screenshots/sun-panel-import-empty-mobile-dark.png)

以上截图均来自隔离测试实例：Sun-Panel 中创建一个示例路由器链接并实际导出；Navelix 的结果图演示一个内网链接及一个重复网址。真实 Sun-Panel 导出文件另作为自动化回归样本验证。

## FAQ

**图标会不会丢？**

HTTP(S) 图片地址和 data URL 可直接显示；相对路径、自定义文本或 Sun-Panel 专属图标名称不保证显示一致。相对路径引用的图片不会随 JSON 搬迁，停掉原实例前应检查并重新上传需要的图标。缺少可用图标时，链接卡片尝试通过公共 favicon 服务显示图标，失败则使用占位；这依赖网络且不是图片备份。

**重复导入会怎样？**

按完整 URL 忽略大小写去重，既检查已有数据，也检查当前文件中前面出现的链接；不会更新已有链接的标题、图标或描述。不同路径、尾部斜杠、协议或查询参数仍可能是不同网址。同名本人分类合并；不会将导入链接写入订阅分类。

**会不会清空我的数据？**

不会。Sun-Panel 和浏览器 HTML 书签使用合并导入，保留已有数据。不要与「导入个人 Navelix JSON」混淆：个人 JSON 是恢复操作，会替换对应个人数据。

**内网地址（例如 192.168.*）怎么办？**

地址按原值保留，可从能访问该网络的浏览器打开。导入本身不探活；链接探针是单独的 Pro 功能，受服务端 SSRF 限制，不能用探针结果判断内网服务是否可用。迁移不改变探针安全策略。

**导入失败怎么办？**

检查文件是否为合法 JSON、是否包含支持结构和有效链接，以及当前登录与网络连接。保存冲突时刷新后重试。看到失败提示不代表已保存；以刷新后的数据为准。再次上传同一文件不会重复添加已保存的网址。

## 回滚建议

保留 Sun-Panel 原实例及其导出文件。需要恢复到导入前状态时，在「账号与数据」导入事先保存的 Navelix 个人 JSON；这会恢复备份中的个人数据，也可能覆盖备份后新增的内容，因此恢复前再导出当前工作区。

个人 JSON 不包含所有服务端凭据，不能代替实例级备份。涉及完整实例回滚，请参阅[安全与运维规范](Security-安全机制与运维规范.md)。

Navelix 与 Sun-Panel 没有官方合作关系；这里的兼容说明仅描述 JSON 导入能力。
