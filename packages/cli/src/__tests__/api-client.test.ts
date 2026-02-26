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
    },
  };
});

describe("ApiClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends correct headers", async () => {
    const { ApiClient } = await import("../api-client");
    const client = new ApiClient({
      baseUrl: "http://localhost:3000/api/v1",
      token: "test-token",
      org: "test-org",
      project: "test-project",
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: () => Promise.resolve({ memories: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await client.listMemories();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers.Authorization).toBe("Bearer test-token");
    expect(opts.headers["X-Org-Slug"]).toBe("test-org");
    expect(opts.headers["X-Project-Slug"]).toBe("test-project");
  });

  it("caches GET responses", async () => {
    const { ApiClient } = await import("../api-client");
    const client = new ApiClient({
      baseUrl: "http://localhost:3000/api/v1",
      token: "test-token",
      org: "test-org",
      project: "test-project",
    });

    const data = { memory: { key: "k", content: "c" } };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ etag: '"abc"' }),
      json: () => Promise.resolve(data),
    });
    vi.stubGlobal("fetch", mockFetch);

    await client.getMemory("test-key");
    await client.getMemory("test-key");

    // Second call should use cache — only one fetch
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("invalidates cache on POST", async () => {
    const { ApiClient } = await import("../api-client");
    const client = new ApiClient({
      baseUrl: "http://localhost:3000/api/v1",
      token: "test-token",
      org: "test-org",
      project: "test-project",
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: () => Promise.resolve({ memory: {} }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await client.getMemory("test-key");
    await client.storeMemory("test-key", "new content");
    await client.getMemory("test-key");

    // Should fetch 3 times: initial GET, POST, and re-fetch after invalidation
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("handles 304 responses with ETag revalidation", async () => {
    const { ApiClient } = await import("../api-client");
    // Use very short TTL so cache expires fast
    const client = new ApiClient({
      baseUrl: "http://localhost:3000/api/v1",
      token: "test-token",
      org: "test-org",
      project: "test-project",
    });

    // Override the cache with a very short TTL and no stale window
    const cacheModule = await import("../cache");
    (
      client as unknown as {
        cache: InstanceType<typeof cacheModule.MemoryCache>;
      }
    ).cache = new cacheModule.MemoryCache(10, 0); // 10ms TTL, 0ms stale

    const data = { memory: { key: "k" } };

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
      // Second call returns 304
      return Promise.resolve({
        ok: false,
        status: 304,
        headers: new Headers({ etag: '"v1"' }),
        json: () => Promise.reject(),
        text: () => Promise.resolve(""),
      });
    });
    vi.stubGlobal("fetch", mockFetch);

    const result1 = await client.getMemory("k");
    expect(result1).toEqual(data);

    // Wait for cache to expire naturally (ETag remains)
    await new Promise((r) => setTimeout(r, 20));

    const result2 = await client.getMemory("k");
    expect(result2).toEqual(data);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    // Verify If-None-Match was sent on second request
    expect(mockFetch.mock.calls[1][1].headers["If-None-Match"]).toBe('"v1"');
  });

  it("reports connection status", async () => {
    const { ApiClient } = await import("../api-client");
    const client = new ApiClient({
      baseUrl: "http://localhost:3000/api/v1",
      token: "test-token",
      org: "test-org",
      project: "test-project",
    });

    expect(client.getConnectionStatus()).toEqual({ online: true });
  });

  it("returns markdown export responses as text", async () => {
    const { ApiClient } = await import("../api-client");
    const client = new ApiClient({
      baseUrl: "http://localhost:3000/api/v1",
      token: "test-token",
      org: "test-org",
      project: "test-project",
    });

    const markdown = "# AGENTS.md\n\n## Rules\n\n- Keep responses short.";
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/markdown; charset=utf-8" }),
      text: () => Promise.resolve(markdown),
      json: () => Promise.reject(new Error("json() should not be called")),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await client.exportMemories("agents_md");
    expect(result).toBe(markdown);
  });

  it("returns cursorrules export responses as text", async () => {
    const { ApiClient } = await import("../api-client");
    const client = new ApiClient({
      baseUrl: "http://localhost:3000/api/v1",
      token: "test-token",
      org: "test-org",
      project: "test-project",
    });

    const rules = "# Rules\n\nNo force pushes.";
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/plain; charset=utf-8" }),
      text: () => Promise.resolve(rules),
      json: () => Promise.reject(new Error("json() should not be called")),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await client.exportMemories("cursorrules");
    expect(result).toBe(rules);
  });

  it("returns json export responses as objects", async () => {
    const { ApiClient } = await import("../api-client");
    const client = new ApiClient({
      baseUrl: "http://localhost:3000/api/v1",
      token: "test-token",
      org: "test-org",
      project: "test-project",
    });

    const payload = { types: { architecture: [] } };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json; charset=utf-8" }),
      json: () => Promise.resolve(payload),
      text: () => Promise.resolve(""),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await client.exportMemories("json");
    expect(result).toEqual(payload);
  });

  it("falls back to text when json parsing fails on success response", async () => {
    const { ApiClient } = await import("../api-client");
    const client = new ApiClient({
      baseUrl: "http://localhost:3000/api/v1",
      token: "test-token",
      org: "test-org",
      project: "test-project",
    });

    const markdown = "# AGENTS.md\n\n## Rules";
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: () =>
        Promise.reject(new SyntaxError("Unexpected token '#' in JSON at position 0")),
      clone: () => ({
        text: () => Promise.resolve(markdown),
      }),
      text: () => Promise.resolve(markdown),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await client.exportMemories("agents_md");
    expect(result).toBe(markdown);
  });
});
