import path from "node:path";
import { DATA_DIR_NAME } from "./constants.ts";

/**
 * 解析运行期数据目录（SQLite 库、备份、日志、初始密码）。
 * 默认 <cwd>/data；可通过环境变量 NAVELIX_DATA_DIR 覆盖，
 * 供 E2E 测试（Playwright webServer 指向隔离目录）与自托管数据迁移场景使用。
 * 注意：本模块仅供服务端使用（含 node:path），禁止被客户端组件导入。
 */
export function resolveDataDir(): string {
  const override = process.env.NAVELIX_DATA_DIR;
  if (override && override.trim() !== "") {
    return path.resolve(override.trim());
  }
  return path.join(process.cwd(), DATA_DIR_NAME);
}
