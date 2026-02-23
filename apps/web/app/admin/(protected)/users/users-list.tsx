"use client";

import { useState, useEffect, useCallback } from "react";
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
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { SortableHeader } from "@/components/admin/sortable-header";
import { Search } from "lucide-react";
import { UserAdminToggle } from "./user-admin-toggle";

interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  githubId: string | null;
  isAdmin: boolean | null;
  createdAt: string;
  orgCount: number;
}

const PAGE_SIZE = 25;

export function UsersList() {
  const [userList, setUserList] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAdmin, setFilterAdmin] = useState("all");
  const [filterHasOrgs, setFilterHasOrgs] = useState("all");
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (filterAdmin !== "all") params.set("admin", filterAdmin);
    if (filterHasOrgs !== "all") params.set("hasOrgs", filterHasOrgs);
    params.set("sort", sort);
    params.set("order", order);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String((page - 1) * PAGE_SIZE));

    const res = await fetch(`/api/v1/admin/users?${params}`);
    const data = await res.json();
    setUserList(data.users ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [searchQuery, filterAdmin, filterHasOrgs, sort, order, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, filterAdmin, filterHasOrgs, sort, order]);

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
            placeholder="Search name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterAdmin} onValueChange={setFilterAdmin}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Admin" />
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
            <SelectItem value="yes">Admins</SelectItem>
            <SelectItem value="no">Non-Admins</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterHasOrgs} onValueChange={setFilterHasOrgs}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Has Orgs" />
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
            <SelectItem value="yes">Has Orgs</SelectItem>
            <SelectItem value="no">No Orgs</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="dash-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-[var(--landing-border)] bg-[var(--landing-code-bg)] hover:bg-[var(--landing-code-bg)]">
                <SortableHeader
                  label="User"
                  field="name"
                  currentSort={sort}
                  currentOrder={order}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Email"
                  field="email"
                  currentSort={sort}
                  currentOrder={order}
                  onSort={handleSort}
                />
                <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Admin
                </TableHead>
                <TableHead className="hidden md:table-cell font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  GitHub ID
                </TableHead>
                <SortableHeader
                  label="Orgs"
                  field="orgs"
                  currentSort={sort}
                  currentOrder={order}
                  onSort={handleSort}
                  className="hidden sm:table-cell text-right"
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
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-10" />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Skeleton className="ml-auto h-4 w-8" />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  </TableRow>
                ))
              ) : userList.length === 0 ? (
                <TableRow className="border-[var(--landing-border)]">
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center font-mono text-sm text-[var(--landing-text-tertiary)]"
                  >
                    {searchQuery || filterAdmin !== "all" || filterHasOrgs !== "all"
                      ? "No users found"
                      : "No users yet"}
                  </TableCell>
                </TableRow>
              ) : (
                userList.map((user) => {
                  const initials = user.name
                    ? user.name
                        .split(" ")
                        .map((w) => w[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)
                    : "?";
                  return (
                    <TableRow
                      key={user.id}
                      className="border-[var(--landing-border)]"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 border border-[var(--landing-border)]">
                            {user.avatarUrl && (
                              <AvatarImage
                                src={user.avatarUrl}
                                alt={user.name}
                              />
                            )}
                            <AvatarFallback className="bg-[var(--landing-surface-2)] font-mono text-xs text-[var(--landing-text-secondary)]">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium text-[var(--landing-text)]">
                            {user.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-[var(--landing-text-secondary)]">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        <UserAdminToggle
                          userId={user.id}
                          initialIsAdmin={!!user.isAdmin}
                        />
                      </TableCell>
                      <TableCell className="hidden md:table-cell font-mono text-xs text-[var(--landing-text-tertiary)]">
                        {user.githubId ?? "\u2014"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-right font-mono text-xs text-[var(--landing-text-secondary)]">
                        {user.orgCount}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell font-mono text-xs text-[var(--landing-text-tertiary)]">
                        {new Date(user.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </TableCell>
                    </TableRow>
                  );
                })
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
