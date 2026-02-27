import { describe, it, expect } from "vitest";
import { isGenericCapabilityNoise } from "../tools/handlers/memory";

describe("isGenericCapabilityNoise", () => {
  // ── Should reject ─────────────────────────────────────────────

  it("rejects empty content", () => {
    expect(isGenericCapabilityNoise("")).toBe(true);
    expect(isGenericCapabilityNoise("   ")).toBe(true);
  });

  it("rejects generic capability phrases without project signal", () => {
    expect(isGenericCapabilityNoise("I can scan files and search for patterns using ripgrep")).toBe(true);
    expect(isGenericCapabilityNoise("Use rg to find files matching the pattern")).toBe(true);
    expect(isGenericCapabilityNoise("I will read files to understand the codebase")).toBe(true);
  });

  it("rejects shell output dumps", () => {
    const shellOutput = [
      "$ ls -la",
      "total 48",
      "$ cat foo.txt",
      "hello world",
      "$ echo done",
      "done",
      "$ pwd",
    ].join("\n");
    expect(isGenericCapabilityNoise(shellOutput)).toBe(true);
  });

  it("rejects git diff content without insight", () => {
    const diff = `diff --git a/foo.ts b/foo.ts
index abc1234..def5678 100644
--- a/foo.ts
+++ b/foo.ts
@@ -1,3 +1,4 @@
+import bar from "bar";
 const x = 1;`;
    expect(isGenericCapabilityNoise(diff)).toBe(true);
  });

  it("rejects content that is mostly fenced code blocks", () => {
    const codeOnly = "Here:\n```typescript\nconst a = 1;\nconst b = 2;\nconst c = 3;\nconst d = 4;\nconst e = 5;\nconst f = 6;\nconst g = 7;\n```";
    expect(isGenericCapabilityNoise(codeOnly)).toBe(true);
  });

  it("rejects large JSON blobs without project signal", () => {
    const json = JSON.stringify(
      { items: Array.from({ length: 20 }, (_, i) => ({ id: i, value: `item ${i}` })) },
      null,
      2,
    );
    expect(isGenericCapabilityNoise(json)).toBe(true);
  });

  // ── Should accept ─────────────────────────────────────────────

  it("accepts content with project-specific signals", () => {
    expect(isGenericCapabilityNoise("The API endpoint /api/v1/memories uses Drizzle ORM")).toBe(false);
    expect(isGenericCapabilityNoise("Migration adds billing_status column to orgs table")).toBe(false);
  });

  it("accepts git diff with explanatory insight", () => {
    const diffWithInsight = `diff --git a/foo.ts b/foo.ts
The reason for this change is a workaround for the auth bug.`;
    expect(isGenericCapabilityNoise(diffWithInsight)).toBe(false);
  });

  it("accepts code blocks with sufficient explanation", () => {
    const explained =
      "The authentication flow uses better-auth with GitHub OAuth. The middleware validates tokens and checks org membership before processing.\n\n```typescript\nconst session = await auth.api.getSession();\n```";
    expect(isGenericCapabilityNoise(explained)).toBe(false);
  });

  it("accepts generic phrases when project signal is present", () => {
    expect(
      isGenericCapabilityNoise("Scan files in packages/cli/src to find the auth middleware"),
    ).toBe(false);
  });

  it("accepts short meaningful content", () => {
    expect(isGenericCapabilityNoise("Always use pnpm, never npm")).toBe(false);
    expect(isGenericCapabilityNoise("Drizzle ORM requires explicit joins")).toBe(false);
  });
});
