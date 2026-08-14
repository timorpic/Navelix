/**
 * 轻量级内存级固定窗口限流器（Node runtime 跨请求持久）。
 *
 * 用于登录限流之外的敏感操作加固（如会话注销、备份恢复等）。
 * 注意：基于进程内存，多实例部署时各实例独立计数；对单容器个人部署足够。
 */

interface RateBucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, RateBucket>();

export interface RateLimitResult {
  allowed: boolean;
  /** 距离窗口重置的剩余毫秒数（被限流时 > 0） */
  retryAfterMs: number;
}

/**
 * 简单固定窗口限流。
 * @param key      限流维度（如 `${userId}:session-revoke`）
 * @param limit    窗口内最大允许次数
 * @param windowMs 窗口时长（毫秒）
 */
export function simpleRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (bucket.count < limit) {
    bucket.count++;
    return { allowed: true, retryAfterMs: 0 };
  }

  const retryAfterMs = bucket.windowStart + windowMs - now;
  return { allowed: false, retryAfterMs };
}
