import { db } from "./db.ts";
import { decryptSecret, encryptSecret } from "./secret.ts";
import { recordAuditLog } from "./audit.ts";

interface TelegramRow {
  bot_token: string; chat_id: string; enabled: number; notify_backup: number; notify_system: number; notify_todo: number; notify_assignment: number; notify_data_transfer: number;
}
export function getTelegramSettings(userId: string): TelegramRow {
  return db.prepare("SELECT bot_token, chat_id, enabled, notify_backup, notify_system, notify_todo, notify_assignment, notify_data_transfer FROM user_notification_settings WHERE user_id = ? AND channel = 'telegram'").get(userId) as TelegramRow | undefined
    ?? { bot_token: "", chat_id: "", enabled: 0, notify_backup: 0, notify_system: 0, notify_todo: 0, notify_assignment: 0, notify_data_transfer: 0 };
}
export function getTelegramConfigStatus(userId: string) {
  const row = getTelegramSettings(userId);
  const admin = Boolean(db.prepare("SELECT 1 FROM users WHERE id = ? AND role = 'admin' AND disabled = 0").get(userId));
  return {
    notifyTodo: row.notify_todo === 1, notifyAssignment: row.notify_assignment === 1, notifyDataTransfer: row.notify_data_transfer === 1,
    configured: Boolean(row.bot_token && decryptSecret(row.bot_token)),
    chatIdConfigured: Boolean(row.chat_id), enabled: row.enabled === 1,
    notifyBackup: admin && row.notify_backup === 1, notifySystem: admin && row.notify_system === 1,
  };
}
export function saveTelegramSettings(userId: string, input: unknown): void {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("配置必须是对象");
  const patch = input as Record<string, unknown>;
  const types: Record<string, string> = { botToken: "string", chatId: "string", enabled: "boolean", notifyBackup: "boolean", notifySystem: "boolean", clearBotToken: "boolean", notifyTodo: "boolean", notifyAssignment: "boolean", notifyDataTransfer: "boolean" };
  for (const [key, value] of Object.entries(patch)) {
    if (!types[key] || typeof value !== types[key]) throw new Error(`无效配置项：${key}`);
  }
  const nested = db.isTransaction;
  db.exec(nested ? "SAVEPOINT telegram_settings" : "BEGIN IMMEDIATE");
  try {
    const admin = db.prepare("SELECT 1 FROM users WHERE id = ? AND role = 'admin' AND disabled = 0").get(userId);
    if (!admin && (patch.notifyBackup === true || patch.notifySystem === true)) throw new Error("仅管理员可订阅全站备份与系统异常");
    const row = getTelegramSettings(userId);
    const token = patch.clearBotToken ? "" : typeof patch.botToken === "string" && patch.botToken.trim() ? encryptSecret(patch.botToken) : row.bot_token;
    const chatId = typeof patch.chatId === "string" ? patch.chatId.trim() : row.chat_id;
    if (chatId && !/^-?\d+$/.test(chatId)) throw new Error("Chat ID 必须是数字");
    db.prepare(`INSERT INTO user_notification_settings (user_id, channel, bot_token, chat_id, enabled, notify_backup, notify_system, notify_todo, notify_assignment, notify_data_transfer, updated_at)
      VALUES (?, 'telegram', ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, channel) DO UPDATE SET
      bot_token=excluded.bot_token, chat_id=excluded.chat_id, enabled=excluded.enabled,
      notify_backup=excluded.notify_backup, notify_system=excluded.notify_system, notify_todo=excluded.notify_todo, notify_assignment=excluded.notify_assignment, notify_data_transfer=excluded.notify_data_transfer, updated_at=excluded.updated_at`)
      .run(userId, token, chatId, typeof patch.enabled === "boolean" ? Number(patch.enabled) : row.enabled,
        admin ? typeof patch.notifyBackup === "boolean" ? Number(patch.notifyBackup) : row.notify_backup : 0,
        admin ? typeof patch.notifySystem === "boolean" ? Number(patch.notifySystem) : row.notify_system : 0,
        typeof patch.notifyTodo === "boolean" ? Number(patch.notifyTodo) : row.notify_todo,
        typeof patch.notifyAssignment === "boolean" ? Number(patch.notifyAssignment) : row.notify_assignment,
        typeof patch.notifyDataTransfer === "boolean" ? Number(patch.notifyDataTransfer) : row.notify_data_transfer, Date.now());
    recordAuditLog({ userId, action: "config.updated", target: "user_notification_settings", details: JSON.stringify(Object.keys(patch).map(field => ({ field, to: "已更新" }))) });
    db.exec(nested ? "RELEASE telegram_settings" : "COMMIT");
  } catch (error) {
    db.exec(nested ? "ROLLBACK TO telegram_settings; RELEASE telegram_settings" : "ROLLBACK");
    throw error;
  }
}
/** Recheck role for every system delivery, including users demoted after subscribing. */
export function getSystemTelegramRecipients(kind: "backup" | "system"): string[] {
  return (db.prepare(`SELECT n.user_id FROM user_notification_settings n JOIN users u ON u.id = n.user_id
    WHERE n.channel = 'telegram' AND n.enabled = 1 AND n.${kind === "backup" ? "notify_backup" : "notify_system"} = 1 AND u.role = 'admin' AND u.disabled = 0`)
    .all() as { user_id: string }[]).map(row => row.user_id);
}

export type PersonalTelegramKind = "todo" | "assignment" | "dataTransfer";
export function isPersonalTelegramEnabled(userId: string, kind: PersonalTelegramKind): boolean {
  const row = getTelegramSettings(userId);
  const flag = { todo: row.notify_todo, assignment: row.notify_assignment, dataTransfer: row.notify_data_transfer }[kind];
  return Boolean(db.prepare("SELECT 1 FROM users WHERE id = ? AND disabled = 0").get(userId)) && row.enabled === 1 && flag === 1 && Boolean(row.bot_token && row.chat_id);
}
