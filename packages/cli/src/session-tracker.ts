import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ApiClient } from "./api-client.js";
import { getBranchInfo } from "./agent-context.js";

const AUTO_SESSION_PREFIX = "auto";
const FLUSH_INTERVAL_MS = 30_000;

export type SessionHandoff = {
  previousSessionId: string;
  summary: string | null;
  branch: string | null;
  keysWritten: string[];
  endedAt: unknown;
};

export type SessionTracker = {
  sessionId: string;
  branch: string | null;
  handoff: SessionHandoff | null;
  readKeys: Set<string>;
  writtenKeys: Set<string>;
  toolActions: Set<string>;
  areas: Set<string>;
  apiCallCount: number;
  dirty: boolean;
  closed: boolean;
  startedAt: number;
  endedExplicitly: boolean;
};

export function createSessionTracker(): SessionTracker {
  const now = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return {
    sessionId: `${AUTO_SESSION_PREFIX}-${now.toString(36)}-${rand}`,
    branch: null,
    handoff: null,
    readKeys: new Set<string>(),
    writtenKeys: new Set<string>(),
    toolActions: new Set<string>(),
    areas: new Set<string>(),
    apiCallCount: 0,
    dirty: false,
    closed: false,
    startedAt: now,
    endedExplicitly: false,
  };
}

export function recordToolAction(
  tracker: SessionTracker,
  tool: string,
  action: string,
): void {
  tracker.toolActions.add(`${tool}.${action}`);
  tracker.dirty = true;
}

// ── API-level tracking helpers ──────────────────────────────────────

export function getPathWithoutQuery(path: string): string {
  const idx = path.indexOf("?");
  return idx >= 0 ? path.slice(0, idx) : path;
}

export function getAreaFromPath(path: string): string | null {
  const clean = getPathWithoutQuery(path).replace(/^\/+/, "");
  if (!clean) return null;
  const area = clean.split("/")[0];
  return area || null;
}

export function shouldTrackMemoryKey(key: string): boolean {
  if (!key) return false;
  if (key.startsWith("agent/claims/")) return false;
  if (key.startsWith("auto:")) return false;
  return true;
}

export function extractKeyFromPath(
  method: string,
  path: string,
): {
  readKey?: string;
  writtenKey?: string;
} {
  const cleanPath = getPathWithoutQuery(path);
  const match = cleanPath.match(/^\/memories\/([^/]+)$/);
  if (!match) return {};

  const raw = match[1];
  if (!raw) return {};
  const key = decodeURIComponent(raw);
  if (!shouldTrackMemoryKey(key)) return {};

  const upperMethod = method.toUpperCase();
  if (upperMethod === "GET") return { readKey: key };
  if (
    upperMethod === "POST" ||
    upperMethod === "PATCH" ||
    upperMethod === "DELETE"
  ) {
    return { writtenKey: key };
  }
  return {};
}

export function extractKeyFromBody(
  method: string,
  path: string,
  body?: unknown,
): {
  readKey?: string;
  writtenKey?: string;
} {
  if (!body || typeof body !== "object") return {};
  const cleanPath = getPathWithoutQuery(path);
  const upperMethod = method.toUpperCase();
  const payload = body as Record<string, unknown>;

  if (upperMethod === "POST" && cleanPath === "/memories") {
    const key = typeof payload.key === "string" ? payload.key : "";
    if (shouldTrackMemoryKey(key)) {
      return { writtenKey: key };
    }
  }

  if (upperMethod === "POST" && cleanPath === "/memories/bulk") {
    const keys = Array.isArray(payload.keys) ? payload.keys : [];
    const first = keys.find((k) => typeof k === "string") as string | undefined;
    if (first && shouldTrackMemoryKey(first)) {
      return { readKey: first };
    }
  }

  return {};
}

export function trackApiCall(
  tracker: SessionTracker,
  method: string,
  path: string,
  body?: unknown,
): void {
  const area = getAreaFromPath(path);
  if (area === "health" || area === "session-logs") return;

  tracker.apiCallCount += 1;
  if (area) tracker.areas.add(area);

  const fromPath = extractKeyFromPath(method, path);
  const fromBody = extractKeyFromBody(method, path, body);
  const readKey = fromPath.readKey ?? fromBody.readKey;
  const writtenKey = fromPath.writtenKey ?? fromBody.writtenKey;
  if (readKey) tracker.readKeys.add(readKey);
  if (writtenKey) tracker.writtenKeys.add(writtenKey);
  tracker.dirty = true;
}

// ── Summary building ────────────────────────────────────────────────

export function buildSummary(tracker: SessionTracker): string {
  const durationMs = Math.max(0, Date.now() - tracker.startedAt);
  const minutes = Math.max(1, Math.round(durationMs / 60_000));
  const parts: string[] = [`Auto-captured: ${minutes} min, ${tracker.apiCallCount} API calls.`];

  const written = [...tracker.writtenKeys].sort();
  if (written.length > 0) {
    parts.push(`Keys written: ${written.join(", ")}.`);
  }

  const read = [...tracker.readKeys].sort();
  if (read.length > 0) {
    parts.push(`Keys read: ${read.join(", ")}.`);
  }

  const tools = [...tracker.toolActions].sort();
  if (tools.length > 0) {
    parts.push(`Tools: ${tools.join(", ")}.`);
  }

  return parts.join("\n");
}

