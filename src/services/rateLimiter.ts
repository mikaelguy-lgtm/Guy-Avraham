import type { NextFunction, Request, Response } from "express";
import { Redis } from "ioredis";

export interface RateLimitStore {
  increment(key: string, windowSeconds: number): Promise<number>;
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
}

export function rateLimit(store: RateLimitStore, name: string, limit: number, windowSeconds: number) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = request.user?.id ? `user:${request.user.id}` : `ip:${request.ip}`;
      const count = await store.increment(`rate:${name}:${actor}`, windowSeconds);
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
