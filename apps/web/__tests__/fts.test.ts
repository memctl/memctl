import { describe, it, expect } from "vitest";
import { mergeSearchResults } from "../lib/fts";

describe("mergeSearchResults (RRF)", () => {
  it("merges two result sets with RRF scoring", () => {
    const fts = ["a", "b", "c"];
    const vector = ["b", "d", "a"];

    const merged = mergeSearchResults(fts, vector, 5);

    // "b" appears in both at good positions — should rank high
    expect(merged).toContain("a");
    expect(merged).toContain("b");
    expect(merged).toContain("c");
    expect(merged).toContain("d");
    // "b" is in both lists, should rank higher than "c" or "d"
    expect(merged.indexOf("b")).toBeLessThan(merged.indexOf("c"));
    expect(merged.indexOf("b")).toBeLessThan(merged.indexOf("d"));
  });

  it("handles empty FTS results", () => {
    const merged = mergeSearchResults([], ["a", "b"], 5);
    expect(merged).toEqual(["a", "b"]);
  });

  it("handles empty vector results", () => {
    const merged = mergeSearchResults(["a", "b"], [], 5);
    expect(merged).toEqual(["a", "b"]);
  });

  it("respects limit", () => {
    const fts = ["a", "b", "c", "d", "e"];
    const vector = ["f", "g", "h", "i", "j"];
    const merged = mergeSearchResults(fts, vector, 3);
    expect(merged.length).toBe(3);
  });

  it("deduplicates IDs", () => {
    const fts = ["a", "b", "c"];
    const vector = ["a", "b", "c"];
    const merged = mergeSearchResults(fts, vector, 10);
    expect(merged.length).toBe(3);
    expect(new Set(merged).size).toBe(3);
  });
});
