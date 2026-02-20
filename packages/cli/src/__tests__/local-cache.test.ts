import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { LocalCache } from "../local-cache";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Override HOME for test isolation
const TEST_HOME = join(tmpdir(), `.memctl-test-${process.pid}-${Date.now()}`);
process.env.HOME = TEST_HOME;

// Each test uses a unique project slug for isolation
let testId = 0;
function createCache(): LocalCache {
  testId++;
  return new LocalCache("test-org", `test-project-${testId}`);
}

afterAll(() => {
  try {
    rmSync(join(TEST_HOME, ".memctl"), { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});

describe("LocalCache", () => {
  it("returns null for missing keys", () => {
    const cache = createCache();
    expect(cache.get("nonexistent")).toBeNull();
  });

  it("syncs and retrieves memories", () => {
    const cache = createCache();
    cache.sync([
      {
        key: "test-key",
        content: "test content",
        metadata: null,
        tags: '["tag1"]',
        priority: 5,
        updatedAt: Date.now(),
      },
    ]);

    const result = cache.get("test-key");
    expect(result).not.toBeNull();
    expect(result!.content).toBe("test content");
    expect(result!.priority).toBe(5);
  });

  it("searches by key and content", () => {
    const cache = createCache();
    cache.sync([
      { key: "auth-setup", content: "authentication configuration", priority: 0, updatedAt: Date.now() },
      { key: "db-config", content: "database settings", priority: 0, updatedAt: Date.now() },
    ]);

    const results = cache.search("auth");
    expect(results.length).toBe(1);
    expect(results[0].key).toBe("auth-setup");
  });

  it("lists all memories", () => {
    const cache = createCache();
    cache.sync([
      { key: "key1", content: "content1", priority: 0, updatedAt: Date.now() },
      { key: "key2", content: "content2", priority: 0, updatedAt: Date.now() },
    ]);

    const results = cache.list();
    expect(results.length).toBe(2);
  });

  it("getByPath returns memory for key path", () => {
    const cache = createCache();
    cache.sync([
      { key: "my-key", content: "my content", priority: 0, updatedAt: Date.now() },
    ]);

    const result = cache.getByPath("/memories/my-key") as { memory: Record<string, unknown> } | null;
    expect(result).not.toBeNull();
    expect(result!.memory.key).toBe("my-key");
  });

  it("getByPath returns list for search path", () => {
    const cache = createCache();
    cache.sync([
      { key: "auth", content: "auth content", priority: 0, updatedAt: Date.now() },
    ]);

    const result = cache.getByPath("/memories?q=auth") as { memories: unknown[] } | null;
    expect(result).not.toBeNull();
    expect(result!.memories.length).toBe(1);
  });

  it("reports stale when no sync has happened", () => {
    const cache = createCache();
    expect(cache.isStale()).toBe(true);
  });

  it("reports not stale immediately after sync", () => {
    const cache = createCache();
    cache.sync([
      { key: "k", content: "c", priority: 0, updatedAt: Date.now() },
    ]);
    expect(cache.isStale()).toBe(false);
  });

  it("queues and retrieves pending writes", () => {
    const cache = createCache();
    cache.queueWrite({ method: "POST", path: "/memories", body: { key: "k" } });

    const pending = cache.getPendingWrites();
    expect(pending.length).toBe(1);
    expect(pending[0].method).toBe("POST");

    cache.clearPendingWrites();
    expect(cache.getPendingWrites().length).toBe(0);
  });
});
