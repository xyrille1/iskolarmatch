import "server-only";

// Lightweight in-memory token-bucket rate limiter, per docs/SECURITY.md
// SR-R2 ("in-memory or Upstash free, keyed by IP"). Deliberately simple for MVP:
// resets on cold start / per-instance in a serverless deployment, which is an
// acceptable gap at this scale -- documented, not silently assumed away.
const buckets = new Map<string, { count: number; windowStart: number }>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: limit - 1 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count };
}
