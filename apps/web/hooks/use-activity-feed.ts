"use client";

import { useState, useCallback, useRef } from "react";
import type {
  ActivityItem,
  AuditLogItem,
  SessionItem,
  ActivityFilters,
  ActivityFeedResponse,
  SessionFeedResponse,
} from "@/lib/activity-types";

interface UseActivityFeedOptions {
  apiPath: string;
  initialActivities: ActivityItem[];
  initialAuditLogs: AuditLogItem[];
  initialCursor: string | null;
  pageSize?: number;
}

export function useActivityFeed({
  apiPath,
  initialActivities,
  initialAuditLogs,
  initialCursor,
  pageSize = 50,
}: UseActivityFeedOptions) {
  const [activities, setActivities] = useState(initialActivities);
  const [auditLogs, setAuditLogs] = useState(initialAuditLogs);
  const [cursor, setCursor] = useState(initialCursor);
  const [hasMore, setHasMore] = useState(initialCursor !== null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [filters, setFilters] = useState<ActivityFilters>({});
  const abortRef = useRef<AbortController | null>(null);

  const buildUrl = useCallback(
    (cursorVal: string | null, filtersVal: ActivityFilters) => {
      const params = new URLSearchParams();
      if (cursorVal) params.set("cursor", cursorVal);
      params.set("limit", String(pageSize));
      if (filtersVal.action) params.set("action", filtersVal.action);
      if (filtersVal.from) params.set("from", filtersVal.from);
      if (filtersVal.to) params.set("to", filtersVal.to);
      if (filtersVal.search) params.set("search", filtersVal.search);
      if (filtersVal.source && filtersVal.source !== "all") {
        params.set(
          "type",
          filtersVal.source === "usage"
            ? "activity"
            : filtersVal.source === "dashboard"
              ? "audit"
              : "all",
        );
      }
      return `${apiPath}?${params.toString()}`;
    },
    [apiPath, pageSize],
  );

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore || !cursor) return;
    setIsLoading(true);

    try {
      const res = await fetch(buildUrl(cursor, filters));
      if (!res.ok) throw new Error("Failed to fetch");
      const data: ActivityFeedResponse = await res.json();

      setActivities((prev) => [...prev, ...data.activities]);
      setAuditLogs((prev) => [...prev, ...data.auditLogs]);
      setCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch {
      // Silently fail on network errors, user can retry by scrolling
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, hasMore, cursor, filters, buildUrl]);

  const applyFilters = useCallback(
    async (newFilters: ActivityFilters) => {
      // Cancel in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setFilters(newFilters);
      setIsFiltering(true);

      try {
        const res = await fetch(buildUrl(null, newFilters), {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed to fetch");
        const data: ActivityFeedResponse = await res.json();

        setActivities(data.activities);
        setAuditLogs(data.auditLogs);
        setCursor(data.nextCursor);
        setHasMore(data.hasMore);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      } finally {
        if (!controller.signal.aborted) {
          setIsFiltering(false);
        }
      }
    },
    [buildUrl],
  );

  return {
    activities,
    auditLogs,
    cursor,
    hasMore,
    isLoading,
    isFiltering,
    filters,
    loadMore,
    applyFilters,
  };
}

interface UseSessionFeedOptions {
  apiPath: string;
  initialSessions: SessionItem[];
  initialCursor: string | null;
  pageSize?: number;
}

export function useSessionFeed({
  apiPath,
  initialSessions,
  initialCursor,
  pageSize = 20,
}: UseSessionFeedOptions) {
  const [sessions, setSessions] = useState(initialSessions);
  const [cursor, setCursor] = useState(initialCursor);
  const [hasMore, setHasMore] = useState(initialCursor !== null);
  const [isLoading, setIsLoading] = useState(false);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore || !cursor) return;
    setIsLoading(true);

    try {
      const params = new URLSearchParams();
      params.set("cursor", cursor);
      params.set("limit", String(pageSize));

      const res = await fetch(`${apiPath}?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data: SessionFeedResponse = await res.json();

      setSessions((prev) => [...prev, ...data.sessions]);
      setCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, hasMore, cursor, apiPath, pageSize]);

  return {
    sessions,
    hasMore,
    isLoading,
    loadMore,
  };
}
