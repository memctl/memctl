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
  isFull: boolean;
  isApproaching: boolean;
}) {
  if (capacity.isFull) {
    return `Project memory limit reached (${capacity.used}/${toFiniteLimitText(capacity.limit)}). Delete or archive unused memories before storing new ones.`;
  }
  if (capacity.isApproaching) {
    return `Approaching project limit (${capacity.used}/${toFiniteLimitText(capacity.limit)}). Consider archiving old memories.`;
  }
  return `Memory available. Project: ${capacity.used}/${toFiniteLimitText(capacity.limit)}.`;
}

export function matchGlob(filepath: string, pattern: string): boolean {
  const regex = pattern
    .replace(/\*\*/g, "{{GLOBSTAR}}")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]")
    .replace(/{{GLOBSTAR}}/g, ".*");
  return new RegExp(`^${regex}$`).test(filepath);
}
