import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock modules before importing ApiClient
vi.mock("better-sqlite3", () => {
  return { default: null };
});

vi.mock("../local-cache", () => {
  return {
    LocalCache: class {
      sync() {}
      get() {
        return null;
      }
      search() {
        return [];
      }
      list() {
        return [];
      }
      getByPath() {
        return null;
      }
      isStale() {
        return true;
      }
      queueWrite() {}
      getPendingWrites() {
        return [];
      }
      clearPendingWrites() {}
      getLastSyncAt() {
        return 0;
      }
    },
  };
});

describe("ApiClient freshness tracking", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to 'fresh'", async () => {
    const { ApiClient } = await import("../api-client");
    const client = new ApiClient({
      baseUrl: "http://localhost:3000/api/v1",
      token: "tok",
      org: "org",
      project: "proj",
    });

    expect(client.getLastFreshness()).toBe("fresh");
  });

  it("sets freshness to 'fresh' after a successful API response", async () => {
    const { ApiClient } = await import("../api-client");
    const client = new ApiClient({
      baseUrl: "http://localhost:3000/api/v1",
      token: "tok",
      org: "org",
      project: "proj",
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: () => Promise.resolve({ memory: { key: "k", content: "c" } }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await client.getMemory("k");

    expect(client.getLastFreshness()).toBe("fresh");
  });

  it("sets freshness to 'cached' on a non-stale cache hit", async () => {
    const { ApiClient } = await import("../api-client");
    const client = new ApiClient({
      baseUrl: "http://localhost:3000/api/v1",
      token: "tok",
      org: "org",
      project: "proj",
    });

    const data = { memory: { key: "k", content: "c" } };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ etag: '"v1"' }),
      json: () => Promise.resolve(data),
    });
    vi.stubGlobal("fetch", mockFetch);

    // First call populates the cache
    await client.getMemory("k");
    expect(client.getLastFreshness()).toBe("fresh");

    // Second call should be served from cache (non-stale)
    await client.getMemory("k");
    expect(client.getLastFreshness()).toBe("cached");

    // Only one actual fetch should have occurred
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("sets freshness to 'cached' on a 304 Not Modified response", async () => {
    const { ApiClient } = await import("../api-client");
    const client = new ApiClient({
      baseUrl: "http://localhost:3000/api/v1",
      token: "tok",
      org: "org",
      project: "proj",
    });

    // Replace the in-memory cache with a very short TTL and no stale window
    // so the entry expires quickly and triggers a revalidation fetch
    const cacheModule = await import("../cache");
    (
      client as unknown as {
        cache: InstanceType<typeof cacheModule.MemoryCache>;
      }
    ).cache = new cacheModule.MemoryCache(10, 0); // 10ms TTL, 0ms stale window

    const data = { memory: { key: "k", content: "c" } };

    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ etag: '"v1"' }),
          json: () => Promise.resolve(data),
        });
      }
      // Subsequent calls return 304
      return Promise.resolve({
        ok: false,
        status: 304,
        headers: new Headers({ etag: '"v1"' }),
        json: () => Promise.reject(),
        text: () => Promise.resolve(""),
      });
    });
    vi.stubGlobal("fetch", mockFetch);

    // First call: fresh from API
    await client.getMemory("k");
    expect(client.getLastFreshness()).toBe("fresh");

    // Wait for cache entry to fully expire
    await new Promise((r) => setTimeout(r, 20));

    // Second call: 304 revalidation
    await client.getMemory("k");
    expect(client.getLastFreshness()).toBe("cached");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("getLastFreshness() returns the current freshness value", async () => {
    const { ApiClient } = await import("../api-client");
    const client = new ApiClient({
      baseUrl: "http://localhost:3000/api/v1",
      token: "tok",
      org: "org",
      project: "proj",
    });

    // Initially fresh (the default)
    const initial = client.getLastFreshness();
    expect(initial).toBe("fresh");
    expect(typeof initial).toBe("string");

    // After a fetch, still returns the right value
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ etag: '"e1"' }),
      json: () => Promise.resolve({ memories: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await client.listMemories();
    expect(client.getLastFreshness()).toBe("fresh");

    // Trigger a cache hit
    await client.listMemories();
    expect(client.getLastFreshness()).toBe("cached");
  });
});

describe("textResponse freshness injection", () => {
  it("returns plain text when no freshness is provided", async () => {
    const { textResponse } = await import("../tools/response");

    const result = textResponse("Hello, world!");
    expect(result).toEqual({
      content: [{ type: "text", text: "Hello, world!" }],
    });
  });

  it("injects _meta.freshness into JSON object text", async () => {
    const { textResponse } = await import("../tools/response");

    const jsonText = JSON.stringify({ key: "test", content: "data" });
    const result = textResponse(jsonText, "fresh");

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed._meta).toBeDefined();
    expect(parsed._meta.freshness).toBe("fresh");
    expect(parsed.key).toBe("test");
    expect(parsed.content).toBe("data");
  });

  it("appends freshness suffix for non-JSON text", async () => {
    const { textResponse } = await import("../tools/response");

    const result = textResponse("Some plain text", "cached");
    expect(result.content[0].text).toBe("Some plain text\n[freshness: cached]");
  });

  it("wraps a JSON array with _meta by spreading into an object", async () => {
    const { textResponse } = await import("../tools/response");

    const arrayText = JSON.stringify([{ id: 1 }, { id: 2 }]);
    const result = textResponse(arrayText, "stale");

    // Arrays are objects so the spread produces { "0": {id:1}, "1": {id:2}, _meta: {freshness:"stale"} }
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed._meta).toBeDefined();
    expect(parsed._meta.freshness).toBe("stale");
    // The original array entries are spread as indexed keys
    expect(parsed["0"]).toEqual({ id: 1 });
    expect(parsed["1"]).toEqual({ id: 2 });
  });
});
