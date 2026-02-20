/**
 * One-time script to backfill embeddings for all memories that don't have one.
 * Run with: npx tsx apps/web/scripts/backfill-embeddings.ts
 */

import { db } from "../lib/db";
import { memories } from "@memctl/db/schema";
import { isNull } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { generateEmbeddings, serializeEmbedding } from "../lib/embeddings";

const BATCH_SIZE = 50;

async function backfill() {
  console.log("Starting embedding backfill...");

  const all = await db
    .select({
      id: memories.id,
      key: memories.key,
      content: memories.content,
      tags: memories.tags,
    })
    .from(memories)
    .where(isNull(memories.embedding));

  console.log(`Found ${all.length} memories without embeddings`);

  let processed = 0;
  let failed = 0;

  for (let i = 0; i < all.length; i += BATCH_SIZE) {
    const batch = all.slice(i, i + BATCH_SIZE);

    const texts = batch.map((m) => `${m.key} ${m.content} ${m.tags ?? ""}`);
    try {
      const embeddings = await generateEmbeddings(texts);
      for (let j = 0; j < batch.length; j++) {
        const emb = embeddings[j];
        if (emb) {
          try {
            await db
              .update(memories)
              .set({ embedding: serializeEmbedding(emb) })
              .where(eq(memories.id, batch[j].id));
            processed++;
          } catch (err) {
            console.error(`Failed to store embedding for ${batch[j].key}:`, err);
            failed++;
          }
        } else {
          failed++;
        }
      }
    } catch (err) {
      console.error(`Failed to embed batch starting at ${i}:`, err);
      failed += batch.length;
    }

    console.log(
      `Progress: ${Math.min(i + BATCH_SIZE, all.length)}/${all.length} (${processed} embedded, ${failed} failed)`,
    );
  }

  console.log(
    `Backfill complete: ${processed} embedded, ${failed} failed out of ${all.length} total`,
  );
}

backfill().catch(console.error);
