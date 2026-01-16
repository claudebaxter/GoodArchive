import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type RateLimitOptions = {
  keyPrefix: string;
  limit: number;
  windowMs: number;
};

const limiters = new Map<string, Ratelimit>();

function limiterKey(o: RateLimitOptions) {
  return `${o.keyPrefix}:${o.limit}:${o.windowMs}`;
}

function getRatelimit(options: RateLimitOptions): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const key = limiterKey(options);
  const existing = limiters.get(key);
  if (existing) return existing;

  const redis = new Redis({ url, token });
  const rl = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(options.limit, `${options.windowMs} ms`),
    prefix: options.keyPrefix,
  });

  limiters.set(key, rl);
  return rl;
}

export async function checkRateLimit(
  ip: string,
  options: RateLimitOptions
): Promise<{ ok: boolean; remaining: number }> {
  const rl = getRatelimit(options);
  if (!rl) return { ok: true, remaining: options.limit };

  const { success, remaining } = await rl.limit(ip);
  return { ok: success, remaining: remaining ?? 0 };
}
