"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Search,
  Eye,
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
  History,
  Download,
  Upload,
  ChevronDown,
  ChevronUp,
  Star,
  Pin,
  Filter,
  X,
  CheckCheck,
  ArrowUpDown,
  Keyboard,
  Loader2,
  AlertTriangle,
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
  onMutate?: () => void;
}

interface ConfirmAction {
  title: string;
  description: string;
  variant: "destructive" | "warning" | "default";
  onConfirm: () => Promise<void>;
}

// ── Constants ──────────────────────────────────────────────────────────────

const AGENT_CONTEXT_TYPES: Record<string, { label: string; prefix: string }> = {
  coding_style: { label: "Style", prefix: "agent/context/coding_style/" },
  folder_structure: {
    label: "Folders",
    prefix: "agent/context/folder_structure/",
  },
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
  const helpful = m.helpfulCount ?? 0;
  const unhelpful = m.unhelpfulCount ?? 0;
  const feedbackFactor =
    helpful + unhelpful > 0 ? (1 + helpful) / (1 + helpful + unhelpful) : 1;
  const pinBoost = m.pinnedAt ? 1.5 : 1;
  const raw =
    basePriority * usageFactor * timeFactor * feedbackFactor * pinBoost * 100;
  return Math.min(100, Math.max(0, Math.round(raw * 100) / 100));
}

function getRelevanceBucket(score: number): {
  label: string;
  color: string;
  bg: string;
} {
  if (score >= 60)
    return {
      label: "HIGH",
      color: "text-emerald-400",
      bg: "bg-emerald-500/20",
    };
  if (score >= 30)
    return { label: "MED", color: "text-amber-400", bg: "bg-amber-500/20" };
  if (score >= 10)
    return { label: "LOW", color: "text-orange-400", bg: "bg-orange-500/20" };
  return { label: "STALE", color: "text-red-400", bg: "bg-red-500/20" };
}

// ── Confirmation Dialog ───────────────────────────────────────────────────

