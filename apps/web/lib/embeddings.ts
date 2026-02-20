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
