import { createHmac } from "node:crypto";
import { db } from "./db";
import { webhookConfigs, activityLogs } from "@memctl/db/schema";
import { eq, and, gt, inArray } from "drizzle-orm";
import { logger } from "./logger";

// --- URL Validation ---

export function validateWebhookUrl(url: string): { valid: boolean; error?: string } {
  if (!url.startsWith("https://")) {
    return { valid: false, error: "Webhook URL must use HTTPS" };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, error: "Invalid URL" };
  }

  const hostname = parsed.hostname;

  // Reject bare hostnames (no dot)
  if (!hostname.includes(".")) {
    return { valid: false, error: "Hostname must be a fully qualified domain name" };
  }

  // Reject IP addresses (IPv4)
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return { valid: false, error: "IP addresses are not allowed" };
  }

  // Reject IPv6 brackets
  if (hostname.startsWith("[")) {
    return { valid: false, error: "IPv6 addresses are not allowed" };
  }

  // Reject localhost
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return { valid: false, error: "localhost is not allowed" };
  }

  // Reject private/reserved IP ranges encoded as hostnames
  // These checks cover cases where someone registers DNS pointing to private IPs
  // The hostname-based checks above handle direct IP usage
  const privatePatterns = [
    /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^169\.254\./, /^0\./,
  ];
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    for (const pattern of privatePatterns) {
      if (pattern.test(hostname)) {
        return { valid: false, error: "Private/reserved IP addresses are not allowed" };
      }
    }
  }

  return { valid: true };
}

// --- HMAC Signing ---

export function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

// --- Config Cache ---

interface CachedConfigs {
  configs: (typeof webhookConfigs.$inferSelect)[];
  cachedAt: number;
}

const configCache = new Map<string, CachedConfigs>();
const CONFIG_CACHE_TTL = 30_000; // 30 seconds

async function getActiveConfigs(projectId: string) {
  const cached = configCache.get(projectId);
  if (cached && Date.now() - cached.cachedAt < CONFIG_CACHE_TTL) {
    return cached.configs;
  }

  const configs = await db
    .select()
    .from(webhookConfigs)
    .where(
      and(
        eq(webhookConfigs.projectId, projectId),
        eq(webhookConfigs.isActive, true),
      ),
    );

  configCache.set(projectId, { configs, cachedAt: Date.now() });
  return configs;
}

// --- Debounce Timers ---

const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const lastSentTimes = new Map<string, number>();
const MIN_INTERVAL_MS = 30_000; // 30 seconds minimum between sends
const DEBOUNCE_MS = 5_000; // 5 second debounce

// --- Action Mapping ---

function mapActivityToEvent(action: string, details: string | null): string | null {
  if (action === "memory_delete") return "memory.deleted";
  if (action === "memory_write") {
    let changeType = "updated";
    if (details) {
      try {
        const parsed = JSON.parse(details);
        if (parsed.changeType) changeType = parsed.changeType;
      } catch { /* use default */ }
    }
    return changeType === "created" ? "memory.created" : "memory.updated";
  }
  return null;
}

// --- Delivery ---

