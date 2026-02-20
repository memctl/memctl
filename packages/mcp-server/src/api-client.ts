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
    options?: { priority?: number; tags?: string[]; expiresAt?: number },
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
}
