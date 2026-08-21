import { safeFetch } from "./ssrf.ts";
import {
  getTelegramBotToken,
  getTelegramChatId,
  isTelegramEnabled,
} from "./system-settings.ts";

/**
 * 向 Telegram Bot 发送一条文本消息。
 * - 未配置 Bot Token / Chat ID / 总开关时静默跳过（不抛错，不影响主流程）
 * - 通过 safeFetch 走服务端请求，避免 SSRF
 * @param text 要发送的消息正文
 * @returns 是否真正发出（true=已发送成功；false=未配置或发送失败）
 */
export async function sendTelegramMessage(text: string): Promise<boolean> {
  try {
    if (!isTelegramEnabled()) return false;
    const token = getTelegramBotToken();
    const chatId = getTelegramChatId();
    if (!token || !chatId) return false;

    const res = await safeFetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
        }),
        timeoutMs: 10_000,
        allowPrivateIPs: false,
      },
    );

    if (!res.ok) {
      // 静默记录，不影响业务
      const bodyText = await res.text().catch(() => "");
      console.warn(
        `[Telegram] 发送失败 (HTTP ${res.status}): ${bodyText.slice(0, 200)}`,
      );
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[Telegram] 发送异常:", err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * 发送一条通知类消息，仅在对应场景开关开启时触发。
 * @param text 消息正文
 * @param notifyEnabled 该场景是否开启（由调用方传入对应开关）
 */
export async function sendTelegramNotification(
  text: string,
  notifyEnabled: boolean,
): Promise<boolean> {
  if (!notifyEnabled) return false;
  return sendTelegramMessage(text);
}
