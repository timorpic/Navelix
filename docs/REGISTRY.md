# 构建、校验与分发

## 当前 registry 状态

项目 `package.json` 标记为 `private: true`，没有组件 registry 清单、独立组件包、组件安装 CLI 或组件构建/发布脚本。`src/components/` 是应用内部源码；不要将不存在的 `registry:build`、`registry.json` 或 `npm publish` 写成可用流程。

本文件记录当前实际的应用分发方式与 EE 驱动注册机制。若未来引入组件注册表，需另行确定清单格式、Props/API 兼容、依赖、样式、示例、校验和版本策略，并同步页面与开发文档。

## 应用构建产物

| 产物 | 来源 | 使用方式 |
| --- | --- | --- |
| Next.js 构建 | `pnpm build` | `pnpm start` 启动完整项目构建 |
| standalone | `next.config.ts` 的 `output: "standalone"` | 配合 `public/` 与 `.next/static/` 运行 |
| Docker 镜像 | 多阶段 `Dockerfile` | 端口 3721，持久化 `/app/data` |
| 浏览器扩展 | `extension/` | 按扩展 README 加载或使用独立发布压缩包 |

运行期 `data/` 被 standalone tracing 排除，不能把真实业务数据库和初始密码打包进分发产物。Dockerfile 还处理 pnpm standalone 的 SWC helper 与 bytenode 运行依赖；直接手工复制 standalone 时需检查这些差异。

## EE 驱动注册

`src/lib/ee-bridge/index.ts` 中的 `registerEEDrivers()` 将驱动写入进程全局的 `Symbol.for("navelix.ee.drivers")` 注册表，契约定义在 `types.ts`。

- 存储与探针驱动由相应 getter 获取；缺失时使用 `stubs.ts` 的 CE 降级实现。
- `isEEAvailable()` 检查存储与探针驱动是否存在；驱动存在与许可有效是不同条件。
- `src/instrumentation.ts` 尝试加载 `ee/dist/bundle.jsc` 并注册商业能力，缺失或加载失败则继续 CE 运行。
- `ee/dist/bundle.jsc` 是 V8 字节码，与编译时的 Node/V8 版本强绑定，跨版本加载会抛 `cachedDataRejected`。镜像构建在同一 `node:24-alpine` 内完成编译与运行，两阶段同源；在镜像外预编译的制品必须用目标运行版本重编（`node ee/compile.mjs`），否则会报告字节码加载失败并继续以 CE 运行。

`ee/index.ts` 的**运行时依赖图必须保持精简**：esbuild 会把它的整条依赖链打进 `bundle.jsc`，而字节码在 `instrumentation.ts` 里被 require 时其顶层语句立即执行。曾因从 `src/lib/license.ts` 取公钥常量，而 `license.ts → db.ts → db/connection.ts` 顶层会 `initSchema` + `runMigrations`，导致仅加载字节码就建库、跑完全部迁移、写出初始密码文件，并产生第二个 SQLite 连接；字节码还封存了编译当日的迁移树，新增迁移后会出现两套逻辑并存。公钥因此拆到零依赖的 `src/lib/license-public-key.ts`。新增 EE 依赖前先确认它不引入 `db.ts`、`migrations/` 或 `license.ts`——`src/lib/__tests__/ee-import-isolation.test.ts` 会遍历依赖图拦截回归。

这是服务端驱动注册机制，不是前端组件分发服务。客户端不能直接依赖商业私有实现。

## 校验与镜像发布

源码 CI 执行 lint、类型检查、覆盖率、生产构建和 Playwright。`.github/workflows/docker.yml` 在 Release 发布或手动触发时构建镜像：

1. 跳过非应用 Release，复用同一提交的源码 CI（lint、类型、覆盖率、构建及生产 E2E），校验应用 Release tag 与 `package.json` 一致。
2. 如配置 `EE_COMMERCIAL_BUNDLE`，从 Secret 恢复商业驱动；没有则构建 CE。
3. 只向 GHCR 推送本次运行的 `candidate-<run_id>-<attempt>` 标签，并记录不可变 digest。
4. 冒烟任务按 digest 拉取，检查登录、种子数据、配置写入、敏感字段、非 root、数据权限与制品；以独立卷验证历史 v20 升级；另启动独立容器运行生产镜像 E2E。
5. 仅正式应用 Release 的全部门禁成功后，用同一 manifest digest 提升 GHCR 的版本及 latest；有凭据时同步 Docker Hub。使用 `imagetools create --prefer-index=false` 保留单一来源 manifest 格式，不重新构建。手动触发和预发布保留候选，不提升稳定标签。

跨 registry 的提升不是事务：若只有一个 registry 成功，需分别报告并修复失败渠道；已经提升的也是通过验证的镜像。发布流程串行执行，任一验收失败时不进入提升任务。组件改动随应用产物分发，无独立组件发布步骤。该流程实现参考 [Docker imagetools create](https://docs.docker.com/reference/cli/docker/buildx/imagetools/create/)，远程发布结果须在实际运行后核验。

版本与日志脚本见 [DEVELOPMENT](DEVELOPMENT.md)，持久化和运行条件见 [DEPLOYMENT](DEPLOYMENT.md)。

构建入口先清理旧 standalone。当前 Next.js 的 instrumentation trace 不应用路由排除规则，入口会在构建后移除生成产物中的运行数据副本及其 trace 引用，并拒绝仍含主密钥、运行数据库或初始密码文件的产物；检查不读取密钥内容。
