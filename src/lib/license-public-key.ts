/**
 * 官方离线验签公钥（SPKI 格式）—— 独立模块，本文件必须保持**零 import**。
 *
 * 为什么单独成文件：
 * `ee/index.ts`（商业驱动）需要这个公钥常量来注入 ee-bridge。若直接从
 * `license.ts` 导入，esbuild 会把 `license.ts` 的整条依赖链打进 `bundle.jsc`：
 *
 *   ee/index.ts → license.ts → db.ts → db/connection.ts
 *                                     ├─ migrateLegacyDatabase()
 *                                     ├─ initSchema(db)
 *                                     └─ runMigrations(db)   ← 顶层副作用
 *
 * 后果是**仅加载字节码就会建库、跑全部迁移、写出初始密码文件**，并在进程内
 * 产生第二个 SQLite 连接；更麻烦的是字节码封存的是编译当日的迁移树，新增迁移
 * 后会出现「Next 侧跑 v14、字节码内仍在跑 v13」的两套逻辑并存。
 *
 * 因此：新增常量请直接写在这里；**不要**在本文件加入任何 import，
 * 也不要让 ee/ 改回从 license.ts 取公钥。回归测试见
 * `src/lib/__tests__/ee-import-isolation.test.ts`。
 */

/** 官方 Ed25519 验签公钥。轮换密钥对时同步替换此处（旧许可证将失效）。 */
export const OFFICIAL_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA5KmNs4oeMLfDOmh8QMttBdk7KSrSQYi+Ir93lBosS6g=
-----END PUBLIC KEY-----`;
