/**
 * 全局共享常量：集中管理散落在代码中的品牌文案、默认值与路径，
 * 避免同一字面量在多处硬编码导致修改不同步。
 */

/** 默认站点标题（Navelix · Personal Digital Hub） */
export const DEFAULT_SITE_TITLE = "Navelix · Personal Digital Hub";

/** 默认页脚文案 */
export const DEFAULT_CUSTOM_FOOTER = "© 2026 Navelix. 保留所有权利。";

/** 初始管理员密码提示文件名（位于 data/ 目录） */
export const ADMIN_PASSWORD_FILE = "navelix-admin-password.txt";

/** data 数据目录名 */
export const DATA_DIR_NAME = "data";

/** 主数据库文件名 */
export const DB_FILE_NAME = "navelix.db";

/** 应用默认端口 */
export const DEFAULT_PORT = 3721;
