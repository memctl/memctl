"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Search, Eye, Pencil, Trash2, Archive, ArchiveRestore, History, Download, Upload,
  ChevronDown, ChevronUp, Star, Pin, Filter, X, CheckCheck, Tag, SquareStack,
  ArrowUpDown, Keyboard, Zap,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface MemoryItem {
  id: string;
  key: string;
  content: string;
  metadata: string | null;
  priority: number | null;
  tags: string | null;
  pinnedAt: string | number | null;
  archivedAt: string | number | null;
  expiresAt: string | number | null;
  accessCount?: number;
  lastAccessedAt?: string | number | null;
  helpfulCount?: number;
  unhelpfulCount?: number;
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

// ── Constants ──────────────────────────────────────────────────────────────

const AGENT_CONTEXT_TYPES: Record<string, { label: string; prefix: string }> = {
  coding_style: { label: "Style", prefix: "agent/context/coding_style/" },
  folder_structure: { label: "Folders", prefix: "agent/context/folder_structure/" },
  file_map: { label: "Files", prefix: "agent/context/file_map/" },
  architecture: { label: "Arch", prefix: "agent/context/architecture/" },
  workflow: { label: "Workflow", prefix: "agent/context/workflow/" },
  testing: { label: "Testing", prefix: "agent/context/testing/" },
  branch_plan: { label: "Branches", prefix: "agent/context/branch_plan/" },
  constraints: { label: "Rules", prefix: "agent/context/constraints/" },
};

type SortField = "key" | "priority" | "updated" | "relevance" | "accessCount";

// ── Helpers ────────────────────────────────────────────────────────────────

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
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function relativeTime(d: string | number | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : new Date(d);
  const now = Date.now();
  const diff = now - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  return formatDate(d);
}

function computeRelevance(m: MemoryItem): number {
  const basePriority = Math.max(m.priority ?? 1, 1) / 100;
  const usageFactor = 1 + Math.log(1 + (m.accessCount ?? 0));
  const daysSinceAccess = m.lastAccessedAt
    ? (Date.now() - new Date(m.lastAccessedAt).getTime()) / 86_400_000
    : (Date.now() - new Date(m.updatedAt).getTime()) / 86_400_000;
  const timeFactor = Math.exp(-0.03 * Math.max(daysSinceAccess, 0));
  const helpful = (m.helpfulCount ?? 0);
  const unhelpful = (m.unhelpfulCount ?? 0);
  const feedbackFactor = helpful + unhelpful > 0 ? (1 + helpful) / (1 + helpful + unhelpful) : 1;
  const pinBoost = m.pinnedAt ? 1.5 : 1;
  const raw = basePriority * usageFactor * timeFactor * feedbackFactor * pinBoost * 100;
  return Math.min(100, Math.max(0, Math.round(raw * 100) / 100));
}

function getRelevanceBucket(score: number): { label: string; color: string; bg: string } {
  if (score >= 60) return { label: "HIGH", color: "text-emerald-400", bg: "bg-emerald-500/20" };
  if (score >= 30) return { label: "MED", color: "text-amber-400", bg: "bg-amber-500/20" };
  if (score >= 10) return { label: "LOW", color: "text-orange-400", bg: "bg-orange-500/20" };
  return { label: "STALE", color: "text-red-400", bg: "bg-red-500/20" };
}

// ── Component ──────────────────────────────────────────────────────────────

export function MemoryBrowser({ memories, orgSlug, projectSlug }: MemoryBrowserProps) {
  // State
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState<MemoryItem | null>(null);
  const [viewMode, setViewMode] = useState<"view" | "edit" | "history" | null>(null);
  const [editContent, setEditContent] = useState("");
  const [versions, setVersions] = useState<MemoryVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [sortField, setSortField] = useState<SortField>("relevance");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Multi-select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Advanced filters
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterTag, setFilterTag] = useState<string>("");
  const [filterPriorityRange, setFilterPriorityRange] = useState<[number, number]>([0, 100]);
  const [filterRelevance, setFilterRelevance] = useState<string>("all");
  const [filterPinned, setFilterPinned] = useState<string>("all");

  // Inline editing
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineEditContent, setInlineEditContent] = useState("");

  // Keyboard shortcuts
  const [showShortcuts, setShowShortcuts] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // All unique tags for filter dropdown
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const m of memories) {
      for (const t of parseTags(m.tags)) tags.add(t);
    }
    return [...tags].sort();
  }, [memories]);

  // Group memories by type
  const grouped = useMemo(() => {
    const groups: Record<string, MemoryItem[]> = { other: [] };
    for (const type of Object.keys(AGENT_CONTEXT_TYPES)) groups[type] = [];
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

    if (!showArchived) items = items.filter((m) => !m.archivedAt);

    if (search) {
      const q = search.toLowerCase();
      items = items.filter((m) =>
        m.key.toLowerCase().includes(q) ||
        m.content.toLowerCase().includes(q) ||
        parseTags(m.tags).some((t) => t.toLowerCase().includes(q)),
      );
    }

    // Advanced filters
    if (filterTag) {
      items = items.filter((m) => parseTags(m.tags).includes(filterTag));
    }
    if (filterPriorityRange[0] > 0 || filterPriorityRange[1] < 100) {
      items = items.filter((m) => {
        const p = m.priority ?? 0;
        return p >= filterPriorityRange[0] && p <= filterPriorityRange[1];
      });
    }
    if (filterRelevance !== "all") {
      items = items.filter((m) => {
        const score = computeRelevance(m);
        switch (filterRelevance) {
          case "high": return score >= 60;
          case "medium": return score >= 30 && score < 60;
          case "low": return score >= 10 && score < 30;
          case "stale": return score < 10;
          default: return true;
        }
      });
    }
    if (filterPinned === "pinned") items = items.filter((m) => m.pinnedAt);
    if (filterPinned === "unpinned") items = items.filter((m) => !m.pinnedAt);

    items = [...items].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "key": cmp = a.key.localeCompare(b.key); break;
        case "priority": cmp = (a.priority ?? 0) - (b.priority ?? 0); break;
        case "updated": cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(); break;
        case "relevance": cmp = computeRelevance(a) - computeRelevance(b); break;
        case "accessCount": cmp = (a.accessCount ?? 0) - (b.accessCount ?? 0); break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });

    return items;
  }, [memories, grouped, activeTab, showArchived, search, sortField, sortDir, filterTag, filterPriorityRange, filterRelevance, filterPinned]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      switch (e.key) {
        case "j": e.preventDefault(); setFocusedIndex((i) => Math.min(i + 1, filteredMemories.length - 1)); break;
        case "k": e.preventDefault(); setFocusedIndex((i) => Math.max(i - 1, 0)); break;
        case " ": {
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < filteredMemories.length) {
            const m = filteredMemories[focusedIndex];
            setSelectedIds((prev) => {
              const next = new Set(prev);
              if (next.has(m.id)) next.delete(m.id); else next.add(m.id);
              return next;
            });
          }
          break;
        }
        case "Enter": {
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < filteredMemories.length) {
            openView(filteredMemories[focusedIndex]);
          }
          break;
        }
        case "e": {
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < filteredMemories.length) {
            const m = filteredMemories[focusedIndex];
            setInlineEditId(m.id);
            setInlineEditContent(m.content);
          }
          break;
        }
        case "d": {
          if (focusedIndex >= 0 && focusedIndex < filteredMemories.length) {
            e.preventDefault();
            handleDelete(filteredMemories[focusedIndex]);
          }
          break;
        }
        case "p": {
          if (focusedIndex >= 0 && focusedIndex < filteredMemories.length) {
            e.preventDefault();
            handlePin(filteredMemories[focusedIndex]);
          }
          break;
        }
        case "/": {
          e.preventDefault();
          searchRef.current?.focus();
          break;
        }
        case "Escape": {
          setSelectedIds(new Set());
          setFocusedIndex(-1);
          setInlineEditId(null);
          break;
        }
        case "?": {
          e.preventDefault();
          setShowShortcuts((v) => !v);
          break;
        }
        case "a": {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setSelectedIds(new Set(filteredMemories.map((m) => m.id)));
          }
          break;
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusedIndex, filteredMemories]);

  // Scroll focused row into view
  useEffect(() => {
    if (focusedIndex >= 0) {
      const row = tableRef.current?.querySelector(`[data-row-index="${focusedIndex}"]`);
      row?.scrollIntoView({ block: "nearest" });
    }
  }, [focusedIndex]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="inline h-2.5 w-2.5 opacity-30" />;
    return sortDir === "desc" ? <ChevronDown className="inline h-3 w-3 text-[#F97316]" /> : <ChevronUp className="inline h-3 w-3 text-[#F97316]" />;
  };

  // Selection helpers
  const allSelected = filteredMemories.length > 0 && filteredMemories.every((m) => selectedIds.has(m.id));
  const someSelected = selectedIds.size > 0;

  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredMemories.map((m) => m.id)));
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // API actions
  const apiHeaders = {
    "Content-Type": "application/json",
    "X-Org-Slug": orgSlug,
    "X-Project-Slug": projectSlug,
  };

  const openView = (m: MemoryItem) => { setSelectedMemory(m); setViewMode("view"); };

  const openEdit = (m: MemoryItem) => { setSelectedMemory(m); setEditContent(m.content); setViewMode("edit"); };

  const openHistory = async (m: MemoryItem) => {
    setSelectedMemory(m); setViewMode("history"); setLoadingVersions(true);
    try {
      const res = await fetch(`/api/v1/memories/versions?key=${encodeURIComponent(m.key)}`, { headers: { "X-Org-Slug": orgSlug, "X-Project-Slug": projectSlug } });
      if (res.ok) { const data = await res.json(); setVersions(data.versions ?? []); }
    } catch { /* silent */ }
    setLoadingVersions(false);
  };

  const handleSave = async () => {
    if (!selectedMemory) return;
    setActionLoading(true);
    try {
      await fetch(`/api/v1/memories/${encodeURIComponent(selectedMemory.key)}`, { method: "PATCH", headers: apiHeaders, body: JSON.stringify({ content: editContent }) });
      window.location.reload();
    } catch { /* silent */ }
    setActionLoading(false);
  };

  const handleInlineSave = async (m: MemoryItem) => {
    setActionLoading(true);
    try {
      await fetch(`/api/v1/memories/${encodeURIComponent(m.key)}`, { method: "PATCH", headers: apiHeaders, body: JSON.stringify({ content: inlineEditContent }) });
      window.location.reload();
    } catch { /* silent */ }
    setActionLoading(false);
  };

  const handleArchive = async (m: MemoryItem, archive: boolean) => {
    setActionLoading(true);
    try {
      await fetch("/api/v1/memories/archive", { method: "POST", headers: apiHeaders, body: JSON.stringify({ key: m.key, archive }) });
      window.location.reload();
    } catch { /* silent */ }
    setActionLoading(false);
  };

  const handleDelete = async (m: MemoryItem) => {
    if (!confirm(`Delete "${m.key}"?`)) return;
    setActionLoading(true);
    try {
      await fetch(`/api/v1/memories/${encodeURIComponent(m.key)}`, { method: "DELETE", headers: { "X-Org-Slug": orgSlug, "X-Project-Slug": projectSlug } });
      window.location.reload();
    } catch { /* silent */ }
    setActionLoading(false);
  };

  const handlePin = async (m: MemoryItem) => {
    setActionLoading(true);
    try {
      await fetch("/api/v1/memories/pin", { method: "POST", headers: apiHeaders, body: JSON.stringify({ key: m.key, pin: !m.pinnedAt }) });
      window.location.reload();
    } catch { /* silent */ }
    setActionLoading(false);
  };

  // Batch actions
  const handleBatchDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} memories?`)) return;
    setActionLoading(true);
    for (const id of selectedIds) {
      const m = memories.find((mem) => mem.id === id);
      if (m) await fetch(`/api/v1/memories/${encodeURIComponent(m.key)}`, { method: "DELETE", headers: { "X-Org-Slug": orgSlug, "X-Project-Slug": projectSlug } });
    }
    window.location.reload();
  };

  const handleBatchArchive = async () => {
    setActionLoading(true);
    for (const id of selectedIds) {
      const m = memories.find((mem) => mem.id === id);
      if (m) await fetch("/api/v1/memories/archive", { method: "POST", headers: apiHeaders, body: JSON.stringify({ key: m.key, archive: true }) });
    }
    window.location.reload();
  };

  const handleExport = () => {
    const data = filteredMemories.map((m) => ({
      key: m.key, content: m.content, metadata: m.metadata ? JSON.parse(m.metadata) : null,
      priority: m.priority, tags: parseTags(m.tags),
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `memories-${projectSlug}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const data = JSON.parse(text) as Array<{ key: string; content: string; metadata?: Record<string, unknown>; priority?: number; tags?: string[] }>;
      setActionLoading(true);
      for (const item of data) {
        await fetch("/api/v1/memories", { method: "POST", headers: apiHeaders, body: JSON.stringify(item) });
      }
      window.location.reload();
    } catch { alert("Invalid JSON file"); }
    setActionLoading(false);
  };

  // Counts
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [type, items] of Object.entries(grouped)) {
      counts[type] = items.filter((m) => showArchived || !m.archivedAt).length;
    }
    return counts;
  }, [grouped, showArchived]);

  const activeFilterCount = [
    filterTag ? 1 : 0,
    filterPriorityRange[0] > 0 || filterPriorityRange[1] < 100 ? 1 : 0,
    filterRelevance !== "all" ? 1 : 0,
    filterPinned !== "all" ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const clearFilters = () => {
    setFilterTag(""); setFilterPriorityRange([0, 100]); setFilterRelevance("all"); setFilterPinned("all");
  };

  // Stats
  const relevanceDistribution = useMemo(() => {
    const dist = { high: 0, medium: 0, low: 0, stale: 0 };
    for (const m of memories.filter((m) => !m.archivedAt)) {
      const score = computeRelevance(m);
      if (score >= 60) dist.high++;
      else if (score >= 30) dist.medium++;
      else if (score >= 10) dist.low++;
      else dist.stale++;
    }
    return dist;
  }, [memories]);

  const totalActive = memories.filter((m) => !m.archivedAt).length;
  const totalArchived = memories.filter((m) => m.archivedAt).length;
  const avgPriority = totalActive > 0 ? Math.round(memories.filter((m) => !m.archivedAt).reduce((sum, m) => sum + (m.priority ?? 0), 0) / totalActive) : 0;
  const totalPinned = memories.filter((m) => m.pinnedAt).length;

  return (
    <TooltipProvider delayDuration={200}>
      <div>
        {/* Stats bar - dense info strip */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-md bg-[var(--landing-surface-2)] px-2.5 py-1.5">
            <span className="font-mono text-[11px] text-[var(--landing-text-tertiary)]">Active</span>
            <span className="font-mono text-[11px] font-bold text-[var(--landing-text)]">{totalActive}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-[var(--landing-surface-2)] px-2.5 py-1.5">
            <span className="font-mono text-[11px] text-[var(--landing-text-tertiary)]">Archived</span>
            <span className="font-mono text-[11px] font-bold text-[var(--landing-text-tertiary)]">{totalArchived}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-[var(--landing-surface-2)] px-2.5 py-1.5">
            <Pin className="h-3 w-3 text-[#F97316]" />
            <span className="font-mono text-[11px] font-bold text-[var(--landing-text)]">{totalPinned}</span>
          </div>
          <div className="hidden items-center gap-1.5 rounded-md bg-[var(--landing-surface-2)] px-2.5 py-1.5 sm:flex">
            <span className="font-mono text-[11px] text-[var(--landing-text-tertiary)]">Avg Pri</span>
            <span className="font-mono text-[11px] font-bold text-[#F97316]">{avgPriority}</span>
          </div>
          <div className="hidden h-4 w-px bg-[var(--landing-border)] md:block" />
          {/* Relevance mini-bars */}
          <div className="hidden items-center gap-1 md:flex">
            <Tooltip><TooltipTrigger asChild>
              <div className="flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-1">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="font-mono text-[10px] text-emerald-400">{relevanceDistribution.high}</span>
              </div>
            </TooltipTrigger><TooltipContent side="bottom"><p className="text-xs">High relevance (60+)</p></TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <div className="flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-1">
                <div className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="font-mono text-[10px] text-amber-400">{relevanceDistribution.medium}</span>
              </div>
            </TooltipTrigger><TooltipContent side="bottom"><p className="text-xs">Medium relevance (30-59)</p></TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <div className="flex items-center gap-1 rounded bg-orange-500/10 px-1.5 py-1">
                <div className="h-2 w-2 rounded-full bg-orange-500" />
                <span className="font-mono text-[10px] text-orange-400">{relevanceDistribution.low}</span>
              </div>
            </TooltipTrigger><TooltipContent side="bottom"><p className="text-xs">Low relevance (10-29)</p></TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <div className="flex items-center gap-1 rounded bg-red-500/10 px-1.5 py-1">
                <div className="h-2 w-2 rounded-full bg-red-500" />
                <span className="font-mono text-[10px] text-red-400">{relevanceDistribution.stale}</span>
              </div>
            </TooltipTrigger><TooltipContent side="bottom"><p className="text-xs">Stale relevance (&lt;10)</p></TooltipContent></Tooltip>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => setShowShortcuts(true)}
            className="hidden items-center gap-1 rounded bg-[var(--landing-surface-2)] px-2 py-1 text-[10px] font-mono text-[var(--landing-text-tertiary)] hover:text-[var(--landing-text)] transition-colors sm:flex"
          >
            <Keyboard className="h-3 w-3" /> <span className="hidden sm:inline">?</span>
          </button>
        </div>

        {/* Toolbar */}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-auto sm:flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--landing-text-tertiary)]" />
            <Input
              ref={searchRef}
              placeholder="Search key, content, tag…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-8 border-[var(--landing-border)] bg-[var(--landing-surface)] font-mono text-xs md:h-8"
            />
          </div>

          {/* Filter popover */}
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1 border-[var(--landing-border)] text-xs relative md:h-8">
                <Filter className="h-3 w-3" />
                <span className="hidden sm:inline">Filters</span>
                {activeFilterCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#F97316] text-[9px] font-bold text-white">{activeFilterCount}</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 bg-[var(--landing-surface)] border-[var(--landing-border)] p-3 sm:w-72" align="end">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-medium text-[var(--landing-text)]">Advanced Filters</span>
                  {activeFilterCount > 0 && <button onClick={clearFilters} className="text-[10px] text-[#F97316] hover:underline">Clear all</button>}
                </div>
                {/* Tag filter */}
                <div>
                  <label className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">Tag</label>
                  <Select value={filterTag || "all"} onValueChange={(v) => setFilterTag(v === "all" ? "" : v)}>
                    <SelectTrigger className="mt-0.5 h-7 w-full text-xs border-[var(--landing-border)] bg-[var(--landing-surface-2)]">
                      <SelectValue placeholder="Any tag" />
                    </SelectTrigger>
                    <SelectContent className="bg-[var(--landing-surface)] border-[var(--landing-border)]">
                      <SelectItem value="all" className="text-xs">Any tag</SelectItem>
                      {allTags.map((t) => <SelectItem key={t} value={t} className="text-xs font-mono">{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {/* Priority range */}
                <div>
                  <label className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">Priority: {filterPriorityRange[0]}-{filterPriorityRange[1]}</label>
                  <Slider
                    min={0} max={100} step={5}
                    value={filterPriorityRange}
                    onValueChange={(v) => setFilterPriorityRange(v as [number, number])}
                    className="mt-1"
                  />
                </div>
                {/* Relevance bucket */}
                <div>
                  <label className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">Relevance</label>
                  <Select value={filterRelevance} onValueChange={setFilterRelevance}>
                    <SelectTrigger className="mt-0.5 h-7 w-full text-xs border-[var(--landing-border)] bg-[var(--landing-surface-2)]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[var(--landing-surface)] border-[var(--landing-border)]">
                      <SelectItem value="all" className="text-xs">All</SelectItem>
                      <SelectItem value="high" className="text-xs">High (60+)</SelectItem>
                      <SelectItem value="medium" className="text-xs">Medium (30-59)</SelectItem>
                      <SelectItem value="low" className="text-xs">Low (10-29)</SelectItem>
                      <SelectItem value="stale" className="text-xs">Stale (&lt;10)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Pinned filter */}
                <div>
                  <label className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">Pin Status</label>
                  <Select value={filterPinned} onValueChange={setFilterPinned}>
                    <SelectTrigger className="mt-0.5 h-7 w-full text-xs border-[var(--landing-border)] bg-[var(--landing-surface-2)]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[var(--landing-surface)] border-[var(--landing-border)]">
                      <SelectItem value="all" className="text-xs">All</SelectItem>
                      <SelectItem value="pinned" className="text-xs">Pinned only</SelectItem>
                      <SelectItem value="unpinned" className="text-xs">Unpinned only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Button variant="outline" size="sm" onClick={() => setShowArchived(!showArchived)} className="h-9 gap-1 border-[var(--landing-border)] text-xs md:h-8">
            <Archive className="h-3 w-3" />
            <span className="hidden sm:inline">{showArchived ? "Hide" : "Show"} Archived</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="h-9 gap-1 border-[var(--landing-border)] text-xs md:h-8">
            <Download className="h-3 w-3" />
          </Button>
          <label>
            <Button variant="outline" size="sm" asChild className="h-9 gap-1 border-[var(--landing-border)] text-xs cursor-pointer md:h-8">
              <span><Upload className="h-3 w-3" /></span>
            </Button>
            <input type="file" accept=".json" className="hidden" onChange={handleImport} />
          </label>
        </div>

        {/* Batch action bar */}
        {someSelected && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-[#F97316]/30 bg-[#F97316]/5 px-3 py-1.5">
            <CheckCheck className="h-3.5 w-3.5 text-[#F97316]" />
            <span className="font-mono text-xs text-[#F97316] font-medium">{selectedIds.size} selected</span>
            <div className="h-3 w-px bg-[#F97316]/20" />
            <Button variant="ghost" size="sm" onClick={handleBatchArchive} className="h-6 gap-1 text-[11px] text-[var(--landing-text-secondary)] hover:text-[var(--landing-text)]">
              <Archive className="h-3 w-3" /> Archive
            </Button>
            <Button variant="ghost" size="sm" onClick={handleBatchDelete} className="h-6 gap-1 text-[11px] text-red-400 hover:text-red-300">
              <Trash2 className="h-3 w-3" /> Delete
            </Button>
            <div className="flex-1" />
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} className="h-6 text-[11px] text-[var(--landing-text-tertiary)]">
              <X className="h-3 w-3" /> Clear
            </Button>
          </div>
        )}

        {/* Type tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-2 h-auto flex-wrap bg-[var(--landing-surface)] gap-0">
            <TabsTrigger value="all" className="h-6 text-[10px] px-2">
              All ({memories.filter((m) => showArchived || !m.archivedAt).length})
            </TabsTrigger>
            {Object.entries(AGENT_CONTEXT_TYPES).map(([type, info]) =>
              (typeCounts[type] ?? 0) > 0 ? (
                <TabsTrigger key={type} value={type} className="h-6 text-[10px] px-2">
                  {info.label} ({typeCounts[type]})
                </TabsTrigger>
              ) : null,
            )}
            {(typeCounts["other"] ?? 0) > 0 && (
              <TabsTrigger value="other" className="h-6 text-[10px] px-2">Other ({typeCounts["other"]})</TabsTrigger>
            )}
          </TabsList>

          {/* Table */}
          <div className="dash-card overflow-x-auto" ref={tableRef}>
            {filteredMemories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Search className="mb-2 h-6 w-6 text-[var(--landing-text-tertiary)]" />
                <p className="font-mono text-xs font-medium text-[var(--landing-text)]">No memories found</p>
                <p className="text-[10px] text-[var(--landing-text-tertiary)]">
                  {search ? "Try a different search." : "Use the MCP server to store memories."}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-[var(--landing-border)] bg-[var(--landing-code-bg)] hover:bg-[var(--landing-code-bg)]">
                    <TableHead className="w-8 px-2">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={toggleAll}
                        className="border-[var(--landing-border)]"
                      />
                    </TableHead>
                    <TableHead className="cursor-pointer font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)] px-2" onClick={() => toggleSort("key")}>
                      Key <SortIcon field="key" />
                    </TableHead>
                    <TableHead className="font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)] px-2">Content</TableHead>
                    <TableHead className="hidden cursor-pointer font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)] px-2 w-14 sm:table-cell" onClick={() => toggleSort("relevance")}>
                      Rel <SortIcon field="relevance" />
                    </TableHead>
                    <TableHead className="hidden cursor-pointer font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)] px-2 w-12 sm:table-cell" onClick={() => toggleSort("priority")}>
                      Pri <SortIcon field="priority" />
                    </TableHead>
                    <TableHead className="hidden font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)] px-2 md:table-cell">Tags</TableHead>
                    <TableHead className="hidden cursor-pointer font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)] px-2 w-14 lg:table-cell" onClick={() => toggleSort("accessCount")}>
                      Hits <SortIcon field="accessCount" />
                    </TableHead>
                    <TableHead className="hidden cursor-pointer font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)] px-2 w-16 lg:table-cell" onClick={() => toggleSort("updated")}>
                      Age <SortIcon field="updated" />
                    </TableHead>
                    <TableHead className="w-[100px] font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)] px-2">Acts</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMemories.map((m, idx) => {
                    const relevance = computeRelevance(m);
                    const bucket = getRelevanceBucket(relevance);
                    const isSelected = selectedIds.has(m.id);
                    const isFocused = idx === focusedIndex;
                    const isInlineEditing = inlineEditId === m.id;

                    return (
                      <TableRow
                        key={m.id}
                        data-row-index={idx}
                        onClick={() => setFocusedIndex(idx)}
                        className={`border-[var(--landing-border)] cursor-pointer transition-colors duration-75
                          ${m.archivedAt ? "opacity-40" : ""}
                          ${isFocused ? "bg-[#F97316]/5 ring-1 ring-inset ring-[#F97316]/20" : ""}
                          ${isSelected ? "bg-[#F97316]/8" : ""}
                        `}
                      >
                        <TableCell className="px-2 py-1.5">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleOne(m.id)}
                            className="border-[var(--landing-border)]"
                          />
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate font-mono text-xs font-medium text-[#F97316] px-2 py-1.5">
                          <div className="flex items-center gap-1">
                            {m.pinnedAt && <Pin className="h-2.5 w-2.5 text-[#F97316] shrink-0" />}
                            <span className="truncate">{m.key}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[280px] px-2 py-1.5">
                          {isInlineEditing ? (
                            <div className="flex gap-1">
                              <Textarea
                                value={inlineEditContent}
                                onChange={(e) => setInlineEditContent(e.target.value)}
                                className="min-h-[60px] font-mono text-[11px] border-[var(--landing-border)] bg-[var(--landing-code-bg)] p-1.5"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Escape") { setInlineEditId(null); e.stopPropagation(); }
                                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { handleInlineSave(m); e.stopPropagation(); }
                                }}
                              />
                              <div className="flex flex-col gap-0.5">
                                <Button size="sm" onClick={() => handleInlineSave(m)} disabled={actionLoading} className="h-5 w-5 p-0 bg-[#F97316] text-white text-[10px]">
                                  <CheckCheck className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setInlineEditId(null)} className="h-5 w-5 p-0 text-[10px]">
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <span className="font-mono text-[11px] text-[var(--landing-text-secondary)] line-clamp-2">
                              {m.content.length > 150 ? m.content.slice(0, 150) + "…" : m.content}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="hidden px-2 py-1.5 sm:table-cell">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={`inline-flex items-center rounded px-1 py-0.5 font-mono text-[10px] font-bold ${bucket.bg} ${bucket.color}`}>
                                {Math.round(relevance)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p className="text-xs">{bucket.label} relevance ({relevance.toFixed(1)}/100)</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="hidden font-mono text-[11px] px-2 py-1.5 sm:table-cell">
                          {(m.priority ?? 0) > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[#F97316]">
                              <Star className="h-2.5 w-2.5" />{m.priority}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="hidden px-2 py-1.5 md:table-cell">
                          <div className="flex flex-wrap gap-0.5">
                            {parseTags(m.tags).slice(0, 3).map((tag) => (
                              <Badge key={tag} variant="outline" className="border-[var(--landing-border)] text-[9px] h-4 px-1 py-0">{tag}</Badge>
                            ))}
                            {parseTags(m.tags).length > 3 && (
                              <Badge variant="outline" className="border-[var(--landing-border)] text-[9px] h-4 px-1 py-0">+{parseTags(m.tags).length - 3}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden font-mono text-[11px] text-[var(--landing-text-tertiary)] px-2 py-1.5 lg:table-cell">
                          {m.accessCount ?? 0}
                        </TableCell>
                        <TableCell className="hidden font-mono text-[11px] text-[var(--landing-text-tertiary)] px-2 py-1.5 lg:table-cell">
                          {relativeTime(m.updatedAt)}
                        </TableCell>
                        <TableCell className="px-2 py-1.5">
                          <div className="flex items-center gap-0.5">
                            <Tooltip><TooltipTrigger asChild>
                              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openView(m); }} className="h-6 w-6 p-0"><Eye className="h-3 w-3" /></Button>
                            </TooltipTrigger><TooltipContent><p className="text-xs">View</p></TooltipContent></Tooltip>
                            <Tooltip><TooltipTrigger asChild>
                              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setInlineEditId(m.id); setInlineEditContent(m.content); }} className="h-6 w-6 p-0"><Pencil className="h-3 w-3" /></Button>
                            </TooltipTrigger><TooltipContent><p className="text-xs">Edit (e)</p></TooltipContent></Tooltip>
                            <Tooltip><TooltipTrigger asChild>
                              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handlePin(m); }} className={`h-6 w-6 p-0 ${m.pinnedAt ? "text-[#F97316]" : ""}`}><Pin className="h-3 w-3" /></Button>
                            </TooltipTrigger><TooltipContent><p className="text-xs">{m.pinnedAt ? "Unpin" : "Pin"} (p)</p></TooltipContent></Tooltip>
                            <Tooltip><TooltipTrigger asChild>
                              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openHistory(m); }} className="h-6 w-6 p-0"><History className="h-3 w-3" /></Button>
                            </TooltipTrigger><TooltipContent><p className="text-xs">History</p></TooltipContent></Tooltip>
                            <Tooltip><TooltipTrigger asChild>
                              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleArchive(m, !m.archivedAt); }} className="h-6 w-6 p-0">
                                {m.archivedAt ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
                              </Button>
                            </TooltipTrigger><TooltipContent><p className="text-xs">{m.archivedAt ? "Restore" : "Archive"}</p></TooltipContent></Tooltip>
                            <Tooltip><TooltipTrigger asChild>
                              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDelete(m); }} className="h-6 w-6 p-0 text-red-500 hover:text-red-400"><Trash2 className="h-3 w-3" /></Button>
                            </TooltipTrigger><TooltipContent><p className="text-xs">Delete (d)</p></TooltipContent></Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </Tabs>

        {/* Footer info */}
        <div className="mt-1.5 flex items-center justify-between px-1">
          <span className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">
            {filteredMemories.length} of {memories.length} memories
            {activeFilterCount > 0 && ` (${activeFilterCount} filter${activeFilterCount > 1 ? "s" : ""} active)`}
          </span>
          <span className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">
            Sort: {sortField} {sortDir === "desc" ? "↓" : "↑"}
          </span>
        </div>

        {/* View Dialog */}
        <Dialog open={viewMode === "view"} onOpenChange={() => setViewMode(null)}>
          <DialogContent className="max-w-3xl bg-[var(--landing-surface)] max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader className="pb-2">
              <DialogTitle className="font-mono text-sm text-[#F97316] flex items-center gap-2">
                {selectedMemory?.pinnedAt && <Pin className="h-3.5 w-3.5" />}
                {selectedMemory?.key}
              </DialogTitle>
              <div className="flex items-center gap-3 text-[11px] text-[var(--landing-text-tertiary)]">
                {selectedMemory?.priority ? <span className="flex items-center gap-1"><Star className="h-3 w-3 text-[#F97316]" /> {selectedMemory.priority}</span> : null}
                <span>{relativeTime(selectedMemory?.updatedAt ?? "")}</span>
                {selectedMemory && <span className={`${getRelevanceBucket(computeRelevance(selectedMemory)).color}`}>
                  Relevance: {Math.round(computeRelevance(selectedMemory))}
                </span>}
                <span>Accessed {selectedMemory?.accessCount ?? 0}x</span>
              </div>
            </DialogHeader>
            <div className="flex-1 overflow-auto rounded-md bg-[var(--landing-code-bg)] p-3">
              <pre className="whitespace-pre-wrap font-mono text-xs text-[var(--landing-text-secondary)]">{selectedMemory?.content}</pre>
            </div>
            <div className="flex items-center gap-2 pt-2">
              {parseTags(selectedMemory?.tags ?? null).map((tag) => (
                <Badge key={tag} variant="outline" className="border-[var(--landing-border)] text-[10px]">{tag}</Badge>
              ))}
            </div>
            {selectedMemory?.metadata && (
              <details className="text-xs">
                <summary className="cursor-pointer font-mono text-[var(--landing-text-tertiary)]">Metadata</summary>
                <pre className="mt-1 overflow-auto rounded bg-[var(--landing-code-bg)] p-2 font-mono text-[10px] text-[var(--landing-text-tertiary)]">
                  {JSON.stringify(JSON.parse(selectedMemory.metadata), null, 2)}
                </pre>
              </details>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={viewMode === "edit"} onOpenChange={() => setViewMode(null)}>
          <DialogContent className="max-w-2xl bg-[var(--landing-surface)]">
            <DialogHeader>
              <DialogTitle className="font-mono text-sm">Edit: {selectedMemory?.key}</DialogTitle>
              <DialogDescription className="text-[11px]">Changes are versioned automatically.</DialogDescription>
            </DialogHeader>
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[300px] font-mono text-xs border-[var(--landing-border)] bg-[var(--landing-code-bg)]"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewMode(null)} className="border-[var(--landing-border)]">Cancel</Button>
              <Button onClick={handleSave} disabled={actionLoading} className="bg-[#F97316] text-white hover:bg-[#EA580C]">
                {actionLoading ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* History Dialog */}
        <Dialog open={viewMode === "history"} onOpenChange={() => setViewMode(null)}>
          <DialogContent className="max-w-2xl bg-[var(--landing-surface)] max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="font-mono text-sm">History: {selectedMemory?.key}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto">
              {loadingVersions ? (
                <p className="py-6 text-center text-xs text-[var(--landing-text-tertiary)]">Loading…</p>
              ) : versions.length === 0 ? (
                <p className="py-6 text-center text-xs text-[var(--landing-text-tertiary)]">No history.</p>
              ) : (
                <div className="space-y-2">
                  {versions.map((v) => (
                    <div key={v.id} className="rounded-lg border border-[var(--landing-border)] p-2.5">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="font-mono text-[11px] font-medium text-[var(--landing-text)]">v{v.version}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="border-[var(--landing-border)] text-[9px]">{v.changeType}</Badge>
                          <span className="font-mono text-[9px] text-[var(--landing-text-tertiary)]">{formatDate(v.createdAt)}</span>
                        </div>
                      </div>
                      <pre className="max-h-24 overflow-auto rounded bg-[var(--landing-code-bg)] p-2 font-mono text-[10px] text-[var(--landing-text-secondary)]">
                        {v.content.length > 500 ? v.content.slice(0, 500) + "…" : v.content}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Keyboard Shortcuts Dialog */}
        <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
          <DialogContent className="max-w-sm bg-[var(--landing-surface)]">
            <DialogHeader>
              <DialogTitle className="text-sm flex items-center gap-2"><Keyboard className="h-4 w-4" /> Keyboard Shortcuts</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 font-mono text-xs">
              {[
                ["j / k", "Navigate up/down"],
                ["Space", "Toggle selection"],
                ["Enter", "View memory"],
                ["e", "Inline edit"],
                ["d", "Delete focused"],
                ["p", "Pin/unpin focused"],
                ["/", "Focus search"],
                ["Escape", "Clear selection"],
                ["Ctrl+A", "Select all"],
                ["?", "Toggle shortcuts"],
              ].map(([key, desc]) => (
                <div key={key} className="contents">
                  <kbd className="rounded bg-[var(--landing-surface-2)] px-1.5 py-0.5 text-[10px] text-[var(--landing-text)] border border-[var(--landing-border)]">{key}</kbd>
                  <span className="text-[var(--landing-text-secondary)] py-0.5">{desc}</span>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
