"use client";

import { useState, useMemo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Eye,
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
  History,
  Tag,
  Download,
  Upload,
  ChevronDown,
  ChevronUp,
  Star,
} from "lucide-react";

interface MemoryItem {
  id: string;
  key: string;
  content: string;
  metadata: string | null;
  priority: number | null;
  tags: string | null;
  archivedAt: string | number | null;
  expiresAt: string | number | null;
  createdAt: string | number;
  updatedAt: string | number;
}

interface MemoryVersion {
  id: string;
  version: number;
  content: string;
  metadata: string | null;
  changeType: string;
  createdAt: string | number;
}

interface MemoryBrowserProps {
  memories: MemoryItem[];
  orgSlug: string;
  projectSlug: string;
}

// Agent context type info for grouping
const AGENT_CONTEXT_TYPES: Record<string, { label: string; prefix: string }> = {
  coding_style: { label: "Coding Style", prefix: "agent/context/coding_style/" },
  folder_structure: { label: "Folder Structure", prefix: "agent/context/folder_structure/" },
  file_map: { label: "File Map", prefix: "agent/context/file_map/" },
  architecture: { label: "Architecture", prefix: "agent/context/architecture/" },
  workflow: { label: "Workflow", prefix: "agent/context/workflow/" },
  testing: { label: "Testing", prefix: "agent/context/testing/" },
  branch_plan: { label: "Branch Plans", prefix: "agent/context/branch_plan/" },
  constraints: { label: "Constraints", prefix: "agent/context/constraints/" },
};

function getMemoryType(key: string): string {
  for (const [type, info] of Object.entries(AGENT_CONTEXT_TYPES)) {
    if (key.startsWith(info.prefix)) return type;
  }
  return "other";
}

