import type { NextFunction, Request, Response } from "express";
import { Redis } from "ioredis";

export interface RateLimitStore {
  increment(key: string, windowSeconds: number): Promise<number>;
  ping(): Promise<boolean>;
}

export class RedisRateLimitStore implements RateLimitStore {
  private readonly redis: Redis;
  constructor(url: string) { this.redis = new Redis(url, {lazyConnect: true, maxRetriesPerRequest: 1}); }

  async increment(key: string, windowSeconds: number): Promise<number> {
    if (this.redis.status === "wait") await this.redis.connect();
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, windowSeconds);
    return count;
  }

  // Live connectivity check for the System Health screen only — never
  // exposes the connection string/host, just whether the ping succeeded.
  async ping(): Promise<boolean> {
    try {
      if (this.redis.status === "wait") await this.redis.connect();
      return (await this.redis.ping()) === "PONG";
    } catch { return false; }
  }
}

// גיבוי בזיכרון כש-Redis לא זמין: המגבלות ממשיכות לחול (לכל תהליך), במקום שכל route
// עם rate limit — כולל /api/auth/activity וכל מסלולי גופי המימון — יחזיר 500.
const fallbackCounters = new Map<string, {count: number; resetAt: number}>();
let lastFallbackLogAt = 0;
function incrementInMemory(key: string, windowSeconds: number): number {
  const now = Date.now();
  if (fallbackCounters.size > 50_000) for (const [entryKey, entry] of fallbackCounters) if (entry.resetAt <= now) fallbackCounters.delete(entryKey);
  const current = fallbackCounters.get(key);
  if (!current || current.resetAt <= now) { fallbackCounters.set(key, {count: 1, resetAt: now + windowSeconds * 1000}); return 1; }
  current.count += 1;
  return current.count;
}

export function rateLimit(store: RateLimitStore, name: string, limit: number, windowSeconds: number) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = request.user?.id ? `user:${request.user.id}` : `ip:${request.ip}`;
      const key = `rate:${name}:${actor}`;
      const count = await store.increment(key, windowSeconds).catch(() => {
        if (Date.now() - lastFallbackLogAt > 60_000) { lastFallbackLogAt = Date.now(); console.error("Rate limiter store unavailable, using in-memory fallback", {errorCode: "RATE_LIMIT_STORE_UNAVAILABLE"}); }
        return incrementInMemory(key, windowSeconds);
      });
      if (count > limit) {
        response.setHeader("retry-after", String(windowSeconds));
        response.status(429).json({
          error: "RATE_LIMITED",
          message: `בוצעו יותר מדי ניסיונות. ניתן לנסות שוב בעוד ${windowSeconds} שניות.`,
          retryAfterSeconds: windowSeconds,
          requestId: request.requestId
        });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
