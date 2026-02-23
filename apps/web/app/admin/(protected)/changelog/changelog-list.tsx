"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { SortableHeader } from "@/components/admin/sortable-header";
import { Search, Plus, History } from "lucide-react";
import { DeleteEntryButton } from "./delete-button";

interface Entry {
  id: string;
  version: string;
  title: string;
  status: string;
  releaseDate: string;
  createdAt: string;
  updatedAt: string;
  authorName: string;
  itemCount: number;
}

const PAGE_SIZE = 20;

export function ChangelogList() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sort, setSort] = useState("releaseDate");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (filterStatus !== "all") params.set("status", filterStatus);
    params.set("sort", sort);
    params.set("order", order);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String((page - 1) * PAGE_SIZE));

    const res = await fetch(`/api/v1/admin/changelog?${params}`);
    const data = await res.json();
    setEntries(data.entries ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [searchQuery, filterStatus, sort, order, page]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, filterStatus, sort, order]);

  function handleSort(field: string) {
    if (sort === field) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setSort(field);
      setOrder("asc");
    }
  }

  const hasFilters = searchQuery || filterStatus !== "all";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--landing-text-tertiary)]" />
          <Input
            placeholder="Search version or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent
            position="popper"
            align="start"
            sideOffset={4}
            style={{
              backgroundColor: "var(--landing-surface)",
              borderColor: "var(--landing-border)",
            }}
          >
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>
        <Link href="/admin/changelog/new">
          <Button className="gap-2 bg-[#F97316] text-white hover:bg-[#FB923C]">
            <Plus className="h-4 w-4" />
            New Entry
          </Button>
        </Link>
      </div>

      <div className="dash-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-[var(--landing-border)] bg-[var(--landing-code-bg)] hover:bg-[var(--landing-code-bg)]">
                <SortableHeader
                  label="Version"
                  field="version"
                  currentSort={sort}
                  currentOrder={order}
                  onSort={handleSort}
                />
                <TableHead className="hidden sm:table-cell font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Title
                </TableHead>
                <TableHead className="hidden md:table-cell font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Status
                </TableHead>
                <SortableHeader
                  label="Release Date"
                  field="releaseDate"
                  currentSort={sort}
                  currentOrder={order}
                  onSort={handleSort}
                  className="hidden lg:table-cell"
                />
                <SortableHeader
                  label="Changes"
                  field="changes"
                  currentSort={sort}
                  currentOrder={order}
                  onSort={handleSort}
                  className="hidden lg:table-cell text-right"
                />
                <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-[var(--landing-border)]">
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Skeleton className="ml-auto h-4 w-8" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-4 w-16" />
                    </TableCell>
                  </TableRow>
                ))
              ) : entries.length === 0 ? (
                <TableRow className="border-[var(--landing-border)]">
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <History className="h-8 w-8 text-[var(--landing-text-tertiary)]" />
                      <span className="font-mono text-sm text-[var(--landing-text-tertiary)]">
                        {hasFilters ? "No entries found" : "No entries yet"}
                      </span>
                      {hasFilters && (
                        <span className="font-mono text-xs text-[var(--landing-text-tertiary)]">
                          Try adjusting your filters
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => (
                  <TableRow
                    key={entry.id}
                    className="border-[var(--landing-border)]"
                  >
                    <TableCell>
                      <span className="font-mono text-sm font-semibold text-[#F97316]">
                        v{entry.version}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-sm font-medium text-[var(--landing-text)] sm:table-cell">
                      {entry.title}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          entry.status === "published"
                            ? "bg-emerald-500/10 text-emerald-500"
                            : "bg-amber-500/10 text-amber-500"
                        }`}
                      >
                        {entry.status === "published" ? "Published" : "Draft"}
                      </span>
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs text-[var(--landing-text-tertiary)] lg:table-cell">
                      {new Date(entry.releaseDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="hidden text-right font-mono text-xs text-[var(--landing-text-tertiary)] lg:table-cell">
                      {entry.itemCount}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/admin/changelog/${entry.version}/edit`}
                          className="text-xs font-medium text-[var(--landing-text-secondary)] transition-colors hover:text-[#F97316]"
                        >
                          Edit
                        </Link>
                        <DeleteEntryButton
                          version={entry.version}
                          title={entry.title}
                          onDeleted={fetchEntries}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <AdminPagination
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
