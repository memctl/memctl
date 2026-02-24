import { describe, it, expect } from "vitest";
import { generateETag, checkConditional } from "../lib/etag";

describe("generateETag", () => {
  it("generates a quoted MD5 hash", () => {
    const etag = generateETag('{"hello":"world"}');
    expect(etag).toMatch(/^"[a-f0-9]{32}"$/);
  });

  it("generates consistent ETags for same input", () => {
    const body = '{"memories":[]}';
    expect(generateETag(body)).toBe(generateETag(body));
  });

  it("generates different ETags for different input", () => {
    expect(generateETag("abc")).not.toBe(generateETag("def"));
  });
});

describe("checkConditional", () => {
  it("returns false when no If-None-Match header", () => {
    const req = new Request("http://localhost/test", {
      headers: {},
    });
    expect(
      checkConditional(
        req as unknown as import("next/server").NextRequest,
        '"abc"',
      ),
    ).toBe(false);
  });

  it("returns true when If-None-Match matches ETag", () => {
    const req = new Request("http://localhost/test", {
      headers: { "if-none-match": '"abc"' },
    });
    expect(
      checkConditional(
        req as unknown as import("next/server").NextRequest,
        '"abc"',
      ),
    ).toBe(true);
  });

  it("returns true when If-None-Match is weak match", () => {
    const req = new Request("http://localhost/test", {
      headers: { "if-none-match": 'W/"abc"' },
    });
    expect(
      checkConditional(
        req as unknown as import("next/server").NextRequest,
        '"abc"',
      ),
    ).toBe(true);
  });

  it("returns false when If-None-Match does not match", () => {
    const req = new Request("http://localhost/test", {
      headers: { "if-none-match": '"xyz"' },
    });
    expect(
      checkConditional(
        req as unknown as import("next/server").NextRequest,
        '"abc"',
      ),
    ).toBe(false);
  });
});
