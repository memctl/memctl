import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { validateWebhookUrl, signPayload } from "../lib/webhook-dispatch";

describe("webhook HMAC signing", () => {
  it("generates correct HMAC-SHA256 signature", () => {
    const payload = JSON.stringify({ events: [], timestamp: "2024-01-01" });
    const secret = "test-secret-key";

    const signature = signPayload(payload, secret);

    expect(signature).toMatch(/^[a-f0-9]{64}$/);

    // Verify deterministic
    const signature2 = signPayload(payload, secret);
    expect(signature).toBe(signature2);
  });

  it("different payloads produce different signatures", () => {
    const secret = "test-secret";
    const sig1 = signPayload('{"a":1}', secret);
    const sig2 = signPayload('{"a":2}', secret);
    expect(sig1).not.toBe(sig2);
  });

  it("different secrets produce different signatures", () => {
    const payload = '{"data":true}';
    const sig1 = signPayload(payload, "secret-1");
    const sig2 = signPayload(payload, "secret-2");
    expect(sig1).not.toBe(sig2);
  });

  it("matches raw createHmac output", () => {
    const payload = '{"test":true}';
    const secret = "my-secret";
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    expect(signPayload(payload, secret)).toBe(expected);
  });
});

describe("validateWebhookUrl", () => {
  it("accepts valid HTTPS URLs", () => {
    expect(validateWebhookUrl("https://example.com/webhook")).toEqual({ valid: true });
    expect(validateWebhookUrl("https://hooks.slack.com/services/abc")).toEqual({ valid: true });
    expect(validateWebhookUrl("https://api.mysite.io/hooks/123")).toEqual({ valid: true });
  });

  it("rejects HTTP URLs", () => {
    const result = validateWebhookUrl("http://example.com/webhook");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/HTTPS/i);
  });

  it("rejects invalid URLs", () => {
    const result = validateWebhookUrl("https://");
    expect(result.valid).toBe(false);
  });

  it("rejects bare hostnames without dots", () => {
    const result = validateWebhookUrl("https://intranet/webhook");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/fully qualified/i);
  });

  it("rejects IPv4 addresses", () => {
    const result = validateWebhookUrl("https://192.168.1.1/webhook");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/IP/i);
  });

  it("rejects IPv6 addresses", () => {
    const result = validateWebhookUrl("https://[::1]/webhook");
    expect(result.valid).toBe(false);
    // IPv6 brackets are stripped by URL parser; caught by bare hostname or bracket check
    expect(result.error).toBeDefined();
  });

  it("rejects localhost", () => {
    expect(validateWebhookUrl("https://localhost/webhook").valid).toBe(false);
    expect(validateWebhookUrl("https://sub.localhost/webhook").valid).toBe(false);
  });

  it("rejects private IP ranges", () => {
    expect(validateWebhookUrl("https://127.0.0.1/webhook").valid).toBe(false);
    expect(validateWebhookUrl("https://10.0.0.1/webhook").valid).toBe(false);
    expect(validateWebhookUrl("https://172.16.0.1/webhook").valid).toBe(false);
    expect(validateWebhookUrl("https://192.168.0.1/webhook").valid).toBe(false);
    expect(validateWebhookUrl("https://169.254.1.1/webhook").valid).toBe(false);
    expect(validateWebhookUrl("https://0.0.0.0/webhook").valid).toBe(false);
  });
});