function ConfirmDialog({
  action,
  loading,
  onClose,
}: {
  action: ConfirmAction | null;
  loading: boolean;
  onClose: () => void;
}) {
  if (!action) return null;

  const handleConfirm = async () => {
    await action.onConfirm();
  };

  return (
    <Dialog
      open={!!action}
      onOpenChange={() => {
        if (!loading) onClose();
      }}
    >
      <DialogContent className="max-w-sm border-[var(--landing-border)] bg-[var(--landing-surface)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            {action.variant === "destructive" && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/10">
                <Trash2 className="h-4 w-4 text-red-400" />
              </div>
            )}
            {action.variant === "warning" && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
              </div>
            )}
            {action.title}
          </DialogTitle>
          <DialogDescription className="text-xs text-[var(--landing-text-tertiary)]">
            {action.description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={loading}
            className="border-[var(--landing-border)]"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={loading}
            className={
              action.variant === "destructive"
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-[#F97316] text-white hover:bg-[#EA580C]"
            }
          >
            {loading && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
            {loading ? "Working..." : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export function MemoryBrowser({
  memories: memoriesProp,
  orgSlug,
  projectSlug,
  onMutate,
}: MemoryBrowserProps) {
  const router = useRouter();

  // Optimistic local overrides (cleared when server props arrive)
  const [localOverrides, setLocalOverrides] = useState<
    Map<string, Partial<MemoryItem>>
  >(new Map());
  const prevMemoriesRef = useRef(memoriesProp);
  useEffect(() => {
    if (prevMemoriesRef.current !== memoriesProp) {
      prevMemoriesRef.current = memoriesProp;
      setLocalOverrides(new Map());
    }
  }, [memoriesProp]);

  const memories = useMemo(() => {
    if (localOverrides.size === 0) return memoriesProp;
    return memoriesProp.map((m) => {
      const override = localOverrides.get(m.id);
      return override ? { ...m, ...override } : m;
    });
  }, [memoriesProp, localOverrides]);

  // State
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState<MemoryItem | null>(null);
  const [viewMode, setViewMode] = useState<"view" | "edit" | "history" | null>(
    null,
  );
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
  const [filterPriorityRange, setFilterPriorityRange] = useState<
    [number, number]
  >([0, 100]);
  const [filterRelevance, setFilterRelevance] = useState<string>("all");
  const [filterPinned, setFilterPinned] = useState<string>("all");

  // Confirmation dialog
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(
    null,
  );

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

  // Available type tabs (only show those with items)
  const availableTabs = useMemo(() => {
    const tabs: Array<{ id: string; label: string; count: number }> = [];
    for (const [type, info] of Object.entries(AGENT_CONTEXT_TYPES)) {
      const items = grouped[type] ?? [];
      const count = items.filter((m) => showArchived || !m.archivedAt).length;
      if (count > 0) tabs.push({ id: type, label: info.label, count });
    }
    const otherCount = (grouped["other"] ?? []).filter(
      (m) => showArchived || !m.archivedAt,
    ).length;
    if (otherCount > 0)
      tabs.push({ id: "other", label: "Custom", count: otherCount });
    return tabs;
  }, [grouped, showArchived]);

  // Filter and sort
  const filteredMemories = useMemo(() => {
    let items = activeTab === "all" ? memories : (grouped[activeTab] ?? []);

    if (!showArchived) items = items.filter((m) => !m.archivedAt);

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (m) =>
          m.key.toLowerCase().includes(q) ||
          m.content.toLowerCase().includes(q) ||
          parseTags(m.tags).some((t) => t.toLowerCase().includes(q)),
      );
    }

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
          case "high":
            return score >= 60;
          case "medium":
            return score >= 30 && score < 60;
          case "low":
            return score >= 10 && score < 30;
          case "stale":
            return score < 10;
          default:
            return true;
        }
      });
    }
    if (filterPinned === "pinned") items = items.filter((m) => m.pinnedAt);
    if (filterPinned === "unpinned") items = items.filter((m) => !m.pinnedAt);

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
        case "relevance":
          cmp = computeRelevance(a) - computeRelevance(b);
          break;
        case "accessCount":
          cmp = (a.accessCount ?? 0) - (b.accessCount ?? 0);
          break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });

    return items;
  }, [
    memories,
    grouped,
    activeTab,
    showArchived,
    search,
    sortField,
    sortDir,
    filterTag,
    filterPriorityRange,
    filterRelevance,
    filterPinned,
  ]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;
      if (confirmAction) return;

      switch (e.key) {
        case "j":
          e.preventDefault();
          setFocusedIndex((i) => Math.min(i + 1, filteredMemories.length - 1));
          break;
        case "k":
          e.preventDefault();
          setFocusedIndex((i) => Math.max(i - 1, 0));
          break;
        case " ": {
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < filteredMemories.length) {
            const m = filteredMemories[focusedIndex];
            setSelectedIds((prev) => {
              const next = new Set(prev);
              if (next.has(m.id)) next.delete(m.id);
              else next.add(m.id);
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
            setSelectedMemory(m);
            setEditContent(m.content);
            setViewMode("edit");
          }
          break;
        }
        case "d": {
          if (focusedIndex >= 0 && focusedIndex < filteredMemories.length) {
            e.preventDefault();
            requestDeleteRef.current(filteredMemories[focusedIndex]);
          }
          break;
        }
        case "p": {
          if (focusedIndex >= 0 && focusedIndex < filteredMemories.length) {
            e.preventDefault();
            requestPinRef.current(filteredMemories[focusedIndex]);
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
  }, [focusedIndex, filteredMemories, confirmAction]);

  // Scroll focused row into view
  useEffect(() => {
    if (focusedIndex >= 0) {
      const row = tableRef.current?.querySelector(
        `[data-row-index="${focusedIndex}"]`,
      );
      row?.scrollIntoView({ block: "nearest" });
    }
  }, [focusedIndex]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field)
      return <ArrowUpDown className="inline h-2.5 w-2.5 opacity-30" />;
    return sortDir === "desc" ? (
      <ChevronDown className="inline h-3 w-3 text-[#F97316]" />
    ) : (
      <ChevronUp className="inline h-3 w-3 text-[#F97316]" />
    );
  };

  // Selection helpers
  const allSelected =
    filteredMemories.length > 0 &&
    filteredMemories.every((m) => selectedIds.has(m.id));
  const someSelected = selectedIds.size > 0;

  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredMemories.map((m) => m.id)));
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // API actions
  const apiHeaders = {
    "Content-Type": "application/json",
    "X-Org-Slug": orgSlug,
    "X-Project-Slug": projectSlug,
  };

  const refresh = () => {
    onMutate?.();
    router.refresh();
  };

  const openView = (m: MemoryItem) => {
    setSelectedMemory(m);
    setViewMode("view");
  };

  const openHistory = async (m: MemoryItem) => {
    setSelectedMemory(m);
    setViewMode("history");
    setLoadingVersions(true);
    try {
      const res = await fetch(
        `/api/v1/memories/versions?key=${encodeURIComponent(m.key)}`,
        { headers: { "X-Org-Slug": orgSlug, "X-Project-Slug": projectSlug } },
      );
      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions ?? []);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? `Failed to load versions (${res.status})`);
      }
    } catch {
      toast.error("Network error loading versions");
    }
    setLoadingVersions(false);
  };

  // Direct save (no confirmation - user already opened the edit dialog)
  const handleSave = async () => {
    if (!selectedMemory) return;
    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/v1/memories/${encodeURIComponent(selectedMemory.key)}`,
        {
          method: "PATCH",
          headers: apiHeaders,
          body: JSON.stringify({ content: editContent }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? `Failed to save (${res.status})`);
        setActionLoading(false);
        return;
      }
      const now = new Date().toISOString();
      setLocalOverrides((prev) => {
        const next = new Map(prev);
        next.set(selectedMemory.id, { content: editContent, updatedAt: now });
        return next;
      });
      setSelectedMemory({
        ...selectedMemory,
        content: editContent,
        updatedAt: now,
      });
      setViewMode(null);
      toast.success("Memory saved");
      refresh();
    } catch {
      toast.error("Network error saving memory");
    }
    setActionLoading(false);
  };

  // Confirmed actions

  const requestArchive = (m: MemoryItem, archive: boolean) => {
    setConfirmAction({
      title: archive ? "Archive memory" : "Restore memory",
      description: archive
        ? `Archive "${m.key}"? It will be hidden from the default view.`
        : `Restore "${m.key}" from the archive?`,
      variant: "warning",
      onConfirm: async () => {
        setActionLoading(true);
        try {
          const res = await fetch("/api/v1/memories/archive", {
            method: "POST",
            headers: apiHeaders,
            body: JSON.stringify({ key: m.key, archive }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            toast.error(
              data.error ??
                `Failed to ${archive ? "archive" : "restore"} (${res.status})`,
            );
          } else {
            toast.success(archive ? "Memory archived" : "Memory restored");
          }
          setConfirmAction(null);
          refresh();
        } catch {
          toast.error("Network error");
        }
        setActionLoading(false);
      },
    });
  };

  const requestDelete = (m: MemoryItem) => {
    setConfirmAction({
      title: "Delete memory",
      description: `Permanently delete "${m.key}"? This cannot be undone.`,
      variant: "destructive",
      onConfirm: async () => {
        setActionLoading(true);
        try {
          const res = await fetch(
            `/api/v1/memories/${encodeURIComponent(m.key)}`,
            {
              method: "DELETE",
              headers: { "X-Org-Slug": orgSlug, "X-Project-Slug": projectSlug },
            },
          );
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            toast.error(data.error ?? `Failed to delete (${res.status})`);
          } else {
            toast.success("Memory deleted");
          }
          setConfirmAction(null);
          refresh();
        } catch {
          toast.error("Network error");
        }
        setActionLoading(false);
      },
    });
  };

  const requestPin = (m: MemoryItem) => {
    const pin = !m.pinnedAt;
    setConfirmAction({
      title: pin ? "Pin memory" : "Unpin memory",
      description: pin
        ? `Pin "${m.key}"? Pinned memories get a 1.5x relevance boost.`
        : `Unpin "${m.key}"? The relevance boost will be removed.`,
      variant: "default",
      onConfirm: async () => {
        setActionLoading(true);
        try {
          const res = await fetch("/api/v1/memories/pin", {
            method: "POST",
            headers: apiHeaders,
            body: JSON.stringify({ key: m.key, pin }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            toast.error(
              data.error ??
                `Failed to ${pin ? "pin" : "unpin"} (${res.status})`,
            );
          } else {
            toast.success(pin ? "Memory pinned" : "Memory unpinned");
          }
          setConfirmAction(null);
          refresh();
        } catch {
          toast.error("Network error");
        }
        setActionLoading(false);
      },
    });
  };

  // Stable refs for keyboard handler (declared after functions)
  const requestDeleteRef = useRef(requestDelete);
  requestDeleteRef.current = requestDelete;
  const requestPinRef = useRef(requestPin);
  requestPinRef.current = requestPin;

  // Batch actions
  const requestBatchDelete = () => {
    setConfirmAction({
      title: `Delete ${selectedIds.size} memories`,
      description: `Permanently delete ${selectedIds.size} selected memories? This cannot be undone.`,
      variant: "destructive",
      onConfirm: async () => {
        setActionLoading(true);
        let failed = 0;
        for (const id of selectedIds) {
          const m = memories.find((mem) => mem.id === id);
          if (!m) continue;
          try {
            const res = await fetch(
              `/api/v1/memories/${encodeURIComponent(m.key)}`,
              {
                method: "DELETE",
                headers: {
                  "X-Org-Slug": orgSlug,
                  "X-Project-Slug": projectSlug,
                },
              },
            );
            if (!res.ok) failed++;
          } catch {
            failed++;
          }
        }
        if (failed > 0)
          toast.error(
            `Failed to delete ${failed} of ${selectedIds.size} memories`,
          );
        else toast.success(`Deleted ${selectedIds.size} memories`);
        setConfirmAction(null);
        setSelectedIds(new Set());
        setActionLoading(false);
        refresh();
      },
    });
  };

  const requestBatchArchive = () => {
    setConfirmAction({
      title: `Archive ${selectedIds.size} memories`,
      description: `Archive ${selectedIds.size} selected memories? They will be hidden from the default view.`,
      variant: "warning",
      onConfirm: async () => {
        setActionLoading(true);
        let failed = 0;
        for (const id of selectedIds) {
          const m = memories.find((mem) => mem.id === id);
          if (!m) continue;
          try {
            const res = await fetch("/api/v1/memories/archive", {
              method: "POST",
              headers: apiHeaders,
              body: JSON.stringify({ key: m.key, archive: true }),
            });
            if (!res.ok) failed++;
          } catch {
            failed++;
          }
        }
        if (failed > 0)
          toast.error(
            `Failed to archive ${failed} of ${selectedIds.size} memories`,
          );
        else toast.success(`Archived ${selectedIds.size} memories`);
        setConfirmAction(null);
        setSelectedIds(new Set());
        setActionLoading(false);
        refresh();
      },
    });
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
      setConfirmAction({
        title: `Import ${data.length} memories`,
        description: `Import ${data.length} memories from "${file.name}"? Existing keys will be overwritten.`,
        variant: "warning",
        onConfirm: async () => {
          setActionLoading(true);
          let failed = 0;
          for (const item of data) {
            try {
              const res = await fetch("/api/v1/memories", {
                method: "POST",
                headers: apiHeaders,
                body: JSON.stringify(item),
              });
              if (!res.ok) failed++;
            } catch {
              failed++;
            }
          }
          if (failed > 0)
            toast.error(
              `Failed to import ${failed} of ${data.length} memories`,
            );
          else toast.success(`Imported ${data.length} memories`);
          setConfirmAction(null);
          setActionLoading(false);
          refresh();
        },
      });
    } catch {
      toast.error("Invalid JSON file");
    }
    // Reset file input so the same file can be re-imported
    e.target.value = "";
  };

  const activeFilterCount = [
    filterTag ? 1 : 0,
    filterPriorityRange[0] > 0 || filterPriorityRange[1] < 100 ? 1 : 0,
    filterRelevance !== "all" ? 1 : 0,
    filterPinned !== "all" ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const clearFilters = () => {
    setFilterTag("");
    setFilterPriorityRange([0, 100]);
    setFilterRelevance("all");
    setFilterPinned("all");
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
  const avgPriority =
    totalActive > 0
      ? Math.round(
          memories
            .filter((m) => !m.archivedAt)
            .reduce((sum, m) => sum + (m.priority ?? 0), 0) / totalActive,
        )
      : 0;
  const totalPinned = memories.filter((m) => m.pinnedAt).length;

  const sortLabel: Record<SortField, string> = {
    key: "Key",
    priority: "Priority",
    updated: "Updated",
    relevance: "Relevance",
    accessCount: "Access count",
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div>
        {/* Stats bar */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-md bg-[var(--landing-surface-2)] px-2.5 py-1.5">
            <span className="font-mono text-[11px] text-[var(--landing-text-tertiary)]">
              Active
            </span>
            <span className="font-mono text-[11px] font-bold text-[var(--landing-text)]">
              {totalActive}
            </span>
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-[var(--landing-surface-2)] px-2.5 py-1.5">
            <span className="font-mono text-[11px] text-[var(--landing-text-tertiary)]">
              Archived
            </span>
            <span className="font-mono text-[11px] font-bold text-[var(--landing-text-tertiary)]">
              {totalArchived}
            </span>
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-[var(--landing-surface-2)] px-2.5 py-1.5">
            <Pin className="h-3 w-3 text-[#F97316]" />
            <span className="font-mono text-[11px] font-bold text-[var(--landing-text)]">
              {totalPinned}
            </span>
          </div>
          <div className="hidden items-center gap-1.5 rounded-md bg-[var(--landing-surface-2)] px-2.5 py-1.5 sm:flex">
            <span className="font-mono text-[11px] text-[var(--landing-text-tertiary)]">
              Avg Pri
            </span>
            <span className="font-mono text-[11px] font-bold text-[#F97316]">
              {avgPriority}
            </span>
          </div>
          <div className="hidden h-4 w-px bg-[var(--landing-border)] md:block" />
          {/* Relevance distribution */}
          <div className="hidden items-center gap-1 md:flex">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-1">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="font-mono text-[10px] text-emerald-400">
                    {relevanceDistribution.high}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                High relevance (60+)
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-1">
                  <div className="h-2 w-2 rounded-full bg-amber-500" />
                  <span className="font-mono text-[10px] text-amber-400">
                    {relevanceDistribution.medium}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Medium relevance (30-59)
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 rounded bg-orange-500/10 px-1.5 py-1">
                  <div className="h-2 w-2 rounded-full bg-orange-500" />
                  <span className="font-mono text-[10px] text-orange-400">
                    {relevanceDistribution.low}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Low relevance (10-29)
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 rounded bg-red-500/10 px-1.5 py-1">
                  <div className="h-2 w-2 rounded-full bg-red-500" />
                  <span className="font-mono text-[10px] text-red-400">
                    {relevanceDistribution.stale}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Stale relevance (&lt;10)
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex-1" />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setShowShortcuts(true)}
                className="hidden items-center gap-1 rounded bg-[var(--landing-surface-2)] px-2 py-1 font-mono text-[10px] text-[var(--landing-text-tertiary)] transition-colors hover:text-[var(--landing-text)] sm:flex"
              >
                <Keyboard className="h-3 w-3" />{" "}
                <span className="hidden sm:inline">?</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Keyboard shortcuts</TooltipContent>
          </Tooltip>
        </div>

        {/* Toolbar */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-auto sm:max-w-xs sm:flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--landing-text-tertiary)]" />
            <Input
              ref={searchRef}
              placeholder="Search key, content, tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 border-[var(--landing-border)] bg-[var(--landing-surface)] pl-8 font-mono text-xs md:h-8"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--landing-text-tertiary)] hover:text-[var(--landing-text)]"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Sort dropdown */}
          <Select
            value={sortField}
            onValueChange={(v) => {
              setSortField(v as SortField);
              setSortDir("desc");
            }}
          >
            <SelectTrigger className="h-9 w-auto gap-1 border-[var(--landing-border)] bg-[var(--landing-surface)] font-mono text-xs md:h-8">
              <ArrowUpDown className="h-3 w-3 shrink-0 text-[var(--landing-text-tertiary)]" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-[var(--landing-border)] bg-[var(--landing-surface)]">
              {(Object.keys(sortLabel) as SortField[]).map((f) => (
                <SelectItem key={f} value={f} className="font-mono text-xs">
                  {sortLabel[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  setSortDir((d) => (d === "asc" ? "desc" : "asc"))
                }
                className="h-9 w-9 border-[var(--landing-border)] md:h-8 md:w-8"
              >
                {sortDir === "desc" ? (
                  <ChevronDown className="h-3.5 w-3.5 text-[#F97316]" />
                ) : (
                  <ChevronUp className="h-3.5 w-3.5 text-[#F97316]" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {sortDir === "desc" ? "Descending" : "Ascending"}
            </TooltipContent>
          </Tooltip>

          <div className="h-4 w-px bg-[var(--landing-border)]" />

          {/* Filter popover */}
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="relative h-9 gap-1 border-[var(--landing-border)] text-xs md:h-8"
              >
                <Filter className="h-3 w-3" />
                <span className="hidden sm:inline">Filters</span>
                {activeFilterCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#F97316] text-[9px] font-bold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-64 border-[var(--landing-border)] bg-[var(--landing-surface)] p-3 sm:w-72"
              align="end"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-medium text-[var(--landing-text)]">
                    Filters
                  </span>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={clearFilters}
                      className="text-[10px] text-[#F97316] hover:underline"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                <div>
                  <label className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">
                    Tag
                  </label>
                  <Select
                    value={filterTag || "all"}
                    onValueChange={(v) => setFilterTag(v === "all" ? "" : v)}
                  >
                    <SelectTrigger className="mt-0.5 h-7 w-full border-[var(--landing-border)] bg-[var(--landing-surface-2)] text-xs">
                      <SelectValue placeholder="Any tag" />
                    </SelectTrigger>
                    <SelectContent className="border-[var(--landing-border)] bg-[var(--landing-surface)]">
                      <SelectItem value="all" className="text-xs">
                        Any tag
                      </SelectItem>
                      {allTags.map((t) => (
                        <SelectItem
                          key={t}
                          value={t}
                          className="font-mono text-xs"
                        >
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">
                    Priority: {filterPriorityRange[0]}-{filterPriorityRange[1]}
                  </label>
                  <Slider
                    min={0}
                    max={100}
                    step={5}
                    value={filterPriorityRange}
                    onValueChange={(v) =>
                      setFilterPriorityRange(v as [number, number])
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">
                    Relevance
                  </label>
                  <Select
                    value={filterRelevance}
                    onValueChange={setFilterRelevance}
                  >
                    <SelectTrigger className="mt-0.5 h-7 w-full border-[var(--landing-border)] bg-[var(--landing-surface-2)] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-[var(--landing-border)] bg-[var(--landing-surface)]">
                      <SelectItem value="all" className="text-xs">
                        All
                      </SelectItem>
                      <SelectItem value="high" className="text-xs">
                        High (60+)
                      </SelectItem>
                      <SelectItem value="medium" className="text-xs">
                        Medium (30-59)
                      </SelectItem>
                      <SelectItem value="low" className="text-xs">
                        Low (10-29)
                      </SelectItem>
                      <SelectItem value="stale" className="text-xs">
                        Stale (&lt;10)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">
                    Pin Status
                  </label>
                  <Select value={filterPinned} onValueChange={setFilterPinned}>
                    <SelectTrigger className="mt-0.5 h-7 w-full border-[var(--landing-border)] bg-[var(--landing-surface-2)] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-[var(--landing-border)] bg-[var(--landing-surface)]">
                      <SelectItem value="all" className="text-xs">
                        All
                      </SelectItem>
                      <SelectItem value="pinned" className="text-xs">
                        Pinned only
                      </SelectItem>
                      <SelectItem value="unpinned" className="text-xs">
                        Unpinned only
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowArchived(!showArchived)}
                className="h-9 gap-1 border-[var(--landing-border)] text-xs md:h-8"
              >
                <Archive className="h-3 w-3" />
                <span className="hidden sm:inline">
                  {showArchived ? "Hide" : "Show"} Archived
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {showArchived
                ? "Hide archived memories"
                : "Show archived memories"}
            </TooltipContent>
          </Tooltip>

          <div className="flex-1" />

          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleExport}
                  className="h-9 w-9 border-[var(--landing-border)] md:h-8 md:w-8"
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Export as JSON</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <label>
                  <Button
                    variant="outline"
                    size="icon"
                    asChild
                    className="h-9 w-9 cursor-pointer border-[var(--landing-border)] md:h-8 md:w-8"
                  >
                    <span>
                      <Upload className="h-3.5 w-3.5" />
                    </span>
                  </Button>
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleImport}
                  />
                </label>
              </TooltipTrigger>
              <TooltipContent side="bottom">Import from JSON</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Type filter chips */}
        {availableTabs.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setActiveTab("all")}
              className={`rounded-md px-2.5 py-1 font-mono text-[10px] font-medium transition-colors ${
                activeTab === "all"
                  ? "bg-[#F97316]/15 text-[#F97316]"
                  : "bg-[var(--landing-surface-2)] text-[var(--landing-text-tertiary)] hover:text-[var(--landing-text)]"
              }`}
            >
              All (
              {memories.filter((m) => showArchived || !m.archivedAt).length})
            </button>
            {availableTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-md px-2.5 py-1 font-mono text-[10px] font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-[#F97316]/15 text-[#F97316]"
                    : "bg-[var(--landing-surface-2)] text-[var(--landing-text-tertiary)] hover:text-[var(--landing-text)]"
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        )}

        {/* Batch action bar */}
        {someSelected && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-[#F97316]/30 bg-[#F97316]/5 px-3 py-1.5">
            <CheckCheck className="h-3.5 w-3.5 text-[#F97316]" />
            <span className="font-mono text-xs font-medium text-[#F97316]">
              {selectedIds.size} selected
            </span>
            <div className="h-3 w-px bg-[#F97316]/20" />
            <Button
              variant="ghost"
              size="sm"
              onClick={requestBatchArchive}
              className="h-6 gap-1 text-[11px] text-[var(--landing-text-secondary)] hover:text-[var(--landing-text)]"
            >
              <Archive className="h-3 w-3" /> Archive
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={requestBatchDelete}
              className="h-6 gap-1 text-[11px] text-red-400 hover:text-red-300"
            >
              <Trash2 className="h-3 w-3" /> Delete
            </Button>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              className="h-6 text-[11px] text-[var(--landing-text-tertiary)]"
            >
              <X className="h-3 w-3" /> Clear
            </Button>
          </div>
        )}

        {/* Table */}
        <div className="dash-card overflow-x-auto" ref={tableRef}>
          {filteredMemories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Search className="mb-2 h-6 w-6 text-[var(--landing-text-tertiary)]" />
              <p className="font-mono text-xs font-medium text-[var(--landing-text)]">
                No memories found
              </p>
              <p className="text-[10px] text-[var(--landing-text-tertiary)]">
                {search || activeFilterCount > 0
                  ? "Try adjusting your search or filters."
                  : "Use the MCP server to store memories."}
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
                  <TableHead
                    className="cursor-pointer px-2 font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)]"
                    onClick={() => toggleSort("key")}
                  >
                    Key <SortIcon field="key" />
                  </TableHead>
                  <TableHead className="px-2 font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                    Content
                  </TableHead>
                  <TableHead
                    className="hidden w-14 cursor-pointer px-2 font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)] sm:table-cell"
                    onClick={() => toggleSort("relevance")}
                  >
                    Rel <SortIcon field="relevance" />
                  </TableHead>
                  <TableHead
                    className="hidden w-12 cursor-pointer px-2 font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)] sm:table-cell"
                    onClick={() => toggleSort("priority")}
                  >
                    Pri <SortIcon field="priority" />
                  </TableHead>
                  <TableHead className="hidden px-2 font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)] md:table-cell">
                    Tags
                  </TableHead>
                  <TableHead
                    className="hidden w-14 cursor-pointer px-2 font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)] lg:table-cell"
                    onClick={() => toggleSort("accessCount")}
                  >
                    Hits <SortIcon field="accessCount" />
                  </TableHead>
                  <TableHead
                    className="hidden w-16 cursor-pointer px-2 font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)] lg:table-cell"
                    onClick={() => toggleSort("updated")}
                  >
                    Age <SortIcon field="updated" />
                  </TableHead>
                  <TableHead className="w-[100px] px-2 font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                    Acts
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMemories.map((m, idx) => {
                  const relevance = computeRelevance(m);
                  const bucket = getRelevanceBucket(relevance);
                  const isSelected = selectedIds.has(m.id);
                  const isFocused = idx === focusedIndex;
                  return (
                    <TableRow
                      key={m.id}
                      data-row-index={idx}
                      onClick={() => setFocusedIndex(idx)}
                      className={`cursor-pointer border-[var(--landing-border)] transition-colors duration-75 ${m.archivedAt ? "opacity-40" : ""} ${isFocused ? "bg-[#F97316]/5 ring-1 ring-inset ring-[#F97316]/20" : ""} ${isSelected ? "bg-[#F97316]/8" : ""} `}
                    >
                      <TableCell className="px-2 py-1.5">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleOne(m.id)}
                          className="border-[var(--landing-border)]"
                        />
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate px-2 py-1.5 font-mono text-xs font-medium text-[#F97316]">
                        <div className="flex items-center gap-1">
                          {m.pinnedAt && (
                            <Pin className="h-2.5 w-2.5 shrink-0 text-[#F97316]" />
                          )}
                          <span className="truncate">{m.key}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[280px] px-2 py-1.5">
                        <span className="line-clamp-2 font-mono text-[11px] text-[var(--landing-text-secondary)]">
                          {m.content.length > 150
                            ? m.content.slice(0, 150) + "..."
                            : m.content}
                        </span>
                      </TableCell>
                      <TableCell className="hidden px-2 py-1.5 sm:table-cell">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className={`inline-flex items-center rounded px-1 py-0.5 font-mono text-[10px] font-bold ${bucket.bg} ${bucket.color}`}
                            >
                              {Math.round(relevance)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            {bucket.label} relevance ({relevance.toFixed(1)}
                            /100)
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="hidden px-2 py-1.5 font-mono text-[11px] sm:table-cell">
                        {(m.priority ?? 0) > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[#F97316]">
                            <Star className="h-2.5 w-2.5" />
                            {m.priority}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden px-2 py-1.5 md:table-cell">
                        <div className="flex flex-wrap gap-0.5">
                          {parseTags(m.tags)
                            .slice(0, 3)
                            .map((tag) => (
                              <Badge
                                key={tag}
                                variant="outline"
                                className="h-4 border-[var(--landing-border)] px-1 py-0 text-[9px]"
                              >
                                {tag}
                              </Badge>
                            ))}
                          {parseTags(m.tags).length > 3 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant="outline"
                                  className="h-4 border-[var(--landing-border)] px-1 py-0 text-[9px]"
                                >
                                  +{parseTags(m.tags).length - 3}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                {parseTags(m.tags).slice(3).join(", ")}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden px-2 py-1.5 font-mono text-[11px] text-[var(--landing-text-tertiary)] lg:table-cell">
                        {m.accessCount ?? 0}
                      </TableCell>
                      <TableCell className="hidden px-2 py-1.5 font-mono text-[11px] text-[var(--landing-text-tertiary)] lg:table-cell">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>{relativeTime(m.updatedAt)}</span>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            {new Date(m.updatedAt).toLocaleString()}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="px-2 py-1.5">
                        <div className="flex items-center gap-0.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openView(m);
                                }}
                                className="h-6 w-6 p-0"
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View details</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedMemory(m);
                                  setEditContent(m.content);
                                  setViewMode("edit");
                                }}
                                className="h-6 w-6 p-0"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit (e)</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  requestPin(m);
                                }}
                                className={`h-6 w-6 p-0 ${m.pinnedAt ? "text-[#F97316]" : ""}`}
                              >
                                <Pin className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {m.pinnedAt ? "Unpin (p)" : "Pin (p)"}
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openHistory(m);
                                }}
                                className="h-6 w-6 p-0"
                              >
                                <History className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Version history</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  requestArchive(m, !m.archivedAt);
                                }}
                                className="h-6 w-6 p-0"
                              >
                                {m.archivedAt ? (
                                  <ArchiveRestore className="h-3 w-3" />
                                ) : (
                                  <Archive className="h-3 w-3" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {m.archivedAt
                                ? "Restore from archive"
                                : "Archive"}
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  requestDelete(m);
                                }}
                                className="h-6 w-6 p-0 text-red-500 hover:text-red-400"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete (d)</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-1.5 flex items-center justify-between px-1">
          <span className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">
            {filteredMemories.length} of {memories.length} memories
            {activeFilterCount > 0 &&
              ` (${activeFilterCount} filter${activeFilterCount > 1 ? "s" : ""} active)`}
          </span>
          <span className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">
            Sort: {sortLabel[sortField]}{" "}
            {sortDir === "desc" ? "\u2193" : "\u2191"}
          </span>
        </div>

        {/* View Dialog */}
        <Dialog
          open={viewMode === "view"}
          onOpenChange={() => setViewMode(null)}
        >
          <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col overflow-hidden bg-[var(--landing-surface)]">
            <DialogHeader className="pb-2">
              <DialogTitle className="flex items-center gap-2 font-mono text-sm text-[#F97316]">
                {selectedMemory?.pinnedAt && <Pin className="h-3.5 w-3.5" />}
                {selectedMemory?.key}
              </DialogTitle>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--landing-text-tertiary)]">
                {selectedMemory?.priority ? (
                  <span className="flex items-center gap-1">
                    <Star className="h-3 w-3 text-[#F97316]" />{" "}
                    {selectedMemory.priority}
                  </span>
                ) : null}
                <span>{relativeTime(selectedMemory?.updatedAt ?? "")}</span>
                {selectedMemory && (
                  <span
                    className={
                      getRelevanceBucket(computeRelevance(selectedMemory)).color
                    }
                  >
                    Relevance: {Math.round(computeRelevance(selectedMemory))}
                  </span>
                )}
                <span>Accessed {selectedMemory?.accessCount ?? 0}x</span>
              </div>
            </DialogHeader>
            <div className="flex-1 overflow-auto rounded-md bg-[var(--landing-code-bg)] p-3">
              <pre className="whitespace-pre-wrap font-mono text-xs text-[var(--landing-text-secondary)]">
                {selectedMemory?.content}
              </pre>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              {parseTags(selectedMemory?.tags ?? null).map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="border-[var(--landing-border)] text-[10px]"
                >
                  {tag}
                </Badge>
              ))}
            </div>
            {selectedMemory?.metadata && (
              <details className="text-xs">
                <summary className="cursor-pointer font-mono text-[var(--landing-text-tertiary)]">
                  Metadata
                </summary>
                <pre className="mt-1 overflow-auto rounded bg-[var(--landing-code-bg)] p-2 font-mono text-[10px] text-[var(--landing-text-tertiary)]">
                  {JSON.stringify(JSON.parse(selectedMemory.metadata), null, 2)}
                </pre>
              </details>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (selectedMemory) {
                    setEditContent(selectedMemory.content);
                    setViewMode("edit");
                  }
                }}
                className="gap-1 border-[var(--landing-border)]"
              >
                <Pencil className="h-3 w-3" /> Edit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog
          open={viewMode === "edit"}
          onOpenChange={() => setViewMode(null)}
        >
          <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col overflow-hidden bg-[var(--landing-surface)]">
            <DialogHeader className="shrink-0 pb-0">
              <DialogTitle className="flex items-center gap-2 font-mono text-sm text-[#F97316]">
                {selectedMemory?.pinnedAt && <Pin className="h-3.5 w-3.5" />}
                {selectedMemory?.key}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Edit memory content
              </DialogDescription>
            </DialogHeader>

            {/* Context strip */}
            {selectedMemory && (
              <div className="flex flex-wrap items-center gap-2 border-b border-[var(--landing-border)] pb-3">
                <div className="flex items-center gap-1 rounded bg-[var(--landing-surface-2)] px-2 py-1">
                  <Star className="h-3 w-3 text-[#F97316]" />
                  <span className="font-mono text-[10px] text-[var(--landing-text-secondary)]">
                    Pri {selectedMemory.priority ?? 0}
                  </span>
                </div>
                <div
                  className={`flex items-center gap-1 rounded px-2 py-1 ${getRelevanceBucket(computeRelevance(selectedMemory)).bg}`}
                >
                  <span
                    className={`font-mono text-[10px] font-bold ${getRelevanceBucket(computeRelevance(selectedMemory)).color}`}
                  >
                    {getRelevanceBucket(computeRelevance(selectedMemory)).label}
                  </span>
                  <span className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">
                    {Math.round(computeRelevance(selectedMemory))}
                  </span>
                </div>
                <div className="flex items-center gap-1 rounded bg-[var(--landing-surface-2)] px-2 py-1">
                  <span className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">
                    {selectedMemory.accessCount ?? 0} hits
                  </span>
                </div>
                <div className="flex items-center gap-1 rounded bg-[var(--landing-surface-2)] px-2 py-1">
                  <span className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">
                    {relativeTime(selectedMemory.updatedAt)}
                  </span>
                </div>
                {parseTags(selectedMemory.tags).map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="h-5 border-[var(--landing-border)] px-1.5 text-[10px]"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Editor area */}
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Content
                </span>
                <span className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">
                  {editContent.length} chars
                  {selectedMemory && editContent !== selectedMemory.content && (
                    <span className="ml-2 text-[#F97316]">modified</span>
                  )}
                </span>
              </div>
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[280px] flex-1 resize-y border-[var(--landing-border)] bg-[var(--landing-code-bg)] p-3 font-mono text-xs leading-relaxed"
                onKeyDown={(e) => {
                  if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleSave();
                  }
                }}
              />
              <p className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">
                A new version will be created on save.
                <kbd className="ml-2 rounded border border-[var(--landing-border)] bg-[var(--landing-surface-2)] px-1 py-0.5 text-[9px]">
                  Cmd+S
                </kbd>{" "}
                to save.
              </p>
            </div>

            {/* Metadata preview */}
            {selectedMemory?.metadata && (
              <details className="shrink-0 text-xs">
                <summary className="cursor-pointer font-mono text-[10px] text-[var(--landing-text-tertiary)]">
                  Metadata (read-only)
                </summary>
                <pre className="mt-1 max-h-24 overflow-auto rounded bg-[var(--landing-code-bg)] p-2 font-mono text-[10px] text-[var(--landing-text-tertiary)]">
                  {JSON.stringify(JSON.parse(selectedMemory.metadata), null, 2)}
                </pre>
              </details>
            )}

            <DialogFooter className="shrink-0 gap-2 border-t border-[var(--landing-border)] pt-3 sm:gap-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (selectedMemory) {
                    setEditContent(selectedMemory.content);
                  }
                }}
                disabled={
                  !selectedMemory || editContent === selectedMemory?.content
                }
                className="mr-auto border-[var(--landing-border)] text-xs"
              >
                Reset
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode(null)}
                className="border-[var(--landing-border)] text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={
                  actionLoading ||
                  !selectedMemory ||
                  editContent === selectedMemory?.content
                }
                className="bg-[#F97316] text-xs text-white hover:bg-[#EA580C]"
              >
                {actionLoading && (
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                )}
                {actionLoading ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* History Dialog */}
        <Dialog
          open={viewMode === "history"}
          onOpenChange={() => setViewMode(null)}
        >
          <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden bg-[var(--landing-surface)]">
            <DialogHeader>
              <DialogTitle className="font-mono text-sm">
                History: {selectedMemory?.key}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto">
              {loadingVersions ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-[#F97316]" />
                  <p className="mt-2 text-xs text-[var(--landing-text-tertiary)]">
                    Loading versions...
                  </p>
                </div>
              ) : versions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <History className="mb-2 h-5 w-5 text-[var(--landing-text-tertiary)]" />
                  <p className="text-xs text-[var(--landing-text-tertiary)]">
                    No version history.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {versions.map((v) => (
                    <div
                      key={v.id}
                      className="rounded-lg border border-[var(--landing-border)] p-2.5"
                    >
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="font-mono text-[11px] font-medium text-[var(--landing-text)]">
                          v{v.version}
                        </span>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="border-[var(--landing-border)] text-[9px]"
                          >
                            {v.changeType}
                          </Badge>
                          <span className="font-mono text-[9px] text-[var(--landing-text-tertiary)]">
                            {formatDate(v.createdAt)}
                          </span>
                        </div>
                      </div>
                      <pre className="max-h-24 overflow-auto rounded bg-[var(--landing-code-bg)] p-2 font-mono text-[10px] text-[var(--landing-text-secondary)]">
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

        {/* Keyboard Shortcuts Dialog */}
        <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
          <DialogContent className="max-w-sm bg-[var(--landing-surface)]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm">
                <Keyboard className="h-4 w-4" /> Keyboard Shortcuts
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 font-mono text-xs">
              {[
                ["j / k", "Navigate up/down"],
                ["Space", "Toggle selection"],
                ["Enter", "View memory"],
                ["e", "Edit memory"],
                ["d", "Delete focused"],
                ["p", "Pin/unpin focused"],
                ["/", "Focus search"],
                ["Escape", "Clear selection"],
                ["Ctrl+A", "Select all"],
                ["?", "Toggle shortcuts"],
              ].map(([key, desc]) => (
                <div key={key} className="contents">
                  <kbd className="rounded border border-[var(--landing-border)] bg-[var(--landing-surface-2)] px-1.5 py-0.5 text-[10px] text-[var(--landing-text)]">
                    {key}
                  </kbd>
                  <span className="py-0.5 text-[var(--landing-text-secondary)]">
                    {desc}
                  </span>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Confirmation Dialog */}
        <ConfirmDialog
          action={confirmAction}
          loading={actionLoading}
          onClose={() => {
            if (!actionLoading) setConfirmAction(null);
          }}
        />
      </div>
    </TooltipProvider>
  );
}
