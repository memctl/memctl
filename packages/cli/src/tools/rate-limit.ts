export interface RateLimitState {
  RATE_LIMIT: number;
  writeCallCount: number;
  checkRateLimit(): { allowed: boolean; warning?: string };
  incrementWriteCount(): void;
  getSessionWriteWarning(): string | null;
}

export function createRateLimitState(): RateLimitState {
  const RATE_LIMIT = Number(process.env.MEMCTL_RATE_LIMIT) || 500;
  let writeCallCount = 0;

  return {
    get RATE_LIMIT() {
      return RATE_LIMIT;
    },
    get writeCallCount() {
      return writeCallCount;
    },
    set writeCallCount(v: number) {
      writeCallCount = v;
    },
    checkRateLimit(): { allowed: boolean; warning?: string } {
      const pct = writeCallCount / RATE_LIMIT;
      if (pct >= 1) {
        return {
          allowed: false,
          warning: `Rate limit reached (${writeCallCount}/${RATE_LIMIT}). No more write operations allowed this session.`,
        };
      }
      if (pct >= 0.8) {
        return {
          allowed: true,
          warning: `Approaching rate limit: ${writeCallCount}/${RATE_LIMIT} write calls used (${Math.round(pct * 100)}%).`,
        };
      }
      return { allowed: true };
    },
    incrementWriteCount() {
      writeCallCount++;
    },
    getSessionWriteWarning(): string | null {
      if (writeCallCount >= 15) {
        return ` Note: ${writeCallCount} writes this session. Consider consolidating related memories or using batch operations to reduce write volume.`;
      }
      return null;
    },
  };
}
