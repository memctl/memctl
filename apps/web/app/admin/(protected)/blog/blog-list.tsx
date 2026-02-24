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
import { AdminPagination } from "@/components/admin/admin-pagination";
import { AdminTableLoader } from "@/components/admin/admin-table-loader";
import { SortableHeader } from "@/components/admin/sortable-header";
import { Search, Plus, FileText } from "lucide-react";
import { DeletePostButton } from "./delete-button";

interface Post {
  id: string;
  slug: string;
  title: string;
  status: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  authorName: string;
}

const PAGE_SIZE = 20;

export function BlogList() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sort, setSort] = useState("updatedAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (filterStatus !== "all") params.set("status", filterStatus);
    params.set("sort", sort);
    params.set("order", order);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String((page - 1) * PAGE_SIZE));

    const res = await fetch(`/api/v1/admin/blog?${params}`);
    const data = await res.json();
    setPosts(data.posts ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [searchQuery, filterStatus, sort, order, page]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

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
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--landing-text-tertiary)]" />
          <Input
            placeholder="Search by title..."
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
        <Link href="/admin/blog/new">
          <Button className="gap-2 bg-[#F97316] text-white hover:bg-[#FB923C]">
            <Plus className="h-4 w-4" />
            New Post
          </Button>
        </Link>
      </div>

      <div className="dash-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-[var(--landing-border)] bg-[var(--landing-code-bg)] hover:bg-[var(--landing-code-bg)]">
                <SortableHeader
                  label="Title"
                  field="title"
                  currentSort={sort}
                  currentOrder={order}
                  onSort={handleSort}
                />
                <TableHead className="hidden font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)] sm:table-cell">
                  Status
                </TableHead>
                <TableHead className="hidden font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)] md:table-cell">
                  Author
                </TableHead>
                <SortableHeader
                  label="Updated"
                  field="updatedAt"
                  currentSort={sort}
                  currentOrder={order}
                  onSort={handleSort}
                  className="hidden lg:table-cell"
                />
                <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <AdminTableLoader colSpan={5} />
              ) : posts.length === 0 ? (
                <TableRow className="border-[var(--landing-border)]">
                  <TableCell colSpan={5} className="py-8 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="h-8 w-8 text-[var(--landing-text-tertiary)]" />
                      <span className="font-mono text-sm text-[var(--landing-text-tertiary)]">
                        {hasFilters ? "No posts found" : "No posts yet"}
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
                posts.map((post) => (
                  <TableRow
                    key={post.id}
                    className="border-[var(--landing-border)]"
                  >
                    <TableCell>
                      <span className="font-medium text-[var(--landing-text)]">
                        {post.title}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          post.status === "published"
                            ? "bg-emerald-500/10 text-emerald-500"
                            : "bg-amber-500/10 text-amber-500"
                        }`}
                      >
                        {post.status === "published" ? "Published" : "Draft"}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-sm text-[var(--landing-text-secondary)] md:table-cell">
                      {post.authorName}
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs text-[var(--landing-text-tertiary)] lg:table-cell">
                      {new Date(post.updatedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/admin/blog/${post.slug}/edit`}
                          className="text-xs font-medium text-[var(--landing-text-secondary)] transition-colors hover:text-[#F97316]"
                        >
                          Edit
                        </Link>
                        <DeletePostButton
                          slug={post.slug}
                          title={post.title}
                          onDeleted={fetchPosts}
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
