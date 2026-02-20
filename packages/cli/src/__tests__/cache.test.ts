import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryCache } from "../cache";

describe("MemoryCache", () => {
  let cache: MemoryCache;

  beforeEach(() => {
    cache = new MemoryCache(100); // 100ms TTL for fast tests
  });

  it("returns null for missing keys", () => {
    expect(cache.get("nonexistent")).toBeNull();
  });

  it("stores and retrieves values", () => {
    cache.set("key1", { hello: "world" });
    const result = cache.get("key1");
    expect(result).not.toBeNull();
    expect(result!.data).toEqual({ hello: "world" });
  });

  it("stores and retrieves ETags", () => {
    cache.set("key1", { data: 1 }, '"abc123"');
    const result = cache.get("key1");
    expect(result!.etag).toBe('"abc123"');
  });

  it("returns null for expired entries", async () => {
    cache.set("key1", { data: 1 }, undefined, 10); // 10ms TTL
    await new Promise((r) => setTimeout(r, 20));
    expect(cache.get("key1")).toBeNull();
  });

  it("still returns ETag for expired entries via getEtag", async () => {
    cache.set("key1", { data: 1 }, '"etag-val"', 10);
    await new Promise((r) => setTimeout(r, 20));
    expect(cache.get("key1")).toBeNull();
    expect(cache.getEtag("key1")).toBe('"etag-val"');
  });

  it("touch refreshes expiry", async () => {
    cache.set("key1", { data: 1 }, undefined, 50);
    await new Promise((r) => setTimeout(r, 30));
    cache.touch("key1", 100);
    await new Promise((r) => setTimeout(r, 30));
    expect(cache.get("key1")).not.toBeNull();
  });

  it("invalidates a specific key", () => {
    cache.set("key1", 1);
    cache.set("key2", 2);
    cache.invalidate("key1");
    expect(cache.get("key1")).toBeNull();
    expect(cache.get("key2")).not.toBeNull();
  });

  it("invalidates by prefix", () => {
    cache.set("GET:/memories?q=test", 1);
    cache.set("GET:/memories/foo", 2);
    cache.set("GET:/activity-logs", 3);
    cache.invalidatePrefix("GET:/memories");
    expect(cache.get("GET:/memories?q=test")).toBeNull();
    expect(cache.get("GET:/memories/foo")).toBeNull();
    expect(cache.get("GET:/activity-logs")).not.toBeNull();
  });

  it("clears all entries", () => {
    cache.set("key1", 1);
    cache.set("key2", 2);
    cache.clear();
    expect(cache.get("key1")).toBeNull();
    expect(cache.get("key2")).toBeNull();
  });
});