// ── Finalization and flushing ───────────────────────────────────────

export async function finalizeSession(
  client: ApiClient,
  tracker: SessionTracker,
): Promise<void> {
  if (tracker.closed) return;
  tracker.closed = true;

  // Do NOT remove the session file here. The hook dispatcher reads it
  // during SessionEnd and removes it itself. Removing early causes a race
  // where the hook can't find the file and generates a duplicate session.

  if (tracker.endedExplicitly) return;

  try {
    await client.upsertSessionLog({
      sessionId: tracker.sessionId,
      summary: buildSummary(tracker),
      keysRead: [...tracker.readKeys],
      keysWritten: [...tracker.writtenKeys],
      toolsUsed: [...tracker.toolActions],
      endedAt: Date.now(),
    });
  } catch {
    // Best effort only.
  }
}

export async function flushSession(
  client: ApiClient,
  tracker: SessionTracker,
  final: boolean,
): Promise<void> {
  if (tracker.closed) return;
  if (!tracker.dirty && !final) return;

  if (final) {
    await finalizeSession(client, tracker);
    return;
  }

  try {
    await client.upsertSessionLog({
      sessionId: tracker.sessionId,
      summary: buildSummary(tracker),
      keysRead: [...tracker.readKeys],
      keysWritten: [...tracker.writtenKeys],
      toolsUsed: [...tracker.toolActions],
    });
    tracker.dirty = false;
  } catch {
    // Best effort only.
  }
}

// ── Session file (shared with hook dispatcher) ──────────────────────

const SESSION_FILE_DIR = join(".memctl", "hooks");
const SESSION_FILE_PATH = join(SESSION_FILE_DIR, "session_id");

function writeSessionFile(sessionId: string): void {
  try {
    mkdirSync(SESSION_FILE_DIR, { recursive: true });
    writeFileSync(SESSION_FILE_PATH, sessionId, "utf-8");
  } catch {
    // Best effort only.
  }
}

// ── Lifecycle ───────────────────────────────────────────────────────

export function startSessionLifecycle(
  client: ApiClient,
  tracker: SessionTracker,
): { cleanup: () => void } {
  // Write session file synchronously so hooks can read it immediately,
  // even if the async lifecycle below hasn't finished yet.
  writeSessionFile(tracker.sessionId);

  void (async () => {
    try {
      const branchInfo = await getBranchInfo().catch(() => null);
      const branch = branchInfo?.branch ?? null;
      tracker.branch = branch;

      await client.upsertSessionLog({
        sessionId: tracker.sessionId,
        branch: branch ?? undefined,
      });

      const recentSessions = await client
        .getSessionLogs(5)
        .catch(() => ({ sessionLogs: [] }));

      // Auto-close stale sessions (open > 2 hours)
      const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
      const now = Date.now();
      for (const log of recentSessions.sessionLogs) {
        if (log.endedAt) continue;
        if (log.sessionId === tracker.sessionId) continue;
        const startedAt =
          typeof log.startedAt === "number"
            ? log.startedAt
            : typeof log.startedAt === "string"
              ? new Date(log.startedAt).getTime()
              : 0;
        if (!startedAt || now - startedAt < TWO_HOURS_MS) continue;
        try {
          await client.upsertSessionLog({
            sessionId: log.sessionId,
            summary:
              log.summary ||
              "Auto-closed: session exceeded 2-hour inactivity limit.",
            endedAt: now,
          });
        } catch {
          // Best effort
        }
      }

      // Build handoff from most recent session
      const lastSession = recentSessions.sessionLogs.find(
        (s) => s.sessionId !== tracker.sessionId,
      );
      if (lastSession) {
        tracker.handoff = {
          previousSessionId: lastSession.sessionId,
          summary: lastSession.summary,
          branch: lastSession.branch,
          keysWritten: lastSession.keysWritten
            ? JSON.parse(lastSession.keysWritten)
            : [],
          endedAt: lastSession.endedAt,
        };
      }
    } catch {
      // Best effort, ensure session log exists
      try {
        await client.upsertSessionLog({ sessionId: tracker.sessionId });
      } catch {
        // Best effort only.
      }
    }
  })();

  const interval = setInterval(() => {
    void flushSession(client, tracker, false);
  }, FLUSH_INTERVAL_MS);
  interval.unref();

  const finalize = () => {
    clearInterval(interval);
    void finalizeSession(client, tracker);
  };

  process.once("beforeExit", finalize);
  process.once("SIGINT", finalize);
  process.once("SIGTERM", finalize);

  return {
    cleanup: () => {
      clearInterval(interval);
      process.removeListener("beforeExit", finalize);
      process.removeListener("SIGINT", finalize);
      process.removeListener("SIGTERM", finalize);
    },
  };
}
