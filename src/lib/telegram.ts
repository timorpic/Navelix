import { writeLog } from "./logging/events.ts";
import { normalizeLocale, type Locale } from "./i18n.ts";
import { translateText } from "./server-translations.ts";
import { getUserConfigRow } from "./global-config.ts";
import { safeFetch } from "./ssrf.ts";
import { db } from "./db.ts";
import { decryptSecret } from "./secret.ts";
import { getTelegramSettings, getSystemTelegramRecipients, isPersonalTelegramEnabled, type PersonalTelegramKind } from "./user-notifications.ts";

/**
 * 向 Telegram Bot 发送一条文本消息。
 * - 未配置 Bot Token / Chat ID / 总开关时静默跳过（不抛错，不影响主流程）
 * - 通过 safeFetch 走服务端请求，避免 SSRF
 * @param text 要发送的消息正文
 * @returns 是否真正发出（true=已发送成功；false=未配置或发送失败）
 */
export async function sendTelegramMessage(userId: string, text: string): Promise<boolean> {
  try {
    if (!db.prepare("SELECT 1 FROM users WHERE id = ? AND disabled = 0").get(userId)) return false;
    const settings = getTelegramSettings(userId);
    if (!settings.enabled) return false;
    const token = decryptSecret(settings.bot_token);
    const chatId = settings.chat_id;
    if (!token || !chatId) return false;

    const res = await safeFetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: translateText(getUserConfigRow(userId)?.language, text),
          disable_web_page_preview: true,
        }),
        timeoutMs: 10_000,
        allowPrivateIPs: false,
      },
    );

    if (!res.ok) {
      // 静默记录，不影响业务
      writeLog({ category: "notification", event: "telegram.send.failed", level: "warn", outcome: "failed", details: { status: res.status }, subjectId: userId });
      return false;
    }
    writeLog({ category: "notification", event: "telegram.send.succeeded", subjectId: userId });
    return true;
  } catch {
    writeLog({ category: "notification", event: "telegram.send.exception", level: "warn", outcome: "failed", subjectId: userId });
    return false;
  }
}

/** Send system events only to explicitly subscribed, currently authorized administrators. */
export async function sendTelegramNotification(text: string | ((locale: Locale) => string), kind: "backup" | "system"): Promise<boolean> {
  let sent = false;
  for (const userId of getSystemTelegramRecipients(kind)) {
    if (!db.prepare("SELECT 1 FROM users WHERE id = ? AND role = 'admin' AND disabled = 0").get(userId)) continue;
    sent = await sendTelegramMessage(userId, typeof text === "function" ? text(normalizeLocale(getUserConfigRow(userId)?.language)) : text) || sent;
  }
  return sent;
}

/** Personal events are always addressed to an explicit related user, never system recipients. */
export async function sendUserTelegramNotification(userId: string, text: string, kind: PersonalTelegramKind): Promise<boolean> {
  try {
    if (!isPersonalTelegramEnabled(userId, kind)) return false;
    return await sendTelegramMessage(userId, text);
  } catch {
    return false;
  }
}
