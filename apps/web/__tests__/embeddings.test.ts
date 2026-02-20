import { describe, it, expect } from "vitest";
import { cosineSimilarity } from "../lib/embeddings";

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([1, 0, 0]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(1);
  });

  it("returns 0 for orthogonal vectors", () => {
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([0, 1, 0]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(0);
  });

  it("returns -1 for opposite vectors", () => {
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([-1, 0, 0]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1);
  });

  it("handles partial similarity", () => {
    const a = new Float32Array([1, 1, 0]);
    const b = new Float32Array([1, 0, 0]);
    const sim = cosineSimilarity(a, b);
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThan(1);
    expect(sim).toBeCloseTo(1 / Math.sqrt(2));
  });

  it("returns 0 for zero vectors", () => {
    const a = new Float32Array([0, 0, 0]);
    const b = new Float32Array([1, 0, 0]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it("returns 0 for mismatched lengths", () => {
    const a = new Float32Array([1, 0]);
    const b = new Float32Array([1, 0, 0]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it("handles high-dimensional vectors", () => {
    const dim = 384; // MiniLM-L6 dimension
    const a = new Float32Array(dim).fill(0.1);
    const b = new Float32Array(dim).fill(0.1);
    expect(cosineSimilarity(a, b)).toBeCloseTo(1);
  });
});
