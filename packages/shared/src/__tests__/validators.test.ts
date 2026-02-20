import { describe, it, expect } from "vitest";
import {
  slugSchema,
  memoryStoreSchema,
  memoryUpdateSchema,
  memorySearchSchema,
  memoryBulkGetSchema,
  orgCreateSchema,
  projectCreateSchema,
} from "../validators";

describe("slugSchema", () => {
  it("accepts valid slugs", () => {
    expect(slugSchema.safeParse("my-project").success).toBe(true);
    expect(slugSchema.safeParse("test123").success).toBe(true);
    expect(slugSchema.safeParse("a").success).toBe(true);
  });

  it("rejects invalid slugs", () => {
    expect(slugSchema.safeParse("").success).toBe(false);
    expect(slugSchema.safeParse("-starts-with-dash").success).toBe(false);
    expect(slugSchema.safeParse("ends-with-dash-").success).toBe(false);
    expect(slugSchema.safeParse("HAS_CAPS").success).toBe(false);
    expect(slugSchema.safeParse("has spaces").success).toBe(false);
  });
});

describe("memoryStoreSchema", () => {
  it("accepts valid memory data", () => {
    const result = memoryStoreSchema.safeParse({
      key: "test-key",
      content: "test content",
    });
    expect(result.success).toBe(true);
  });

  it("accepts all optional fields", () => {
    const result = memoryStoreSchema.safeParse({
      key: "test",
      content: "content",
      metadata: { type: "config" },
      scope: "shared",
      priority: 50,
      tags: ["tag1", "tag2"],
      expiresAt: 1700000000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty key", () => {
    expect(
      memoryStoreSchema.safeParse({ key: "", content: "c" }).success,
    ).toBe(false);
  });

  it("rejects empty content", () => {
    expect(
      memoryStoreSchema.safeParse({ key: "k", content: "" }).success,
    ).toBe(false);
  });

  it("rejects priority out of range", () => {
    expect(
      memoryStoreSchema.safeParse({ key: "k", content: "c", priority: 101 })
        .success,
    ).toBe(false);
    expect(
      memoryStoreSchema.safeParse({ key: "k", content: "c", priority: -1 })
        .success,
    ).toBe(false);
  });

  it("rejects too many tags", () => {
    const tags = Array.from({ length: 21 }, (_, i) => `tag${i}`);
    expect(
      memoryStoreSchema.safeParse({ key: "k", content: "c", tags }).success,
    ).toBe(false);
  });

  it("rejects invalid scope", () => {
    expect(
      memoryStoreSchema.safeParse({
        key: "k",
        content: "c",
        scope: "invalid",
      }).success,
    ).toBe(false);
  });

  it("defaults scope to project", () => {
    const result = memoryStoreSchema.parse({ key: "k", content: "c" });
    expect(result.scope).toBe("project");
  });
});

describe("memoryUpdateSchema", () => {
  it("accepts partial updates", () => {
    expect(memoryUpdateSchema.safeParse({ content: "new" }).success).toBe(true);
    expect(memoryUpdateSchema.safeParse({ priority: 10 }).success).toBe(true);
    expect(memoryUpdateSchema.safeParse({ tags: ["a"] }).success).toBe(true);
  });

  it("accepts null expiresAt", () => {
    expect(
      memoryUpdateSchema.safeParse({ expiresAt: null }).success,
    ).toBe(true);
  });

  it("accepts empty object", () => {
    expect(memoryUpdateSchema.safeParse({}).success).toBe(true);
  });
});

describe("memorySearchSchema", () => {
  it("accepts valid search", () => {
    expect(
      memorySearchSchema.safeParse({ query: "test", limit: 10 }).success,
    ).toBe(true);
  });

  it("defaults limit to 20", () => {
    const result = memorySearchSchema.parse({ query: "test" });
    expect(result.limit).toBe(20);
  });

  it("rejects empty query", () => {
    expect(memorySearchSchema.safeParse({ query: "" }).success).toBe(false);
  });
});

describe("memoryBulkGetSchema", () => {
  it("accepts valid key arrays", () => {
    expect(
      memoryBulkGetSchema.safeParse({ keys: ["a", "b"] }).success,
    ).toBe(true);
  });

  it("rejects empty array", () => {
    expect(memoryBulkGetSchema.safeParse({ keys: [] }).success).toBe(false);
  });

  it("rejects too many keys", () => {
    const keys = Array.from({ length: 51 }, (_, i) => `key${i}`);
    expect(memoryBulkGetSchema.safeParse({ keys }).success).toBe(false);
  });
});

describe("orgCreateSchema", () => {
  it("accepts valid org data", () => {
    expect(
      orgCreateSchema.safeParse({ name: "My Org", slug: "my-org" }).success,
    ).toBe(true);
  });

  it("rejects missing name", () => {
    expect(orgCreateSchema.safeParse({ slug: "my-org" }).success).toBe(false);
  });
});

describe("projectCreateSchema", () => {
  it("accepts valid project data", () => {
    expect(
      projectCreateSchema.safeParse({ name: "My Project", slug: "my-proj" })
        .success,
    ).toBe(true);
  });

  it("accepts optional description", () => {
    expect(
      projectCreateSchema.safeParse({
        name: "My Project",
        slug: "my-proj",
        description: "A test project",
      }).success,
    ).toBe(true);
  });
});