async function deliverWebhookBatch(config: typeof webhookConfigs.$inferSelect): Promise<void> {
  try {
    // Rate check: skip if too recent, reschedule for remainder
    const lastSent = lastSentTimes.get(config.id) ?? (config.lastSentAt?.getTime() ?? 0);
    const elapsed = Date.now() - lastSent;
    if (elapsed < MIN_INTERVAL_MS) {
      const remainder = MIN_INTERVAL_MS - elapsed;
      debounceTimers.set(config.id, setTimeout(() => deliverWebhookBatch(config), remainder));
      return;
    }

    // Circuit breaker: skip if too many consecutive failures
    if (config.consecutiveFailures >= 5) {
      return;
    }

    // Query activity logs since last send
    const since = config.lastSentAt ?? new Date(0);
    const logs = await db
      .select()
      .from(activityLogs)
      .where(
        and(
          eq(activityLogs.projectId, config.projectId),
          gt(activityLogs.createdAt, since),
          inArray(activityLogs.action, ["memory_write", "memory_delete"]),
        ),
      );

    if (logs.length === 0) return;

    // Map to webhook events and filter by subscription
    const subscribedEvents = config.events ? JSON.parse(config.events) as string[] : [];
    const events = logs
      .map((log) => {
        const eventType = mapActivityToEvent(log.action, log.details);
        if (!eventType) return null;
        if (subscribedEvents.length > 0 && !subscribedEvents.includes(eventType)) return null;
        return {
          type: eventType,
          memoryKey: log.memoryKey,
          createdAt: log.createdAt,
        };
      })
      .filter(Boolean);

    if (events.length === 0) return;

    // Build and send payload
    const payload = JSON.stringify({
      events,
      timestamp: new Date().toISOString(),
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (config.secret) {
      headers["X-Webhook-Signature"] = signPayload(payload, config.secret);
    }

    const res = await fetch(config.url, {
      method: "POST",
      headers,
      body: payload,
      signal: AbortSignal.timeout(10_000),
    });

    const now = new Date();

    if (res.ok) {
      // Success: update lastSentAt, reset failures
      await db
        .update(webhookConfigs)
        .set({ lastSentAt: now, consecutiveFailures: 0 })
        .where(eq(webhookConfigs.id, config.id));
      lastSentTimes.set(config.id, now.getTime());

      // Invalidate cache so next fetch picks up updated lastSentAt
      configCache.delete(config.projectId);
    } else {
      // Failure: increment consecutive failures
      const newFailures = config.consecutiveFailures + 1;
      const updates: Record<string, unknown> = { consecutiveFailures: newFailures };
      if (newFailures >= 5) {
        updates.isActive = false;
        logger.warn(
          { webhookId: config.id, url: config.url, failures: newFailures },
          "Webhook circuit breaker tripped — auto-disabled",
        );
      }
      await db
        .update(webhookConfigs)
        .set(updates)
        .where(eq(webhookConfigs.id, config.id));

      configCache.delete(config.projectId);

      logger.warn(
        { url: config.url, status: res.status },
        "Webhook delivery failed",
      );
    }
  } catch (err) {
    // Network/timeout error — increment failures
    const newFailures = config.consecutiveFailures + 1;
    const updates: Record<string, unknown> = { consecutiveFailures: newFailures };
    if (newFailures >= 5) {
      updates.isActive = false;
      logger.warn(
        { webhookId: config.id, url: config.url, failures: newFailures },
        "Webhook circuit breaker tripped — auto-disabled",
      );
    }
    await db
      .update(webhookConfigs)
      .set(updates)
      .where(eq(webhookConfigs.id, config.id))
      .catch(() => {});

    configCache.delete(config.projectId);

    logger.warn(
      { url: config.url, error: String(err) },
      "Webhook delivery error",
    );
  }
}

// --- Public API ---

/**
 * Schedule near-real-time webhook delivery for a project.
 * Uses a 5s debounce per webhook config, fire-and-forget.
 */
export function scheduleWebhookDelivery(projectId: string): void {
  getActiveConfigs(projectId)
    .then((configs) => {
      for (const config of configs) {
        // Clear existing debounce timer
        const existing = debounceTimers.get(config.id);
        if (existing) clearTimeout(existing);

        // Set new 5s debounce
        debounceTimers.set(
          config.id,
          setTimeout(() => {
            debounceTimers.delete(config.id);
            deliverWebhookBatch(config).catch(() => {});
          }, DEBOUNCE_MS),
        );
      }
    })
    .catch((err) => {
      logger.error({ error: String(err) }, "Failed to schedule webhook delivery");
    });
}

/**
 * Safety-net cron: iterate all active configs and deliver pending batches.
 * Called by the scheduler every 5 minutes.
 */
export async function sendPendingWebhooks(): Promise<number> {
  let dispatched = 0;

  try {
    const configs = await db
      .select()
      .from(webhookConfigs)
      .where(eq(webhookConfigs.isActive, true));

    for (const config of configs) {
      if (config.consecutiveFailures >= 5) continue;

      const since = config.lastSentAt ?? new Date(0);
      const logs = await db
        .select()
        .from(activityLogs)
        .where(
          and(
            eq(activityLogs.projectId, config.projectId),
            gt(activityLogs.createdAt, since),
            inArray(activityLogs.action, ["memory_write", "memory_delete"]),
          ),
        );

      if (logs.length === 0) continue;

      const subscribedEvents = config.events ? JSON.parse(config.events) as string[] : [];
      const events = logs
        .map((log) => {
          const eventType = mapActivityToEvent(log.action, log.details);
          if (!eventType) return null;
          if (subscribedEvents.length > 0 && !subscribedEvents.includes(eventType)) return null;
          return {
            type: eventType,
            memoryKey: log.memoryKey,
            createdAt: log.createdAt,
          };
        })
        .filter(Boolean);

      if (events.length === 0) continue;

      const payload = JSON.stringify({
        events,
        timestamp: new Date().toISOString(),
      });

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (config.secret) {
        headers["X-Webhook-Signature"] = signPayload(payload, config.secret);
      }

      try {
        const res = await fetch(config.url, {
          method: "POST",
          headers,
          body: payload,
          signal: AbortSignal.timeout(10_000),
        });

        const now = new Date();

        if (res.ok) {
          await db
            .update(webhookConfigs)
            .set({ lastSentAt: now, consecutiveFailures: 0 })
            .where(eq(webhookConfigs.id, config.id));
          dispatched += events.length;
        } else {
          const newFailures = config.consecutiveFailures + 1;
          const updates: Record<string, unknown> = { consecutiveFailures: newFailures };
          if (newFailures >= 5) {
            updates.isActive = false;
            logger.warn(
              { webhookId: config.id, url: config.url, failures: newFailures },
              "Webhook circuit breaker tripped — auto-disabled",
            );
          }
          await db
            .update(webhookConfigs)
            .set(updates)
            .where(eq(webhookConfigs.id, config.id));

          logger.warn(
            { url: config.url, status: res.status },
            "Webhook delivery failed",
          );
        }
      } catch (err) {
        const newFailures = config.consecutiveFailures + 1;
        const updates: Record<string, unknown> = { consecutiveFailures: newFailures };
        if (newFailures >= 5) {
          updates.isActive = false;
        }
        await db
          .update(webhookConfigs)
          .set(updates)
          .where(eq(webhookConfigs.id, config.id))
          .catch(() => {});

        logger.warn(
          { url: config.url, error: String(err) },
          "Webhook delivery error",
        );
      }
    }
  } catch (err) {
    logger.error({ error: String(err) }, "Failed to send pending webhooks");
  }

  return dispatched;
}
