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

  async storeMemory(key: string, content: string, metadata?: Record<string, unknown>) {
    return this.request("POST", "/memories", { key, content, metadata });
  }

  async getMemory(key: string) {
    return this.request("GET", `/memories/${encodeURIComponent(key)}`);
  }

  async searchMemories(query: string, limit = 20) {
    return this.request("GET", `/memories?q=${encodeURIComponent(query)}&limit=${limit}`);
  }

  async listMemories(limit = 100, offset = 0) {
    return this.request("GET", `/memories?limit=${limit}&offset=${offset}`);
  }

  async getMemoryCapacity() {
    return this.request<{
      used: number;
      limit: number;
      isFull: boolean;
      usageRatio: number | null;
    }>("GET", "/memories/capacity");
  }

  async deleteMemory(key: string) {
    return this.request("DELETE", `/memories/${encodeURIComponent(key)}`);
  }

  async updateMemory(key: string, content?: string, metadata?: Record<string, unknown>) {
    return this.request("PATCH", `/memories/${encodeURIComponent(key)}`, {
      content,
      metadata,
    });
  }
}
