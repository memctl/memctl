"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Plus, Trash2, ExternalLink, Clock, Webhook,
} from "lucide-react";

interface WebhookItem {
  id: string;
  url: string;
  events: string | null;
  digestIntervalMinutes: number | null;
  isActive: boolean | null;
  secret: string | null;
  lastSentAt: string | null;
  createdAt: string;
  projectSlug: string;
  projectName: string;
  consecutiveFailures: number;
}

interface WebhookManagerProps {
  webhooks: WebhookItem[];
  projects: { slug: string; name: string }[];
  orgSlug: string;
}

function relativeTime(d: string | null): string {
  if (!d) return "never";
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function safeParseArray(s: string | null): string[] {
  if (!s) return [];
  try { const parsed = JSON.parse(s); return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
}

export function WebhookManager({ webhooks, projects, orgSlug }: WebhookManagerProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [createUrl, setCreateUrl] = useState("");
  const [createProject, setCreateProject] = useState(projects[0]?.slug ?? "");
  const [createInterval, setCreateInterval] = useState("60");
  const [createSecret, setCreateSecret] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!createUrl || !createProject) return;
    setLoading(true);
    try {
      await fetch("/api/v1/webhooks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Org-Slug": orgSlug,
          "X-Project-Slug": createProject,
        },
        body: JSON.stringify({
          url: createUrl,
          digestIntervalMinutes: parseInt(createInterval),
          secret: createSecret || undefined,
          events: ["memory.created", "memory.updated", "memory.deleted"],
        }),
      });
      window.location.reload();
    } catch { /* silent */ }
    setLoading(false);
  };

  const handleDelete = async (webhook: WebhookItem) => {
    if (!confirm(`Delete webhook to ${webhook.url}?`)) return;
    setLoading(true);
    try {
      await fetch("/api/v1/webhooks", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "X-Org-Slug": orgSlug,
          "X-Project-Slug": webhook.projectSlug,
        },
        body: JSON.stringify({ webhookId: webhook.id }),
      });
      window.location.reload();
    } catch { /* silent */ }
    setLoading(false);
  };

  return (
    <div>
      {/* Stats */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="dash-card p-3">
          <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">Webhooks</div>
          <div className="mt-1 font-mono text-xl font-bold text-[var(--landing-text)]">{webhooks.length}</div>
        </div>
        <div className="dash-card p-3">
          <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">Active</div>
          <div className="mt-1 font-mono text-xl font-bold text-emerald-400">{webhooks.filter((w) => w.isActive).length}</div>
        </div>
        <div className="dash-card p-3">
          <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">Failed</div>
          <div className="mt-1 font-mono text-xl font-bold text-red-400">{webhooks.filter((w) => w.consecutiveFailures >= 5).length}</div>
        </div>
      </div>

      {/* Actions */}
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-xs text-[var(--landing-text-tertiary)]">{webhooks.length} webhook{webhooks.length !== 1 ? "s" : ""} configured</span>
        <Button size="sm" onClick={() => setShowCreate(true)} className="h-7 gap-1 bg-[#F97316] text-white text-xs hover:bg-[#EA580C]">
          <Plus className="h-3 w-3" /> Add Webhook
        </Button>
      </div>

      {/* Table */}
      <div className="dash-card overflow-hidden">
        {webhooks.length === 0 ? (
          <div className="py-8 text-center">
            <Webhook className="mx-auto mb-2 h-6 w-6 text-[var(--landing-text-tertiary)]" />
            <p className="font-mono text-xs text-[var(--landing-text-tertiary)]">No webhooks configured</p>
            <p className="text-[10px] text-[var(--landing-text-tertiary)]">Add a webhook to receive notifications when memories change.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-[var(--landing-border)] bg-[var(--landing-code-bg)] hover:bg-[var(--landing-code-bg)]">
                <TableHead className="font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">URL</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">Project</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">Interval</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">Events</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">Status</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">Last Sent</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">Failures</TableHead>
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {webhooks.map((w) => (
                <TableRow key={w.id} className="border-[var(--landing-border)]">
                  <TableCell className="font-mono text-[11px] text-[#F97316] max-w-[200px] truncate">
                    <span className="flex items-center gap-1">
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      {w.url}
                    </span>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="border-[var(--landing-border)] text-[9px]">{w.projectName}</Badge></TableCell>
                  <TableCell className="font-mono text-[11px] text-[var(--landing-text-tertiary)]">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{w.digestIntervalMinutes}m</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-0.5">
                      {safeParseArray(w.events).map((ev) => (
                        <Badge key={ev} variant="outline" className="border-[var(--landing-border)] text-[8px] h-4 px-1">{ev.replace("memory.", "")}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {w.isActive ? (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] text-emerald-400">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> active
                      </span>
                    ) : !w.isActive && w.consecutiveFailures >= 5 ? (
                      <span className="inline-flex items-center gap-1 rounded bg-red-500/10 px-1.5 py-0.5 font-mono text-[10px] text-red-400">disabled (breaker)</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-red-500/10 px-1.5 py-0.5 font-mono text-[10px] text-red-400">disabled</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">{relativeTime(w.lastSentAt)}</TableCell>
                  <TableCell className="font-mono text-[11px]">
                    {w.consecutiveFailures > 0 ? (
                      <span className={w.consecutiveFailures >= 5 ? "text-red-400" : "text-amber-400"}>{w.consecutiveFailures}</span>
                    ) : (
                      <span className="text-[var(--landing-text-tertiary)]">0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(w)} className="h-6 w-6 p-0 text-red-500 hover:text-red-400">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md bg-[var(--landing-surface)]">
          <DialogHeader>
            <DialogTitle className="text-sm">Add Webhook</DialogTitle>
            <DialogDescription className="text-[11px]">Receive digest notifications when memories change.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">Endpoint URL</label>
              <Input
                placeholder="https://example.com/webhook"
                value={createUrl}
                onChange={(e) => setCreateUrl(e.target.value)}
                className="mt-0.5 h-8 font-mono text-xs border-[var(--landing-border)] bg-[var(--landing-surface-2)]"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">Project</label>
              <Select value={createProject} onValueChange={setCreateProject}>
                <SelectTrigger className="mt-0.5 h-8 w-full text-xs border-[var(--landing-border)] bg-[var(--landing-surface-2)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--landing-surface)] border-[var(--landing-border)]">
                  {projects.map((p) => <SelectItem key={p.slug} value={p.slug} className="text-xs">{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">Digest Interval (min 60 minutes)</label>
              <Select value={createInterval} onValueChange={setCreateInterval}>
                <SelectTrigger className="mt-0.5 h-8 w-full text-xs border-[var(--landing-border)] bg-[var(--landing-surface-2)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--landing-surface)] border-[var(--landing-border)]">
                  <SelectItem value="60" className="text-xs">Every hour</SelectItem>
                  <SelectItem value="360" className="text-xs">Every 6 hours</SelectItem>
                  <SelectItem value="720" className="text-xs">Every 12 hours</SelectItem>
                  <SelectItem value="1440" className="text-xs">Daily</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">HMAC Secret (optional)</label>
              <Input
                placeholder="your-webhook-secret"
                value={createSecret}
                onChange={(e) => setCreateSecret(e.target.value)}
                className="mt-0.5 h-8 font-mono text-xs border-[var(--landing-border)] bg-[var(--landing-surface-2)]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} className="border-[var(--landing-border)]">Cancel</Button>
            <Button onClick={handleCreate} disabled={loading || !createUrl} className="bg-[#F97316] text-white hover:bg-[#EA580C]">
              {loading ? "Creating…" : "Create Webhook"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
