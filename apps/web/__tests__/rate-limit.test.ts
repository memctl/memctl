import { describe, it, expect } from "vitest";
import { rateLimit } from "../lib/rate-limit";

describe("rateLimit", () => {
  it("allows requests within limit", () => {
    const id = `test-user-${Date.now()}-allow`;
    const result = rateLimit(id, 1000); // 1000/min
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(999);
  });

  it("blocks requests exceeding limit", () => {
    const id = `test-user-${Date.now()}-block`;
    // 60/min
    for (let i = 0; i < 60; i++) {
      const r = rateLimit(id, 60);
      expect(r.allowed).toBe(true);
    }
    const blocked = rateLimit(id, 60);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("always allows unlimited rate", () => {
    const id = `test-user-${Date.now()}-enterprise`;
    for (let i = 0; i < 100; i++) {
      const r = rateLimit(id, 999999);
      expect(r.allowed).toBe(true);
    }
  });

  it("tracks remaining count correctly", () => {
    const id = `test-user-${Date.now()}-remaining`;
    const r1 = rateLimit(id, 300); // 300/min
    expect(r1.remaining).toBe(299);
    const r2 = rateLimit(id, 300);
    expect(r2.remaining).toBe(298);
  });

  it("uses separate counters per identifier", () => {
    const id1 = `user-a-${Date.now()}`;
    const id2 = `user-b-${Date.now()}`;

    rateLimit(id1, 60);
    rateLimit(id1, 60);
    const r1 = rateLimit(id1, 60);
    const r2 = rateLimit(id2, 60);

    expect(r1.remaining).toBe(57); // 60 - 3
    expect(r2.remaining).toBe(59); // 60 - 1
  });
});
