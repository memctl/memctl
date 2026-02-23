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
import { Search } from "lucide-react";

interface Org {
  id: string;
  name: string;
  slug: string;
  planId: string;
  status: string;
  createdAt: string;
  ownerName: string;
  projectCount: number;
  memberCount: number;
}

const PAGE_SIZE = 25;

const planBadgeStyles: Record<string, string> = {
  free: "bg-[var(--landing-surface-2)] text-[var(--landing-text-secondary)]",
  lite: "bg-blue-500/10 text-blue-500",
  pro: "bg-[#F97316]/10 text-[#F97316]",
  business: "bg-purple-500/10 text-purple-500",
  scale: "bg-emerald-500/10 text-emerald-500",
  enterprise: "bg-amber-500/10 text-amber-500",
};

const statusBadgeStyles: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-500",
  suspended: "bg-amber-500/10 text-amber-500",
  banned: "bg-red-500/10 text-red-500",
};

export function OrganizationsList() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPlan, setFilterPlan] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (filterPlan !== "all") params.set("plan", filterPlan);
    if (filterStatus !== "all") params.set("status", filterStatus);
    params.set("sort", sort);
    params.set("order", order);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String((page - 1) * PAGE_SIZE));

    const res = await fetch(`/api/v1/admin/organizations?${params}`);
    const data = await res.json();
    setOrgs(data.organizations ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [searchQuery, filterPlan, filterStatus, sort, order, page]);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, filterPlan, filterStatus, sort, order]);

  function handleSort(field: string) {
    if (sort === field) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setSort(field);
      setOrder("asc");
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--landing-text-tertiary)]" />
          <Input
            placeholder="Search name, slug, or owner..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterPlan} onValueChange={setFilterPlan}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Plan" />
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
            <SelectItem value="all">All Plans</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="lite">Lite</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
            <SelectItem value="business">Business</SelectItem>
            <SelectItem value="scale">Scale</SelectItem>
            <SelectItem value="enterprise">Enterprise</SelectItem>
          </SelectContent>
        </Select>
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
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="banned">Banned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="dash-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-[var(--landing-border)] bg-[var(--landing-code-bg)] hover:bg-[var(--landing-code-bg)]">
                <SortableHeader
                  label="Name"
                  field="name"
                  currentSort={sort}
                  currentOrder={order}
                  onSort={handleSort}
                />
                <TableHead className="hidden sm:table-cell font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Slug
                </TableHead>
                <TableHead className="hidden md:table-cell font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Owner
                </TableHead>
                <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Plan
                </TableHead>
                <TableHead className="hidden sm:table-cell font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Status
                </TableHead>
                <SortableHeader
                  label="Projects"
                  field="projects"
                  currentSort={sort}
                  currentOrder={order}
                  onSort={handleSort}
                  className="text-right"
                />
                <SortableHeader
                  label="Members"
                  field="members"
                  currentSort={sort}
                  currentOrder={order}
                  onSort={handleSort}
                  className="text-right"
                />
                <SortableHeader
                  label="Created"
                  field="createdAt"
                  currentSort={sort}
                  currentOrder={order}
                  onSort={handleSort}
                  className="hidden lg:table-cell"
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-[var(--landing-border)]">
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-12" />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-4 w-8" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-4 w-8" />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  </TableRow>
                ))
              ) : orgs.length === 0 ? (
                <TableRow className="border-[var(--landing-border)]">
                  <TableCell
                    colSpan={8}
                    className="py-8 text-center font-mono text-sm text-[var(--landing-text-tertiary)]"
                  >
                    {searchQuery || filterPlan !== "all" || filterStatus !== "all"
                      ? "No organizations found"
                      : "No organizations yet"}
                  </TableCell>
                </TableRow>
              ) : (
                orgs.map((org) => (
                  <TableRow
                    key={org.id}
                    className="border-[var(--landing-border)]"
                  >
                    <TableCell>
                      <Link
                        href={`/admin/organizations/${org.slug}`}
                        className="text-sm font-medium text-[var(--landing-text)] transition-colors hover:text-[#F97316]"
                      >
                        {org.name}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell font-mono text-xs text-[var(--landing-text-tertiary)]">
                      {org.slug}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-[var(--landing-text-secondary)]">
                      {org.ownerName}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium capitalize ${
                          planBadgeStyles[org.planId] ?? planBadgeStyles.free
                        }`}
                      >
                        {org.planId}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium capitalize ${
                          statusBadgeStyles[org.status] ?? statusBadgeStyles.active
                        }`}
                      >
                        {org.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-[var(--landing-text-secondary)]">
                      {org.projectCount}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-[var(--landing-text-secondary)]">
                      {org.memberCount}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell font-mono text-xs text-[var(--landing-text-tertiary)]">
                      {new Date(org.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
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
