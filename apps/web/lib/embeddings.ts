import { logger } from "./logger";

let pipeline: unknown = null;
let pipelineLoading: Promise<unknown> | null = null;

async function getEmbedder(): Promise<unknown> {
  if (pipeline) return pipeline;

  if (!pipelineLoading) {
    pipelineLoading = (async () => {
      try {
        const { pipeline: createPipeline } = await import(
          "@xenova/transformers"
        );
        pipeline = await createPipeline(
          "feature-extraction",
          "Xenova/all-MiniLM-L6-v2",
        );
        return pipeline;
      } catch (err) {
        logger.warn({ error: String(err) }, "Failed to load embedding model");
        pipelineLoading = null;
        return null;
      }
    })();
  }

  return pipelineLoading;
}

export async function generateEmbedding(
  text: string,
): Promise<Float32Array | null> {
  try {
    const embedder = (await getEmbedder()) as
      | ((text: string, opts: unknown) => Promise<{ data: Float32Array }>)
      | null;
    if (!embedder) return null;

    const result = await embedder(text, {
      pooling: "mean",
      normalize: true,
    });
    return result.data;
  } catch (err) {
    logger.warn({ error: String(err) }, "Embedding generation failed");
    return null;
  }
}

const EMBEDDING_DIM = 384;

/**
 * Generate embeddings for multiple texts in a single batch call.
 * Falls back to sequential generateEmbedding() calls if batch fails.
 */
export async function generateEmbeddings(
  texts: string[],
): Promise<(Float32Array | null)[]> {
  if (texts.length === 0) return [];
  if (texts.length === 1) {
    const emb = await generateEmbedding(texts[0]);
    return [emb];
  }

  try {
    const embedder = (await getEmbedder()) as
      | ((text: string[], opts: unknown) => Promise<{ data: Float32Array }>)
      | null;
    if (!embedder) return texts.map(() => null);

    const result = await embedder(texts, {
      pooling: "mean",
      normalize: true,
    });

    // Pipeline returns concatenated output — slice into individual embeddings
    const embeddings: (Float32Array | null)[] = [];
    for (let i = 0; i < texts.length; i++) {
      const start = i * EMBEDDING_DIM;
      const end = start + EMBEDDING_DIM;
      if (end <= result.data.length) {
        embeddings.push(result.data.slice(start, end));
      } else {
        embeddings.push(null);
      }
    }
    return embeddings;
  } catch (err) {
    logger.warn({ error: String(err) }, "Batch embedding failed, falling back to sequential");
    // Fallback to sequential calls
    const results: (Float32Array | null)[] = [];
    for (const text of texts) {
      results.push(await generateEmbedding(text));
    }
    return results;
  }
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Quantize a Float32 embedding to Int8 for compact storage.
 * Stores min/max alongside the int8 values for dequantization.
 * Reduces ~3-4KB JSON to ~500 bytes.
 */
export function quantizeEmbedding(
  emb: Float32Array,
): { values: number[]; min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < emb.length; i++) {
    if (emb[i] < min) min = emb[i];
    if (emb[i] > max) max = emb[i];
  }

  const range = max - min || 1;
  const values: number[] = new Array(emb.length);
  for (let i = 0; i < emb.length; i++) {
    values[i] = Math.round(((emb[i] - min) / range) * 255) - 128;
  }

  return { values, min, max };
}

/**
 * Dequantize an Int8 embedding back to Float32 for similarity computation.
 */
export function dequantizeEmbedding(
  q: { values: number[]; min: number; max: number },
): Float32Array {
  const range = q.max - q.min || 1;
  const result = new Float32Array(q.values.length);
  for (let i = 0; i < q.values.length; i++) {
    result[i] = ((q.values[i] + 128) / 255) * range + q.min;
  }
  return result;
}

/**
 * Serialize an embedding for storage. Uses int8 quantization.
 */
export function serializeEmbedding(emb: Float32Array): string {
  return JSON.stringify(quantizeEmbedding(emb));
}

/**
 * Deserialize an embedding from storage. Handles both legacy Float32 arrays and quantized format.
 */
export function deserializeEmbedding(stored: string): Float32Array {
  const parsed = JSON.parse(stored);
  // Quantized format: { values, min, max }
  if (parsed.values && typeof parsed.min === "number") {
    return dequantizeEmbedding(parsed);
  }
  // Legacy Float32Array format: plain number array
  return new Float32Array(parsed);
}
