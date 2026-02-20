import { LRUCache } from "lru-cache";
import type { PlanId } from "@memctl/shared/constants";
import { PLANS } from "@memctl/shared/constants";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const cache = new LRUCache<string, RateLimitEntry>({
  max: 10_000,
  ttl: 60_000, // 1 minute
});

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(
  identifier: string,
  planId: PlanId,
): RateLimitResult {
  const limit = PLANS[planId].apiRatePerMinute;

  // Enterprise has Infinity — always allow
  if (!Number.isFinite(limit)) {
    return { allowed: true, limit, remaining: limit, retryAfterSeconds: 0 };
  }

  const now = Date.now();
  const entry = cache.get(identifier);

  if (!entry || now >= entry.resetAt) {
    cache.set(identifier, { count: 1, resetAt: now + 60_000 });
    return { allowed: true, limit, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  entry.count++;

  if (entry.count > limit) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, limit, remaining: 0, retryAfterSeconds };
  }

  return {
    allowed: true,
    limit,
    remaining: limit - entry.count,
    retryAfterSeconds: 0,
  };
}
