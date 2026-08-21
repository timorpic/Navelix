// 登录限流：内存级固定窗口，5 次失败锁定 15 分钟。
// 与通用 rate-limit.ts 不同，本模块针对登录场景需要返回剩余次数和锁定时长。
// 注意：基于进程内存，多实例部署时各实例独立计数；对单容器个人部署足够。

const LOGIN_THRESHOLD = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginAttempts = new Map<string, { count: number; firstFailure: number }>();
let lastLoginPruneAt = Date.now();
const LOGIN_PRUNE_INTERVAL_MS = 10 * 60 * 1000;

function pruneExpiredLoginAttempts(now: number) {
  if (now - lastLoginPruneAt < LOGIN_PRUNE_INTERVAL_MS) return;
  lastLoginPruneAt = now;
  for (const [key, entry] of loginAttempts) {
    if (now - entry.firstFailure > LOGIN_WINDOW_MS) {
      loginAttempts.delete(key);
    }
  }
}

export interface LoginRateLimitStatus {
  allowed: boolean;
  /** 剩余允许尝试次数（未锁定时使用） */
  remaining: number;
  /** 剩余锁定毫秒数（被锁定时使用，未锁定为 0） */
  lockRemainingMs: number;
}

export function checkLoginRateLimit(clientId: string): LoginRateLimitStatus {
  const now = Date.now();
  pruneExpiredLoginAttempts(now);
  const entry = loginAttempts.get(clientId);
  if (!entry) {
    return { allowed: true, remaining: LOGIN_THRESHOLD, lockRemainingMs: 0 };
  }
  if (now - entry.firstFailure > LOGIN_WINDOW_MS) {
    loginAttempts.delete(clientId);
    return { allowed: true, remaining: LOGIN_THRESHOLD, lockRemainingMs: 0 };
  }
  const remaining = Math.max(0, LOGIN_THRESHOLD - entry.count);
  // 实际剩余锁定时间：从首次失败时刻开始计算，窗口结束前均为锁定状态
  const lockRemainingMs = Math.max(
    0,
    entry.firstFailure + LOGIN_WINDOW_MS - now,
  );
  return { allowed: entry.count < LOGIN_THRESHOLD, remaining, lockRemainingMs };
}

export function recordLoginFailure(clientId: string): void {
  const now = Date.now();
  pruneExpiredLoginAttempts(now);
  const entry = loginAttempts.get(clientId);
  if (!entry || now - entry.firstFailure > LOGIN_WINDOW_MS) {
    loginAttempts.set(clientId, { count: 1, firstFailure: now });
  } else {
    entry.count++;
  }
}

export function resetLoginRateLimit(clientId: string): void {
  loginAttempts.delete(clientId);
}
