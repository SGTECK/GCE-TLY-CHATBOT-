const WINDOW_MS = 60_000;
const buckets = new Map<string, { count: number; windowStart: number }>();
const LIMIT = Number(process.env.RATE_LIMIT_PER_MINUTE ?? 20);

export function checkRateLimit(key: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: LIMIT - 1 };
  }

  if (bucket.count >= LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  bucket.count += 1;
  return { allowed: true, remaining: LIMIT - bucket.count };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (now - bucket.windowStart > WINDOW_MS * 5) buckets.delete(key);
  }
}, WINDOW_MS * 5).unref?.();
