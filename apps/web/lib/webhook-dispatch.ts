import { createHmac } from "node:crypto";
import { db } from "./db";
import { webhookConfigs, webhookEvents } from "@memctl/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { logger } from "./logger";

export interface WebhookEvent {
  type: string;
  payload: Record<string, unknown>;
}

function generateId(): string {
  return crypto.randomUUID();
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Dispatch webhook events for a project.
 * Stores events for digest dispatch by the scheduler.
 */
export async function dispatchWebhooks(
  projectId: string,
  events: WebhookEvent[],
): Promise<void> {
  try {
    const configs = await db
      .select()
      .from(webhookConfigs)
      .where(
        and(
          eq(webhookConfigs.projectId, projectId),
          eq(webhookConfigs.isActive, true),
        ),
      );

    if (configs.length === 0) return;

    for (const config of configs) {
      const configEvents = config.events ? JSON.parse(config.events) as string[] : [];

      for (const event of events) {
        // Check if this webhook config is subscribed to this event type
        if (configEvents.length > 0 && !configEvents.includes(event.type)) {
          continue;
        }

        // Store event for digest dispatch
        await db.insert(webhookEvents).values({
          id: generateId(),
          webhookConfigId: config.id,
          eventType: event.type,
          payload: JSON.stringify(event.payload),
          createdAt: new Date(),
        });
      }
    }
  } catch (err) {
    logger.error({ error: String(err) }, "Failed to queue webhook events");
  }
}

/**
 * Send pending webhook events in batches.
 * Called by the scheduler every 15 minutes.
 */
export async function sendPendingWebhooks(): Promise<number> {
  let dispatched = 0;

  try {
    const configs = await db.select().from(webhookConfigs).where(eq(webhookConfigs.isActive, true));

    for (const config of configs) {
      const pending = await db
        .select()
        .from(webhookEvents)
        .where(
          and(
            eq(webhookEvents.webhookConfigId, config.id),
            isNull(webhookEvents.dispatchedAt),
          ),
        );

      if (pending.length === 0) continue;

      const payload = JSON.stringify({
        events: pending.map((e) => ({
          type: e.eventType,
          payload: JSON.parse(e.payload),
          createdAt: e.createdAt,
        })),
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

        if (res.ok) {
          // Mark events as dispatched
          const now = new Date();
          for (const event of pending) {
            await db
              .update(webhookEvents)
              .set({ dispatchedAt: now })
              .where(eq(webhookEvents.id, event.id));
          }

          await db
            .update(webhookConfigs)
            .set({ lastSentAt: now })
            .where(eq(webhookConfigs.id, config.id));

          dispatched += pending.length;
        } else {
          logger.warn(
            { url: config.url, status: res.status },
            "Webhook delivery failed",
          );
        }
      } catch (err) {
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
