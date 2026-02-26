import { MemoryCache } from "./cache.js";
import { LocalCache } from "./local-cache.js";

export class ApiError extends Error {
  status: number;
  details?: string;

  constructor(status: number, message: string, details?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export class ApiClient {
  private baseUrl: string;
  private token: string;
  private org: string;
  private project: string;
  private cache: MemoryCache;
  private localCache: LocalCache;
  private onRequest?:
    | ((event: { method: string; path: string; body?: unknown }) => void)
    | undefined;
  private isOffline = false;
  private inflight = new Map<string, Promise<unknown>>();
  private lastFreshness: "fresh" | "cached" | "stale" | "offline" = "fresh";

  constructor(config: {
    baseUrl: string;
    token: string;
    org: string;
    project: string;
    onRequest?: (event: {
      method: string;
      path: string;
      body?: unknown;
    }) => void;
  }) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.token = config.token;
    this.org = config.org;
    this.project = config.project;
    this.onRequest = config.onRequest;
    this.cache = new MemoryCache(30_000);
    this.localCache = new LocalCache(config.org, config.project);
  }

  getConnectionStatus(): { online: boolean } {
    return { online: !this.isOffline };
  }

  getLastFreshness(): "fresh" | "cached" | "stale" | "offline" {
    return this.lastFreshness;
  }

  getLocalCacheSyncAt(): number {
    return this.localCache.getLastSyncAt();
  }

  /** Attempt to reach the API. Returns true if online. */
  async ping(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(5_000),
      });
      this.isOffline = !res.ok;
      return res.ok;
    } catch {
      this.isOffline = true;
      return false;
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const cacheKey = `${method}:${path}`;

    // For GET requests, check in-memory cache first
    if (method === "GET") {
      const cached = this.cache.get(cacheKey);
      if (cached && !cached.stale) {
        this.lastFreshness = "cached";
        return cached.data as T;
      }

      // Stale-while-revalidate: return stale data immediately, revalidate in background
      if (cached?.stale) {
        this.lastFreshness = "stale";
        this.revalidate(cacheKey, path);
        return cached.data as T;
      }

      // Request deduplication: if an identical GET is already in-flight, share it
      const existing = this.inflight.get(cacheKey);
      if (existing) {
        return existing as Promise<T>;
      }
    }

    const promise = this.doFetch<T>(method, path, body, cacheKey);

    // Track in-flight GET requests for deduplication
    if (method === "GET") {
      this.inflight.set(cacheKey, promise);
      promise.then(
        () => this.inflight.delete(cacheKey),
        () => this.inflight.delete(cacheKey),
      );
    }

    return promise;
  }

  private async doFetch<T>(
    method: string,
    path: string,
    body: unknown,
    cacheKey: string,
  ): Promise<T> {
    this.onRequest?.({ method, path, body });
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
      "X-Org-Slug": this.org,
      "X-Project-Slug": this.project,
    };

    // Send If-None-Match for ETag revalidation on GET
    if (method === "GET") {
      const storedEtag = this.cache.getEtag(cacheKey);
      if (storedEtag) {
        headers["If-None-Match"] = storedEtag;
      }
    }

    // Send If-Match for optimistic concurrency on PATCH/DELETE
    if (method === "PATCH" || method === "DELETE") {
      const getKey = `GET:${path}`;
      const storedEtag = this.cache.getEtag(getKey);
      if (storedEtag) {
        headers["If-Match"] = storedEtag;
      }
    }

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      // Network error, try offline fallback for GET requests
      this.isOffline = true;
      if (method === "GET") {
        const offline = this.localCache.getByPath(path);
        if (offline !== null) {
          this.lastFreshness = "offline";
          return offline as T;
        }
      }
      throw err;
    }

    this.isOffline = false;

    // Handle 304 Not Modified, return cached data
    if (res.status === 304) {
      this.lastFreshness = "cached";
      this.cache.touch(cacheKey);
      const entry = this.cache.get(cacheKey);
      if (entry) return entry.data as T;
      // Fallback: re-fetch if cache was cleared between calls
    }

    if (!res.ok) {
      const text = await res.text();
      let message = `Request failed (${res.status})`;
      try {
        const parsed = JSON.parse(text) as { error?: string; message?: string };
        message = parsed.error || parsed.message || message;
      } catch {
        if (text.trim()) {
          message = text.trim();
        }
      }
      throw new ApiError(res.status, message, text);
    }

    const contentType = res.headers.get("content-type")?.toLowerCase() ?? "";
    const isJsonResponse =
      !contentType ||
      contentType.includes("application/json") ||
      contentType.includes("+json");

    let data: T;
    if (res.status === 204 || res.status === 205) {
      data = undefined as T;
    } else if (isJsonResponse) {
      const resClone =
        typeof res.clone === "function" ? res.clone() : null;
      try {
        data = (await res.json()) as T;
      } catch {
        const text =
          resClone != null
            ? await resClone.text()
            : typeof (
                  res as {
                    text?: () => Promise<string>;
                  }
                ).text === "function"
              ? await (
                  res as {
                    text: () => Promise<string>;
                  }
                ).text()
              : "";
        data = text.trim() ? (text as T) : (undefined as T);
      }
    } else {
      const text = await res.text();
      if (!text.trim()) {
        data = undefined as T;
      } else {
        data = text as T;
      }
    }
    this.lastFreshness = "fresh";

    // Cache GET responses with ETag
    if (method === "GET") {
      const etag = res.headers.get("etag") ?? undefined;
      this.cache.set(cacheKey, data, etag);

      // Sync to local cache in background for offline support
      if (path.startsWith("/memories")) {
        this.syncToLocalCache(data);
      }
    }

    // Invalidate cache on mutations
    if (method === "POST" || method === "PATCH" || method === "DELETE") {
      this.cache.invalidatePrefix("GET:/memories");
    }

    return data;
  }

  /** Background revalidation for stale cache entries. */
  private revalidate(cacheKey: string, path: string): void {
    this.doFetch("GET", path, undefined, cacheKey).catch(() => {
      // Revalidation failed silently, stale data continues to be served
    });
  }

  private syncToLocalCache(data: unknown): void {
    try {
      if (data && typeof data === "object") {
        const obj = data as Record<string, unknown>;
        if (Array.isArray(obj.memories)) {
          this.localCache.sync(obj.memories as Array<Record<string, unknown>>);
        } else if (obj.memory && typeof obj.memory === "object") {
          this.localCache.sync([obj.memory as Record<string, unknown>]);
        }
      }
    } catch {
      // Non-critical, do not fail the request
    }
  }

  // ── Batch Operations ────────────────────────────────────────
  async batch(
    operations: Array<{ method: string; path: string; body?: unknown }>,
  ) {
    return this.request<{
      results: Array<{ status: number; body: unknown }>;
    }>("POST", "/batch", { operations });
  }

  // ── Memory CRUD ──────────────────────────────────────────────

  async storeMemory(
    key: string,
    content: string,
    metadata?: Record<string, unknown>,
    options?: {
      scope?: string;
      priority?: number;
      tags?: string[];
      expiresAt?: number;
    },
  ) {
    return this.request("POST", "/memories", {
      key,
      content,
      metadata,
      ...options,
    });
  }

  async getMemory(key: string) {
    return this.request("GET", `/memories/${encodeURIComponent(key)}`);
  }

  async searchMemories(
    query: string,
    limit = 20,
    options?: {
      tags?: string;
      sort?: string;
      includeArchived?: boolean;
      intent?: string;
    },
  ) {
    const params = new URLSearchParams({
      q: query,
      limit: String(limit),
    });
    if (options?.tags) params.set("tags", options.tags);
    if (options?.sort) params.set("sort", options.sort);
    if (options?.includeArchived) params.set("include_archived", "true");
    if (options?.intent) params.set("intent", options.intent);
    return this.request("GET", `/memories?${params}`);
  }

  async listMemories(
    limit = 100,
    offset = 0,
    options?: {
      sort?: string;
      includeArchived?: boolean;
      tags?: string;
      after?: string;
    },
  ) {
    const params = new URLSearchParams({
      limit: String(limit),
    });
    if (options?.after) {
      params.set("after", options.after);
    } else {
      params.set("offset", String(offset));
    }
    if (options?.sort) params.set("sort", options.sort);
    if (options?.includeArchived) params.set("include_archived", "true");
    if (options?.tags) params.set("tags", options.tags);
    return this.request("GET", `/memories?${params}`);
  }

  async getMemoryCapacity() {
    return this.request<{
      used: number;
      limit: number;
      isFull: boolean;
      isApproaching: boolean;
      usageRatio: number | null;
    }>("GET", "/memories/capacity");
  }

  async deleteMemory(key: string) {
    return this.request("DELETE", `/memories/${encodeURIComponent(key)}`);
  }

  async updateMemory(
    key: string,
    content?: string,
    metadata?: Record<string, unknown>,
    options?: { priority?: number; tags?: string[]; expiresAt?: number | null },
  ) {
    return this.request("PATCH", `/memories/${encodeURIComponent(key)}`, {
      content,
      metadata,
      ...options,
    });
  }

  // ── Bulk Operations ──────────────────────────────────────────

  async bulkGetMemories(keys: string[]) {
    return this.request<{
      memories: Record<string, unknown>;
      found: number;
      requested: number;
    }>("POST", "/memories/bulk", { keys });
  }

  // ── Versioning ───────────────────────────────────────────────

  async getMemoryVersions(key: string, limit = 50) {
    return this.request<{
      key: string;
      currentVersion: number;
      versions: Array<{
        id: string;
        memoryId: string;
        version: number;
        content: string;
        metadata: string | null;
        changedBy: string | null;
        changeType: string;
        createdAt: unknown;
      }>;
    }>(
      "GET",
      `/memories/versions?key=${encodeURIComponent(key)}&limit=${limit}`,
    );
  }

  async restoreMemoryVersion(key: string, version: number) {
    return this.request("POST", "/memories/versions", { key, version });
  }

  // ── Archive ──────────────────────────────────────────────────

  async archiveMemory(key: string, archive: boolean) {
    return this.request("POST", "/memories/archive", { key, archive });
  }

  async cleanupExpired() {
    return this.request<{ cleaned: number }>("DELETE", "/memories/archive");
  }

  // ── Custom Context Types ─────────────────────────────────────

  async listContextTypes() {
    return this.request<{
      contextTypes: Array<{
        id: string;
        orgId: string;
        slug: string;
        label: string;
        description: string;
        schema: string | null;
        icon: string | null;
      }>;
    }>("GET", "/context-types");
  }

  async createContextType(data: {
    slug: string;
    label: string;
    description: string;
    schema?: string;
    icon?: string;
  }) {
    return this.request("POST", "/context-types", data);
  }

  async deleteContextType(slug: string) {
    return this.request("DELETE", `/context-types/${encodeURIComponent(slug)}`);
  }

  // ── Session Logs ────────────────────────────────────────────────

  async getSessionLogs(limit = 20) {
    return this.request<{
      sessionLogs: Array<{
        id: string;
        projectId: string;
        sessionId: string;
        branch: string | null;
        summary: string | null;
        keysRead: string | null;
        keysWritten: string | null;
        toolsUsed: string | null;
        startedAt: unknown;
        endedAt: unknown;
      }>;
    }>("GET", `/session-logs?limit=${limit}`);
  }

  async upsertSessionLog(data: {
    sessionId: string;
    branch?: string;
    summary?: string;
    keysRead?: string[];
    keysWritten?: string[];
    toolsUsed?: string[];
    endedAt?: number;
  }) {
    return this.request("POST", "/session-logs", data);
  }

  // ── Suggest Cleanup ─────────────────────────────────────────────

  async suggestCleanup(staleDays = 30, limit = 20) {
    return this.request<{
      stale: Array<{
        key: string;
        accessCount: number;
        lastAccessedAt: unknown;
        updatedAt: unknown;
        priority: number | null;
        reason: string;
      }>;
      expired: Array<{
        key: string;
        expiresAt: unknown;
        reason: string;
      }>;
      staleDaysThreshold: number;
    }>(
      "GET",
      `/memories/suggest-cleanup?stale_days=${staleDays}&limit=${limit}`,
    );
  }

  // ── Watch ───────────────────────────────────────────────────────

  async watchMemories(keys: string[], since: number) {
    return this.request<{
      changed: Array<{
        key: string;
        updatedAt: unknown;
        contentPreview: string;
      }>;
      unchanged: string[];
      checkedAt: number;
    }>("POST", "/memories/watch", { keys, since });
  }

  // ── Similar / Dedup ─────────────────────────────────────────────

  async findSimilar(content: string, excludeKey?: string, threshold = 0.6) {
    return this.request<{
      similar: Array<{
        key: string;
        priority: number | null;
        similarity: number;
      }>;
    }>("POST", "/memories/similar", { content, excludeKey, threshold });
  }

  // ── Pin / Unpin ─────────────────────────────────────────────────

  async pinMemory(key: string, pin: boolean) {
    return this.request<{ key: string; pinned: boolean; message: string }>(
      "POST",
      "/memories/pin",
      { key, pin },
    );
  }

  // ── Link / Unlink ──────────────────────────────────────────────

  async linkMemories(key: string, relatedKey: string, unlink = false) {
    return this.request<{
      key: string;
      relatedKey: string;
      action: string;
      keyRelatedKeys: string[];
      relatedKeyRelatedKeys: string[];
    }>("POST", "/memories/link", { key, relatedKey, unlink });
  }

  // ── Diff ───────────────────────────────────────────────────────

  async diffMemory(key: string, v1: number, v2?: number) {
    const params = new URLSearchParams({
      key,
      v1: String(v1),
    });
    if (v2 !== undefined) params.set("v2", String(v2));
    return this.request<{
      key: string;
      from: string;
      to: string;
      diff: Array<{
        type: "add" | "remove" | "same";
        line: string;
        lineNumber?: number;
      }>;
      summary: { added: number; removed: number; unchanged: number };
    }>("GET", `/memories/diff?${params}`);
  }

  // ── Export ─────────────────────────────────────────────────────

  async exportMemories(
    format: "agents_md" | "cursorrules" | "json" = "agents_md",
  ) {
    return this.request<string | Record<string, unknown>>(
      "GET",
      `/memories/export?format=${format}`,
    );
  }

  // ── Activity Logs ──────────────────────────────────────────────

  async getActivityLogs(limit = 50, sessionId?: string) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (sessionId) params.set("session_id", sessionId);
    return this.request<{
      activityLogs: Array<{
        id: string;
        projectId: string;
        sessionId: string | null;
        action: string;
        toolName: string | null;
        memoryKey: string | null;
        details: string | null;
        createdBy: string | null;
        createdAt: unknown;
      }>;
    }>("GET", `/activity-logs?${params}`);
  }

  async logActivity(data: {
    action: string;
    sessionId?: string;
    toolName?: string;
    memoryKey?: string;
    details?: Record<string, unknown>;
  }) {
    return this.request("POST", "/activity-logs", data);
  }

  // ── Batch Mutations ─────────────────────────────────────────────

  async batchMutate(keys: string[], action: string, value?: unknown) {
    return this.request<{
      action: string;
      requested: number;
      matched: number;
      affected: number;
    }>("POST", "/memories/batch", { keys, action, value });
  }

  // ── Snapshots ──────────────────────────────────────────────────

  async listSnapshots(limit = 20) {
    return this.request<{
      snapshots: Array<{
        id: string;
        name: string;
        description: string | null;
        memoryCount: number;
        createdBy: string | null;
        createdAt: unknown;
      }>;
    }>("GET", `/memories/snapshots?limit=${limit}`);
  }

  async createSnapshot(name: string, description?: string) {
    return this.request<{
      snapshot: { id: string; name: string; memoryCount: number };
    }>("POST", "/memories/snapshots", { name, description });
  }

  // ── Feedback ───────────────────────────────────────────────────

  async feedbackMemory(key: string, helpful: boolean) {
    return this.request<{
      key: string;
      feedback: string;
      helpfulCount: number;
      unhelpfulCount: number;
    }>("POST", "/memories/feedback", { key, helpful });
  }

  // ── Lifecycle ──────────────────────────────────────────────────

  async runLifecycle(
    policies: string[],
    options?: {
      sessionLogMaxAgeDays?: number;
      accessThreshold?: number;
      feedbackThreshold?: number;
      mergedBranches?: string[];
      healthThreshold?: number;
      maxVersionsPerMemory?: number;
      activityLogMaxAgeDays?: number;
      archivePurgeDays?: number;
    },
  ) {
    return this.request<{
      results: Record<string, { affected: number; details?: string }>;
    }>("POST", "/memories/lifecycle", { policies, ...options });
  }

  // ── Validate References ────────────────────────────────────────

  async validateReferences(repoFiles: string[]) {
    return this.request<{
      totalMemoriesChecked: number;
      issuesFound: number;
      issues: Array<{
        key: string;
        referencedPaths: string[];
        missingPaths: string[];
      }>;
      recommendation: string;
    }>("POST", "/memories/validate", { repoFiles });
  }

  // ── Delta Bootstrap / Incremental Sync ──────────────────────────

  /** Incremental sync: fetch only changed memories since last sync, apply to local cache. */
  async incrementalSync(): Promise<{
    created: number;
    updated: number;
    deleted: number;
  }> {
    const lastSync = this.localCache.getLastSyncAt();
    const delta = await this.getDelta(lastSync);

    const upserts = [...delta.created, ...delta.updated];
    if (upserts.length > 0) {
      this.localCache.sync(upserts);
    }
    if (delta.deleted.length > 0) {
      this.localCache.removeKeys(delta.deleted);
    }

    return {
      created: delta.created.length,
      updated: delta.updated.length,
      deleted: delta.deleted.length,
    };
  }

  async getDelta(since: number) {
    return this.request<{
      created: Array<Record<string, unknown>>;
      updated: Array<Record<string, unknown>>;
      deleted: string[];
      since: number;
      now: number;
    }>("GET", `/memories/delta?since=${since}`);
  }

  // ── Graph Traversal ────────────────────────────────────────────────

  async traverseMemory(key: string, depth = 2) {
    return this.request<{
      root: string;
      nodes: Array<{ key: string; content: string; depth: number }>;
      edges: Array<{ from: string; to: string }>;
      maxDepthReached: boolean;
    }>(
      "GET",
      `/memories/traverse?key=${encodeURIComponent(key)}&depth=${depth}`,
    );
  }

  // ── Co-Access Patterns ────────────────────────────────────────────

  async getCoAccessed(key: string, limit = 5) {
    return this.request<{
      key: string;
      coAccessed: Array<{ key: string; count: number }>;
    }>(
      "GET",
      `/memories/co-accessed?key=${encodeURIComponent(key)}&limit=${limit}`,
    );
  }

  /** Fire-and-forget: fetch co-accessed keys and prefetch them into cache. */
  prefetchCoAccessed(key: string): void {
    this.getCoAccessed(key, 5)
      .then((result) => {
        for (const item of result.coAccessed) {
          if (item.key) {
            this.getMemory(item.key).catch(() => {});
          }
        }
      })
      .catch(() => {});
  }

  // ── Health Scores ────────────────────────────────────────────────

  async getHealthScores(limit = 50) {
    return this.request<{
      memories: Array<{
        key: string;
        healthScore: number;
        factors: {
          age: number;
          access: number;
          feedback: number;
          freshness: number;
        };
        priority: number;
        accessCount: number;
        lastAccessedAt: unknown;
        isPinned: boolean;
      }>;
    }>("GET", `/memories/health?limit=${limit}`);
  }

  // ── Memory Locking ──────────────────────────────────────────────

  async lockMemory(key: string, lockedBy?: string, ttlSeconds = 60) {
    return this.request<{
      lock: { key: string; lockedBy: string | null; expiresAt: unknown };
      acquired: boolean;
    }>("POST", "/memories/lock", { key, lockedBy, ttlSeconds });
  }

  async unlockMemory(key: string, lockedBy?: string) {
    return this.request<{ key: string; released: boolean }>(
      "DELETE",
      "/memories/lock",
      { key, lockedBy },
    );
  }

  // ── Analytics ───────────────────────────────────────────────────

  async getAnalytics() {
    return this.request<{
      totalMemories: number;
      totalAccessCount: number;
      averagePriority: number;
      averageHealthScore: number;
      mostAccessed: Array<{
        key: string;
        accessCount: number;
        lastAccessedAt: unknown;
      }>;
      leastAccessed: Array<{
        key: string;
        accessCount: number;
        lastAccessedAt: unknown;
      }>;
      neverAccessed: string[];
      byScope: { project: number; shared: number };
      byTag: Record<string, number>;
      pinnedCount: number;
      avgAge: number;
    }>("GET", "/memories/analytics");
  }

  // ── Change Digest ──────────────────────────────────────────────

  async getChanges(since: number, limit = 100) {
    return this.request<{
      since: number;
      until: number;
      summary: {
        created: number;
        updated: number;
        deleted: number;
        total: number;
      };
      changes: Array<{
        action: string;
        memoryKey: string | null;
        toolName: string | null;
        createdAt: unknown;
        details: string | null;
      }>;
    }>("GET", `/memories/changes?since=${since}&limit=${limit}`);
  }

  // ── Project Templates ─────────────────────────────────────────

  async listTemplates() {
    return this.request<{
      templates: Array<{
        id: string;
        name: string;
        description: string | null;
        data: Array<Record<string, unknown>>;
        isBuiltin: boolean;
        createdAt: unknown;
      }>;
    }>("GET", "/project-templates");
  }

  async createTemplate(
    name: string,
    description: string | undefined,
    data: Array<Record<string, unknown>>,
  ) {
    return this.request<{
      template: { id: string; name: string };
    }>("POST", "/project-templates", { name, description, data });
  }

  async applyTemplate(templateId: string) {
    return this.request<{
      applied: boolean;
      templateName: string;
      memoriesCreated: number;
      memoriesUpdated: number;
    }>("POST", "/project-templates", { apply: true, templateId });
  }

  // ── Lifecycle Schedule ────────────────────────────────────────

  async runScheduledLifecycle(options?: {
    sessionLogMaxAgeDays?: number;
    accessThreshold?: number;
    feedbackThreshold?: number;
  }) {
    return this.request<{
      scheduled: boolean;
      ranAt: string;
      results: Record<string, { affected: number }>;
    }>("POST", "/memories/lifecycle/schedule", options ?? {});
  }

  // ── Freshness Check ─────────────────────────────────────────────

  async checkFreshness() {
    return this.request<{
      memoryCount: number;
      latestUpdate: number | null;
      latestCreate: number | null;
      hash: string;
      checkedAt: number;
    }>("GET", "/memories/freshness");
  }

  // ── Rollback ────────────────────────────────────────────────────

  // ── Org Defaults ──────────────────────────────────────────────

  async listOrgDefaults() {
    return this.request<{
      defaults: Array<{
        id: string;
        orgId: string;
        key: string;
        content: string;
        metadata: Record<string, unknown> | null;
        priority: number | null;
        tags: string[] | null;
        createdBy: string | null;
        createdAt: unknown;
        updatedAt: unknown;
      }>;
    }>("GET", "/org-defaults");
  }

  async setOrgDefault(data: {
    key: string;
    content: string;
    metadata?: Record<string, unknown>;
    priority?: number;
    tags?: string[];
  }) {
    return this.request<{
      default: Record<string, unknown>;
    }>("POST", "/org-defaults", data);
  }

  async deleteOrgDefault(key: string) {
    return this.request<{ deleted: boolean; key: string }>(
      "DELETE",
      "/org-defaults",
      { key },
    );
  }

  async applyOrgDefaults() {
    return this.request<{
      applied: boolean;
      memoriesCreated: number;
      memoriesUpdated: number;
      totalDefaults: number;
    }>("POST", "/org-defaults/apply");
  }

  async rollbackMemory(key: string, steps = 1) {
    return this.request<{
      key: string;
      rolledBackTo: number;
      stepsBack: number;
      previousContent: string;
      restoredContent: string;
      newVersion: number;
    }>("POST", "/memories/rollback", { key, steps });
  }

  // ── Cross-Project Org Search ────────────────────────────────────

  async searchOrgMemories(query: string, limit = 50) {
    const params = new URLSearchParams({
      q: query,
      limit: String(limit),
    });
    return this.request<{
      results: Array<{
        key: string;
        contentPreview: string;
        projectSlug: string;
        projectName: string;
        priority: number | null;
        tags: string[] | null;
        accessCount: number;
        updatedAt: unknown;
      }>;
      grouped: Record<
        string,
        Array<{
          key: string;
          contentPreview: string;
          projectSlug: string;
          projectName: string;
        }>
      >;
      projectsSearched: number;
      totalMatches: number;
    }>("GET", `/memories/search-org?${params}`);
  }

  // ── Cross-Project Context Diff ──────────────────────────────────

  async orgContextDiff(projectA: string, projectB: string) {
    const params = new URLSearchParams({
      project_a: projectA,
      project_b: projectB,
    });
    return this.request<{
      projectA: string;
      projectB: string;
      onlyInA: Array<{ key: string; priority: number | null }>;
      onlyInB: Array<{ key: string; priority: number | null }>;
      common: Array<{ key: string; contentMatch: boolean }>;
      stats: {
        totalA: number;
        totalB: number;
        onlyInA: number;
        onlyInB: number;
        common: number;
        contentMatches: number;
        contentDiffers: number;
      };
    }>("GET", `/memories/org-diff?${params}`);
  }
}
