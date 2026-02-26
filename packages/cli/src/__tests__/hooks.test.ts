import { describe, it, expect } from "vitest";
import { extractHookCandidates } from "../hooks";

describe("hook candidate extraction", () => {
  it("extracts high-signal project memories", () => {
    const candidates = extractHookCandidates({
      userMessage:
        "Do not call Stripe in self-hosted mode, only run billing checks when NEXT_PUBLIC_SELF_HOSTED is false.",
      assistantMessage:
        "We fixed the OAuth callback bug in apps/web/app/api/auth/callback/route.ts by validating state before token exchange.",
    });

    expect(candidates.length).toBeGreaterThan(0);
    expect(
      candidates.some((c) => c.type === "constraints"),
    ).toBe(true);
    expect(
      candidates.some((c) => c.type === "lessons_learned"),
    ).toBe(true);
  });

  it("skips generic capability noise", () => {
    const candidates = extractHookCandidates({
      assistantMessage: "Use rg to search for patterns in files.",
    });
    expect(candidates).toHaveLength(0);
  });

  it("caps extracted candidate count", () => {
    const assistantMessage = [
      "We decided to keep API auth middleware in apps/web/lib/api-middleware.ts to enforce org access.",
      "We fixed a bug in packages/cli/src/api-client.ts when parsing markdown export responses.",
      "Do not store Stripe keys in memory entries.",
      "We refactored session handling to auto-generate session IDs when missing.",
      "Use lifecycle_run cleanup_expired and cleanup_session_logs weekly.",
      "We selected cursor pagination to avoid offset drift in activity feed.",
      "Regression found in route.ts, fixed by validating org slug before query.",
    ].join(" ");
    const candidates = extractHookCandidates({ assistantMessage });
    expect(candidates.length).toBeLessThanOrEqual(5);
  });
});