function parseTags(tagsStr: string | null): string[] {
  if (!tagsStr) return [];
  try {
    const parsed = JSON.parse(tagsStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatDate(d: string | number | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function MemoryBrowser({ memories, orgSlug, projectSlug }: MemoryBrowserProps) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState<MemoryItem | null>(null);
  const [viewMode, setViewMode] = useState<"view" | "edit" | "history" | null>(null);
  const [editContent, setEditContent] = useState("");
  const [versions, setVersions] = useState<MemoryVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [sortField, setSortField] = useState<"key" | "priority" | "updated">("updated");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Group memories by type
  const grouped = useMemo(() => {
    const groups: Record<string, MemoryItem[]> = { other: [] };
    for (const type of Object.keys(AGENT_CONTEXT_TYPES)) {
      groups[type] = [];
    }
    for (const m of memories) {
      const type = getMemoryType(m.key);
      if (!groups[type]) groups[type] = [];
      groups[type].push(m);
    }
    return groups;
  }, [memories]);

  // Filter and sort
  const filteredMemories = useMemo(() => {
    let items = activeTab === "all" ? memories : (grouped[activeTab] ?? []);

    if (!showArchived) {
      items = items.filter((m) => !m.archivedAt);
    }

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (m) =>
          m.key.toLowerCase().includes(q) ||
          m.content.toLowerCase().includes(q) ||
          parseTags(m.tags).some((t) => t.toLowerCase().includes(q)),
      );
    }

    items = [...items].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "key":
          cmp = a.key.localeCompare(b.key);
          break;
        case "priority":
          cmp = (a.priority ?? 0) - (b.priority ?? 0);
          break;
        case "updated":
          cmp =
            new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });

    return items;
  }, [memories, grouped, activeTab, showArchived, search, sortField, sortDir]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return null;
    return sortDir === "desc" ? (
      <ChevronDown className="inline h-3 w-3" />
    ) : (
      <ChevronUp className="inline h-3 w-3" />
    );
  };

  const openView = (m: MemoryItem) => {
    setSelectedMemory(m);
    setViewMode("view");
  };

  const openEdit = (m: MemoryItem) => {
    setSelectedMemory(m);
    setEditContent(m.content);
    setViewMode("edit");
  };

  const openHistory = async (m: MemoryItem) => {
    setSelectedMemory(m);
    setViewMode("history");
    setLoadingVersions(true);
    try {
      const res = await fetch(
        `/api/v1/memories/versions?key=${encodeURIComponent(m.key)}`,
        {
          headers: {
            "X-Org-Slug": orgSlug,
            "X-Project-Slug": projectSlug,
          },
        },
      );
      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions ?? []);
      }
    } catch {
      // handle silently
    }
    setLoadingVersions(false);
  };

  const handleSave = async () => {
    if (!selectedMemory) return;
    setActionLoading(true);
    try {
      await fetch(
        `/api/v1/memories/${encodeURIComponent(selectedMemory.key)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-Org-Slug": orgSlug,
            "X-Project-Slug": projectSlug,
          },
          body: JSON.stringify({ content: editContent }),
        },
      );
      // Refresh page to get updated data
      window.location.reload();
    } catch {
      // handle silently
    }
    setActionLoading(false);
  };

  const handleArchive = async (m: MemoryItem, archive: boolean) => {
    setActionLoading(true);
    try {
      await fetch("/api/v1/memories/archive", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Org-Slug": orgSlug,
          "X-Project-Slug": projectSlug,
        },
        body: JSON.stringify({ key: m.key, archive }),
      });
      window.location.reload();
    } catch {
      // handle silently
    }
    setActionLoading(false);
  };

  const handleDelete = async (m: MemoryItem) => {
    if (!confirm(`Delete memory "${m.key}"? This cannot be undone.`)) return;
    setActionLoading(true);
    try {
      await fetch(`/api/v1/memories/${encodeURIComponent(m.key)}`, {
        method: "DELETE",
        headers: {
          "X-Org-Slug": orgSlug,
          "X-Project-Slug": projectSlug,
        },
      });
      window.location.reload();
    } catch {
      // handle silently
    }
    setActionLoading(false);
  };

  const handleExport = () => {
    const data = filteredMemories.map((m) => ({
      key: m.key,
      content: m.content,
      metadata: m.metadata ? JSON.parse(m.metadata) : null,
      priority: m.priority,
      tags: parseTags(m.tags),
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `memories-${projectSlug}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const data = JSON.parse(text) as Array<{
        key: string;
        content: string;
        metadata?: Record<string, unknown>;
        priority?: number;
        tags?: string[];
      }>;
      setActionLoading(true);
      for (const item of data) {
        await fetch("/api/v1/memories", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Org-Slug": orgSlug,
            "X-Project-Slug": projectSlug,
          },
          body: JSON.stringify(item),
        });
      }
      window.location.reload();
    } catch {
      alert("Invalid JSON file");
    }
    setActionLoading(false);
  };

  // Count per type for tabs
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [type, items] of Object.entries(grouped)) {
      counts[type] = items.filter((m) => showArchived || !m.archivedAt).length;
    }
    return counts;
  }, [grouped, showArchived]);

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--landing-text-tertiary)]" />
          <Input
            placeholder="Search memories by key, content, or tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 border-[var(--landing-border)] bg-[var(--landing-surface)] font-mono text-sm"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowArchived(!showArchived)}
          className="gap-1.5 border-[var(--landing-border)] text-xs"
        >
          <Archive className="h-3.5 w-3.5" />
          {showArchived ? "Hide Archived" : "Show Archived"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          className="gap-1.5 border-[var(--landing-border)] text-xs"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
        <label>
          <Button
            variant="outline"
            size="sm"
            asChild
            className="gap-1.5 border-[var(--landing-border)] text-xs cursor-pointer"
          >
            <span>
              <Upload className="h-3.5 w-3.5" />
              Import
            </span>
          </Button>
          <input
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
        </label>
      </div>

      {/* Type tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4 flex-wrap bg-[var(--landing-surface)]">
          <TabsTrigger value="all" className="text-xs">
            All ({memories.filter((m) => showArchived || !m.archivedAt).length})
          </TabsTrigger>
          {Object.entries(AGENT_CONTEXT_TYPES).map(([type, info]) =>
            (typeCounts[type] ?? 0) > 0 ? (
              <TabsTrigger key={type} value={type} className="text-xs">
                {info.label} ({typeCounts[type]})
              </TabsTrigger>
            ) : null,
          )}
          {(typeCounts["other"] ?? 0) > 0 && (
            <TabsTrigger value="other" className="text-xs">
              Other ({typeCounts["other"]})
            </TabsTrigger>
          )}
        </TabsList>

        {/* Content for all tabs shares the same table */}
        <div className="dash-card overflow-hidden">
          {filteredMemories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="mb-3 h-8 w-8 text-[var(--landing-text-tertiary)]" />
              <p className="mb-1 font-mono text-sm font-medium text-[var(--landing-text)]">
                No memories found
              </p>
              <p className="text-xs text-[var(--landing-text-tertiary)]">
                {search
                  ? "Try a different search term."
                  : "Use the MCP server to store memories."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--landing-border)] bg-[var(--landing-code-bg)] hover:bg-[var(--landing-code-bg)]">
                  <TableHead
                    className="cursor-pointer font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]"
                    onClick={() => toggleSort("key")}
                  >
                    Key <SortIcon field="key" />
                  </TableHead>
                  <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                    Content
                  </TableHead>
                  <TableHead
                    className="cursor-pointer font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]"
                    onClick={() => toggleSort("priority")}
                  >
                    Priority <SortIcon field="priority" />
                  </TableHead>
                  <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                    Tags
                  </TableHead>
                  <TableHead
                    className="cursor-pointer font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]"
                    onClick={() => toggleSort("updated")}
                  >
                    Updated <SortIcon field="updated" />
                  </TableHead>
                  <TableHead className="w-[120px] font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMemories.map((m) => (
                  <TableRow
                    key={m.id}
                    className={`border-[var(--landing-border)] ${m.archivedAt ? "opacity-50" : ""}`}
                  >
                    <TableCell className="max-w-[200px] truncate font-mono text-sm font-medium text-[#F97316]">
                      {m.key}
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate font-mono text-xs text-[var(--landing-text-secondary)]">
                      {m.content.length > 120
                        ? m.content.slice(0, 120) + "..."
                        : m.content}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {(m.priority ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1 text-[#F97316]">
                          <Star className="h-3 w-3" />
                          {m.priority}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {parseTags(m.tags).map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="border-[var(--landing-border)] text-[10px]"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-[var(--landing-text-tertiary)]">
                      {formatDate(m.updatedAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openView(m)}
                          className="h-7 w-7 p-0"
                          title="View"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(m)}
                          className="h-7 w-7 p-0"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openHistory(m)}
                          className="h-7 w-7 p-0"
                          title="History"
                        >
                          <History className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleArchive(m, !m.archivedAt)
                          }
                          className="h-7 w-7 p-0"
                          title={m.archivedAt ? "Unarchive" : "Archive"}
                        >
                          {m.archivedAt ? (
                            <ArchiveRestore className="h-3.5 w-3.5" />
                          ) : (
                            <Archive className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(m)}
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Tabs>

      {/* View Dialog */}
      <Dialog open={viewMode === "view"} onOpenChange={() => setViewMode(null)}>
        <DialogContent className="max-w-2xl bg-[var(--landing-surface)]">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm text-[#F97316]">
              {selectedMemory?.key}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {selectedMemory?.priority
                ? `Priority: ${selectedMemory.priority} · `
                : ""}
              Updated: {formatDate(selectedMemory?.updatedAt ?? "")}
              {parseTags(selectedMemory?.tags ?? null).length > 0 && (
                <span className="ml-2">
                  Tags:{" "}
                  {parseTags(selectedMemory?.tags ?? null).join(", ")}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto rounded-md bg-[var(--landing-code-bg)] p-4">
            <pre className="whitespace-pre-wrap font-mono text-xs text-[var(--landing-text-secondary)]">
              {selectedMemory?.content}
            </pre>
          </div>
          {selectedMemory?.metadata && (
            <details className="text-xs">
              <summary className="cursor-pointer font-mono text-[var(--landing-text-tertiary)]">
                Metadata
              </summary>
              <pre className="mt-2 overflow-auto rounded bg-[var(--landing-code-bg)] p-2 font-mono text-[var(--landing-text-tertiary)]">
                {JSON.stringify(
                  JSON.parse(selectedMemory.metadata),
                  null,
                  2,
                )}
              </pre>
            </details>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={viewMode === "edit"} onOpenChange={() => setViewMode(null)}>
        <DialogContent className="max-w-2xl bg-[var(--landing-surface)]">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">
              Edit: {selectedMemory?.key}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Changes will be versioned automatically.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="min-h-[300px] font-mono text-xs border-[var(--landing-border)] bg-[var(--landing-code-bg)]"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setViewMode(null)}
              className="border-[var(--landing-border)]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={actionLoading}
              className="bg-[#F97316] text-white hover:bg-[#EA580C]"
            >
              {actionLoading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog
        open={viewMode === "history"}
        onOpenChange={() => setViewMode(null)}
      >
        <DialogContent className="max-w-2xl bg-[var(--landing-surface)]">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">
              History: {selectedMemory?.key}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Version history for this memory.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            {loadingVersions ? (
              <p className="py-8 text-center text-xs text-[var(--landing-text-tertiary)]">
                Loading versions...
              </p>
            ) : versions.length === 0 ? (
              <p className="py-8 text-center text-xs text-[var(--landing-text-tertiary)]">
                No version history available.
              </p>
            ) : (
              <div className="space-y-3">
                {versions.map((v) => (
                  <div
                    key={v.id}
                    className="rounded-lg border border-[var(--landing-border)] p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-mono text-xs font-medium text-[var(--landing-text)]">
                        v{v.version}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="border-[var(--landing-border)] text-[10px]"
                        >
                          {v.changeType}
                        </Badge>
                        <span className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">
                          {formatDate(v.createdAt)}
                        </span>
                      </div>
                    </div>
                    <pre className="max-h-32 overflow-auto rounded bg-[var(--landing-code-bg)] p-2 font-mono text-[10px] text-[var(--landing-text-secondary)]">
                      {v.content.length > 500
                        ? v.content.slice(0, 500) + "..."
                        : v.content}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
