/**
 * One-time script to backfill embeddings for all memories that don't have one.
 * Run with: npx tsx apps/web/scripts/backfill-embeddings.ts
 */

import { db } from "../lib/db";
import { memories } from "@memctl/db/schema";
import { isNull } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { generateEmbedding, serializeEmbedding } from "../lib/embeddings";

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

    for (const memory of batch) {
      try {
        const text = `${memory.key} ${memory.content} ${memory.tags ?? ""}`;
        const embedding = await generateEmbedding(text);

        if (embedding) {
          await db
            .update(memories)
            .set({ embedding: serializeEmbedding(embedding) })
            .where(eq(memories.id, memory.id));
          processed++;
        } else {
          failed++;
        }
      } catch (err) {
        console.error(`Failed to embed memory ${memory.key}:`, err);
        failed++;
      }
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
