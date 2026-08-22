import type { DatabaseSync } from "node:sqlite";
import {
  generateStrongPassword,
  hashPassword,
  verifyPassword,
} from "../../password.ts";
import { persistAdminPassword } from "../shared.ts";

/**
 * v3：一次性迁移 —— 轮换旧版本遗留的默认弱密码 admin123。
 * 必须在 seedAdminIfEmpty 之后调用，保证基于已存在的 admin 执行。
 */
export function migrateV3(db: DatabaseSync): void {
  const adminRow = db
    .prepare(
      "SELECT id, username, password_hash FROM users WHERE username = 'admin' AND role = 'admin'",
    )
    .get() as { id: string; password_hash: string } | undefined;
  if (adminRow && verifyPassword("admin123", adminRow.password_hash)) {
    const newPassword =
      process.env.NAVELIX_ADMIN_PASSWORD || generateStrongPassword();
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
      hashPassword(newPassword),
      adminRow.id,
    );
    // 并发场景下确认最终落库的确实是本次生成的密码后再写提示文件
    const after = db
      .prepare("SELECT password_hash FROM users WHERE id = ?")
      .get(adminRow.id) as { password_hash: string } | undefined;
    if (after && verifyPassword(newPassword, after.password_hash)) {
      persistAdminPassword(newPassword);
    }
  }
}