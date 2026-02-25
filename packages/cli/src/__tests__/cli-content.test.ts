import { describe, it, expect } from "vitest";
import { cliInternals } from "../cli";

describe("cli content normalization", () => {
  it("uses default template for empty agents_md content", () => {
    const result = cliInternals.normalizeExportContent("", "agents_md");
    expect(result).toContain("## memctl MCP Rules");
  });

  it("uses default template for scaffold-only agents_md content", () => {
    const scaffold =
      "# AGENTS.md\n\n> Auto-generated from memctl structured agent context\n";
    const result = cliInternals.normalizeExportContent(scaffold, "agents_md");
    expect(result).toContain("## Session Start");
    expect(result).not.toContain("context.bootstrap");
    expect(result).not.toContain("session.start");
  });

  it("keeps populated agents_md content unchanged", () => {
    const content = "# AGENTS.md\n\n## Architecture\n\n- API first\n";
    const result = cliInternals.normalizeExportContent(content, "agents_md");
    expect(result).toBe(content);
  });

  it("does not apply fallback to cursorrules", () => {
    const result = cliInternals.normalizeExportContent("", "cursorrules");
    expect(result).toBe("");
  });

  it("extracts content field from object export", () => {
    const result = cliInternals.resolveExportResultContent({
      content: "# AGENTS.md",
    });
    expect(result).toBe("# AGENTS.md");
  });
});
