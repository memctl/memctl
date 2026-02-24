export type Freshness = "fresh" | "cached" | "stale" | "offline";

export function textResponse(text: string, freshness?: Freshness) {
  if (freshness) {
    // If the text is JSON, inject _meta
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed === "object" && parsed !== null) {
        const withMeta = { ...parsed, _meta: { freshness } };
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(withMeta, null, 2) },
          ],
        };
      }
    } catch {
      // Not JSON, append as suffix
    }
    return {
      content: [
        { type: "text" as const, text: `${text}\n[freshness: ${freshness}]` },
      ],
    };
  }
  return { content: [{ type: "text" as const, text }] };
}

export function errorResponse(prefix: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: `${prefix}: ${message}` }],
    isError: true,
  };
}

export function hasMemoryFullError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /memory limit reached/i.test(message);
}

export function toFiniteLimitText(limit: number) {
  return Number.isFinite(limit) ? String(limit) : "unlimited";
}

export function formatCapacityGuidance(capacity: {
  used: number;
  limit: number;
  orgUsed: number;
  orgLimit: number;
  isFull: boolean;
  isSoftFull: boolean;
  isApproaching: boolean;
}) {
  if (capacity.isFull) {
    return `Organization memory limit reached (${capacity.orgUsed}/${toFiniteLimitText(capacity.orgLimit)}). Delete or archive unused memories before storing new ones.`;
  }
  if (capacity.isSoftFull) {
    return `Project soft limit reached (${capacity.used}/${toFiniteLimitText(capacity.limit)}). Consider archiving old memories. Org: ${capacity.orgUsed}/${toFiniteLimitText(capacity.orgLimit)}.`;
  }
  if (capacity.isApproaching) {
    return `Approaching project limit (${capacity.used}/${toFiniteLimitText(capacity.limit)}). Org: ${capacity.orgUsed}/${toFiniteLimitText(capacity.orgLimit)}.`;
  }
  return `Memory available. Project: ${capacity.used}/${toFiniteLimitText(capacity.limit)}, Org: ${capacity.orgUsed}/${toFiniteLimitText(capacity.orgLimit)}.`;
}

export function matchGlob(filepath: string, pattern: string): boolean {
  const regex = pattern
    .replace(/\*\*/g, "{{GLOBSTAR}}")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]")
    .replace(/{{GLOBSTAR}}/g, ".*");
  return new RegExp(`^${regex}$`).test(filepath);
}
