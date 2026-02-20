import cron from "node-cron";
import { db } from "./db";
import { memories } from "@memctl/db/schema";
import { lt, isNull, isNotNull, eq } from "drizzle-orm";
import { logger } from "./logger";
import { sendPendingWebhooks } from "./webhook-dispatch";
import { generateEmbedding } from "./embeddings";

let initialized = false;

/**
 * Register background cron jobs. Safe to call multiple times — only runs once.
 */
export function initScheduler(): void {
  if (initialized) return;
  initialized = true;

  // Expired memory cleanup — every hour
  cron.schedule("0 * * * *", async () => {
    try {
      const now = new Date();
      const result = await db
        .delete(memories)
        .where(lt(memories.expiresAt, now));
      logger.info({ job: "cleanup-expired", affected: result.rowsAffected }, "Expired memory cleanup complete");
    } catch (err) {
      logger.error({ job: "cleanup-expired", error: String(err) }, "Expired memory cleanup failed");
    }
  });

  // Webhook digest dispatch — every 15 minutes
  cron.schedule("*/15 * * * *", async () => {
    try {
      const dispatched = await sendPendingWebhooks();
      if (dispatched > 0) {
        logger.info({ job: "webhook-digest", dispatched }, "Webhook digest sent");
      }
    } catch (err) {
      logger.error({ job: "webhook-digest", error: String(err) }, "Webhook digest failed");
    }
  });

  // Stale embedding backfill — every 6 hours
  cron.schedule("0 */6 * * *", async () => {
    try {
      const rows = await db
        .select({
          id: memories.id,
          key: memories.key,
          content: memories.content,
          tags: memories.tags,
        })
        .from(memories)
        .where(isNull(memories.embedding))
        .limit(100);

      let embedded = 0;
      for (const row of rows) {
        try {
          const text = `${row.key} ${row.content} ${row.tags ?? ""}`;
          const emb = await generateEmbedding(text);
          if (emb) {
            await db
              .update(memories)
              .set({ embedding: JSON.stringify(Array.from(emb)) })
              .where(eq(memories.id, row.id));
            embedded++;
          }
        } catch {
          // Skip individual failures
        }
      }

      logger.info(
        { job: "embedding-backfill", total: rows.length, embedded },
        "Embedding backfill complete",
      );
    } catch (err) {
      logger.error({ job: "embedding-backfill", error: String(err) }, "Embedding backfill failed");
    }
  });

  logger.info("Background scheduler initialized");
}
