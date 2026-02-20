export class ApiClient {
  private baseUrl: string;
  private token: string;
  private org: string;
  private project: string;

  constructor(config: {
    baseUrl: string;
    token: string;
    org: string;
    project: string;
  }) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.token = config.token;
    this.org = config.org;
    this.project = config.project;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        "X-Org-Slug": this.org,
        "X-Project-Slug": this.project,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error ${res.status}: ${text}`);
    }

    return res.json() as Promise<T>;
  }

  // ── Memory CRUD ──────────────────────────────────────────────

  async storeMemory(
    key: string,
    content: string,
    metadata?: Record<string, unknown>,
    options?: { scope?: string; priority?: number; tags?: string[]; expiresAt?: number },
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

  async searchMemories(query: string, limit = 20, options?: { tags?: string; sort?: string; includeArchived?: boolean }) {
    const params = new URLSearchParams({
      q: query,
      limit: String(limit),
    });
    if (options?.tags) params.set("tags", options.tags);
    if (options?.sort) params.set("sort", options.sort);
    if (options?.includeArchived) params.set("include_archived", "true");
    return this.request("GET", `/memories?${params}`);
  }

  async listMemories(limit = 100, offset = 0, options?: { sort?: string; includeArchived?: boolean; tags?: string }) {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    if (options?.sort) params.set("sort", options.sort);
    if (options?.includeArchived) params.set("include_archived", "true");
    if (options?.tags) params.set("tags", options.tags);
    return this.request("GET", `/memories?${params}`);
  }

  async getMemoryCapacity() {
    return this.request<{
      used: number;
      limit: number;
      orgUsed: number;
      orgLimit: number;
      isFull: boolean;
      isSoftFull: boolean;
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
    }>("GET", `/memories/versions?key=${encodeURIComponent(key)}&limit=${limit}`);
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
    }>("GET", `/memories/suggest-cleanup?stale_days=${staleDays}&limit=${limit}`);
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
      diff: Array<{ type: "add" | "remove" | "same"; line: string; lineNumber?: number }>;
      summary: { added: number; removed: number; unchanged: number };
    }>("GET", `/memories/diff?${params}`);
  }

  // ── Export ─────────────────────────────────────────────────────

  async exportMemories(format: "agents_md" | "cursorrules" | "json" = "agents_md") {
    return this.request<string>("GET", `/memories/export?format=${format}`);
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
}
