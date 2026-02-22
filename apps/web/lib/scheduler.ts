import cron from "node-cron";
import { db } from "./db";
import { memories, memoryVersions, activityLogs, memoryLocks } from "@memctl/db/schema";
import { lt, isNull, isNotNull, eq, and, sql } from "drizzle-orm";
import { logger } from "./logger";
import { sendPendingWebhooks } from "./webhook-dispatch";
import { generateEmbeddings, serializeEmbedding } from "./embeddings";
import { computeRelevanceScore } from "@memctl/shared/relevance";

let initialized = false;

/**
 * Register background cron jobs. Safe to call multiple times — only runs once.
 */
export function initScheduler(): void {
  if (initialized) return;
  initialized = true;

  // Expired memory cleanup — every hour
  // Note: actively-accessed memories auto-extend their TTL by 24h on each GET
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

  // Webhook safety-net dispatch — every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
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
      // Process in batches of 50 for efficiency
      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50);
        const texts = batch.map((r) => `${r.key} ${r.content} ${r.tags ?? ""}`);
        try {
          const embeddings = await generateEmbeddings(texts);
          for (let j = 0; j < batch.length; j++) {
            if (embeddings[j]) {
              try {
                await db
                  .update(memories)
                  .set({ embedding: serializeEmbedding(embeddings[j]!) })
                  .where(eq(memories.id, batch[j].id));
                embedded++;
              } catch {
                // Skip individual store failures
              }
            }
          }
        } catch {
          // Skip batch failures
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

  // Auto-prune low-relevance memories — daily at 3 AM
  const PRUNE_THRESHOLD = parseFloat(process.env.MEMCTL_PRUNE_THRESHOLD ?? "5.0");
  cron.schedule("0 3 * * *", async () => {
    try {
      const unpinned = await db
        .select()
        .from(memories)
        .where(isNull(memories.archivedAt));

      const now = Date.now();
      let pruned = 0;
      for (const mem of unpinned) {
        if (mem.pinnedAt) continue; // never prune pinned
        const score = computeRelevanceScore({
          priority: mem.priority ?? 0,
          accessCount: mem.accessCount ?? 0,
          lastAccessedAt: mem.lastAccessedAt ? new Date(mem.lastAccessedAt).getTime() : null,
          helpfulCount: mem.helpfulCount ?? 0,
          unhelpfulCount: mem.unhelpfulCount ?? 0,
          pinnedAt: null,
        }, now);
        if (score < PRUNE_THRESHOLD) {
          let existingTags: string[] = [];
          if (mem.tags) {
            try { existingTags = JSON.parse(mem.tags) as string[]; } catch { /* ignore */ }
          }
          const newTags = [...new Set([...existingTags, "auto:pruned"])];
          await db
            .update(memories)
            .set({ archivedAt: new Date(), tags: JSON.stringify(newTags) })
            .where(eq(memories.id, mem.id));
          pruned++;
        }
      }
      logger.info({ job: "auto-prune", pruned, threshold: PRUNE_THRESHOLD }, "Auto-prune complete");
    } catch (err) {
      logger.error({ job: "auto-prune", error: String(err) }, "Auto-prune failed");
    }
  });

  // Delete expired memory locks — every hour at :30
  cron.schedule("30 * * * *", async () => {
    try {
      const now = new Date();
      const result = await db
        .delete(memoryLocks)
        .where(lt(memoryLocks.expiresAt, now));
      logger.info({ job: "cleanup-expired-locks", affected: result.rowsAffected }, "Expired lock cleanup complete");
    } catch (err) {
      logger.error({ job: "cleanup-expired-locks", error: String(err) }, "Expired lock cleanup failed");
    }
  });

  // Trim old memory versions — daily at 4 AM, keep latest N per memory
  const MAX_VERSIONS = parseInt(process.env.MEMCTL_MAX_VERSIONS ?? "50", 10);
  cron.schedule("0 4 * * *", async () => {
    try {
      const result = await db.run(sql`
        DELETE FROM memory_versions
        WHERE id IN (
          SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY memory_id ORDER BY version DESC) AS rn
            FROM memory_versions
          ) WHERE rn > ${MAX_VERSIONS}
        )
      `);
      logger.info({ job: "trim-versions", affected: result.rowsAffected }, "Version trimming complete");
    } catch (err) {
      logger.error({ job: "trim-versions", error: String(err) }, "Version trimming failed");
    }
  });

  // Delete old activity logs — daily at 4:15 AM
  const ACTIVITY_LOG_RETENTION_DAYS = parseInt(process.env.MEMCTL_ACTIVITY_LOG_RETENTION_DAYS ?? "90", 10);
  cron.schedule("15 4 * * *", async () => {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - ACTIVITY_LOG_RETENTION_DAYS);
      const result = await db
        .delete(activityLogs)
        .where(lt(activityLogs.createdAt, cutoff));
      logger.info({ job: "cleanup-activity-logs", affected: result.rowsAffected }, "Activity log cleanup complete");
    } catch (err) {
      logger.error({ job: "cleanup-activity-logs", error: String(err) }, "Activity log cleanup failed");
    }
  });

  // Permanently delete old archived memories — weekly Sunday at 5 AM
  const ARCHIVE_PURGE_DAYS = parseInt(process.env.MEMCTL_ARCHIVE_PURGE_DAYS ?? "90", 10);
  cron.schedule("0 5 * * 0", async () => {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - ARCHIVE_PURGE_DAYS);
      const result = await db
        .delete(memories)
        .where(
          and(
            isNotNull(memories.archivedAt),
            lt(memories.archivedAt, cutoff),
            isNull(memories.pinnedAt),
          ),
        );
      logger.info({ job: "purge-archived", affected: result.rowsAffected }, "Archive purge complete");
    } catch (err) {
      logger.error({ job: "purge-archived", error: String(err) }, "Archive purge failed");
    }
  });

  logger.info("Background scheduler initialized");
}
