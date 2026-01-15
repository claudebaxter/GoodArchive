type Bucket = {
  timestamps: number[];
};

const store: Map<string, Bucket> = new Map();

export type RateLimitOptions = {
  keyPrefix: string;
  limit: number;
  windowMs: number;
};

export function checkRateLimit(ip: string, options: RateLimitOptions): { ok: boolean; remaining: number } {
  const now = Date.now();
  const key = `${options.keyPrefix}:${ip}`;
  let bucket = store.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    store.set(key, bucket);
  }
  // prune
  const cutoff = now - options.windowMs;
  bucket.timestamps = bucket.timestamps.filter((ts) => ts > cutoff);
  if (bucket.timestamps.length >= options.limit) {
    return { ok: false, remaining: 0 };
  }
  bucket.timestamps.push(now);
  return { ok: true, remaining: Math.max(0, options.limit - bucket.timestamps.length) };
}

