import { describe, it, expect } from "vitest";
import { cosineSimilarity, quantizeEmbedding, dequantizeEmbedding, serializeEmbedding, deserializeEmbedding } from "../lib/embeddings";

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

describe("quantizeEmbedding / dequantizeEmbedding", () => {
  it("round-trips with minimal loss", () => {
    const original = new Float32Array([0.1, -0.5, 0.8, 0.0, -0.3]);
    const quantized = quantizeEmbedding(original);
    const restored = dequantizeEmbedding(quantized);

    for (let i = 0; i < original.length; i++) {
      expect(restored[i]).toBeCloseTo(original[i], 1); // within 0.1
    }
  });

  it("preserves cosine similarity after quantization", () => {
    const a = new Float32Array(384);
    const b = new Float32Array(384);
    for (let i = 0; i < 384; i++) {
      a[i] = Math.sin(i * 0.1);
      b[i] = Math.sin(i * 0.1 + 0.5);
    }

    const originalSim = cosineSimilarity(a, b);
    const restoredA = dequantizeEmbedding(quantizeEmbedding(a));
    const restoredB = dequantizeEmbedding(quantizeEmbedding(b));
    const restoredSim = cosineSimilarity(restoredA, restoredB);

    expect(restoredSim).toBeCloseTo(originalSim, 1);
  });

  it("quantized format is much smaller than raw Float32 JSON", () => {
    const emb = new Float32Array(384);
    for (let i = 0; i < 384; i++) emb[i] = Math.random() * 2 - 1;

    const rawJson = JSON.stringify(Array.from(emb));
    const quantizedJson = serializeEmbedding(emb);

    // Quantized should be significantly smaller
    expect(quantizedJson.length).toBeLessThan(rawJson.length * 0.5);
  });
});

describe("serializeEmbedding / deserializeEmbedding", () => {
  it("round-trips quantized format", () => {
    const original = new Float32Array([0.5, -0.3, 0.7]);
    const serialized = serializeEmbedding(original);
    const restored = deserializeEmbedding(serialized);
    for (let i = 0; i < original.length; i++) {
      expect(restored[i]).toBeCloseTo(original[i], 1);
    }
  });

  it("handles legacy Float32 array format", () => {
    const original = [0.5, -0.3, 0.7];
    const legacy = JSON.stringify(original);
    const restored = deserializeEmbedding(legacy);
    expect(restored).toBeInstanceOf(Float32Array);
    expect(restored[0]).toBeCloseTo(0.5);
  });
});
