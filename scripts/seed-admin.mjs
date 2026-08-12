import { randomBytes, scryptSync } from "node:crypto";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "..", "data", "nexus.db");
const db = new DatabaseSync(dbPath);

const username = "admin";
const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const generateStrongPassword = () => {
  const bytes = randomBytes(16);
  let pwd = "";
  for (let i = 0; i < 16; i++) {
    pwd += charset[bytes[i] % charset.length];
  }
  return pwd;
};
const password = process.env.NAVELIX_ADMIN_PASSWORD || generateStrongPassword();
const displayName = "Admin";

const salt = randomBytes(16).toString("hex");
const hash = scryptSync(password, salt, 64).toString("hex");
const passwordHash = `${salt}:${hash}`;

const id = randomBytes(16).toString("hex");
const now = Date.now();

db.prepare(
  `INSERT INTO users (id, username, password_hash, display_name, role, created_at)
   VALUES (?, ?, ?, ?, 'admin', ?)
   ON CONFLICT(username) DO UPDATE SET
     password_hash = excluded.password_hash,
     role = 'admin',
     display_name = COALESCE(users.display_name, excluded.display_name)`,
).run(id, username, passwordHash, displayName, now);

const row = db
  .prepare("SELECT username, role, display_name FROM users WHERE username = ?")
  .get(username);

console.log("Default admin account ready:", row);
if (!process.env.NAVELIX_ADMIN_PASSWORD) {
  console.warn(
    `提示：admin 密码已重置为随机强密码：${password}\n请登录后立即修改，或设置 NAVELIX_ADMIN_PASSWORD 环境变量后重新执行本脚本。`,
  );
}
