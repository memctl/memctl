import { describe, it, expect, vi } from "vitest";
import { createHmac } from "node:crypto";

describe("webhook HMAC signing", () => {
  it("generates correct HMAC-SHA256 signature", () => {
    const payload = JSON.stringify({ events: [], timestamp: "2024-01-01" });
    const secret = "test-secret-key";

    const signature = createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    expect(signature).toMatch(/^[a-f0-9]{64}$/);

    // Verify deterministic
    const signature2 = createHmac("sha256", secret)
      .update(payload)
      .digest("hex");
    expect(signature).toBe(signature2);
  });

  it("different payloads produce different signatures", () => {
    const secret = "test-secret";
    const sig1 = createHmac("sha256", secret)
      .update('{"a":1}')
      .digest("hex");
    const sig2 = createHmac("sha256", secret)
      .update('{"a":2}')
      .digest("hex");
    expect(sig1).not.toBe(sig2);
  });

  it("different secrets produce different signatures", () => {
    const payload = '{"data":true}';
    const sig1 = createHmac("sha256", "secret-1")
      .update(payload)
      .digest("hex");
    const sig2 = createHmac("sha256", "secret-2")
      .update(payload)
      .digest("hex");
    expect(sig1).not.toBe(sig2);
  });
});
