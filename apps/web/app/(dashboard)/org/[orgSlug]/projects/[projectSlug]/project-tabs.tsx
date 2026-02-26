"use client";

import { Suspense, useRef, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  Brain,
  Zap,
  Trash2,
  Settings,
  Users,
  ChevronLeft,
  ChevronRight,
  Network,
} from "lucide-react";
import { MemoryBrowser } from "@/components/dashboard/memories/memory-browser";
import { MemoryGraph } from "@/components/dashboard/memories/memory-graph";
import { ActivityFeed } from "../../activity/activity-feed";
import { HygieneDashboard } from "../../hygiene/hygiene-dashboard";
import type { ProjectSettingsProps } from "./project-settings";
import { ProjectSettings } from "./project-settings";
import type { ProjectMembersProps } from "./project-members";
import { ProjectMembers } from "./project-members";
import { ActivitySkeleton } from "@/components/activity/activity-skeleton";
import {
  MemoriesSkeleton,
  GraphSkeleton,
  MembersSkeleton,
  CleanupSkeleton,
} from "@/components/dashboard/tab-skeletons";

export interface ProjectTabsProps {
  orgSlug: string;
  projectSlug: string;
  projectId: string;
  isAdmin: boolean;
  currentUserId: string;
  mcpConfig: string;
  activeCount: number;
  archivedCount: number;
  settingsData: ProjectSettingsProps["project"];
}

type TabDataMap = {
  memories: SerializedMemory[];
  graph: SerializedMemory[];
  members: ProjectMembersProps["members"];
  activity: ActivityTabData;
  cleanup: HygieneTabData;
  settings: null;
};

interface SerializedMemory {
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
  [key: string]: unknown;
}

interface ActivityItem {
  id: string;
  action: string;
  toolName: string | null;
  memoryKey: string | null;
  details: string | null;
  sessionId: string | null;
  projectName: string;
  createdByName: string | null;
  createdAt: string;
}

interface SessionItem {
  id: string;
  sessionId: string;
  branch: string | null;
  summary: string | null;
  keysRead: string | null;
  keysWritten: string | null;
  toolsUsed: string | null;
  startedAt: string;
  endedAt: string | null;
  projectName: string;
}

interface AuditLogItem {
  id: string;
  action: string;
  actorName: string;
  targetUserName: string | null;
  details: string | null;
  createdAt: string;
}

interface ActivityTabData {
  activities: ActivityItem[];
  auditLogs: AuditLogItem[];
  sessions: SessionItem[];
  stats: {
    totalActions: number;
    actionBreakdown: Record<string, number>;
    activeSessions: number;
    totalSessions: number;
  };
  initialCursor: string | null;
  initialSessionsCursor: string | null;
}

interface HygieneTabData {
  healthBuckets: {
    critical: number;
    low: number;
    medium: number;
    healthy: number;
  };
  staleMemories: Array<{
    key: string;
    project: string;
    lastAccessedAt: string | null;
    priority: number;
  }>;
  expiringMemories: Array<{ key: string; project: string; expiresAt: string }>;
  growth: Array<{ week: string; count: number }>;
  capacity: { used: number; limit: number | null; usagePercent: number };
  tableSizes?: { versions: number; activityLogs: number; expiredLocks: number };
}

const TAB_DEFS: Array<{
  id: string;
  label: string;
  icon: typeof Brain;
  adminOnly?: boolean;
}> = [
  { id: "memories", label: "Memories", icon: Brain },
  { id: "graph", label: "Graph", icon: Network },
  { id: "members", label: "Members", icon: Users, adminOnly: true },
  { id: "activity", label: "Activity", icon: Zap, adminOnly: true },
  { id: "cleanup", label: "Cleanup", icon: Trash2 },
  { id: "settings", label: "Settings", icon: Settings, adminOnly: true },
];

function useTabData<T extends keyof TabDataMap>(
  tab: T,
  currentTab: string,
  orgSlug: string,
  projectSlug: string,
  cache: React.RefObject<Map<string, unknown>>,
): { data: TabDataMap[T] | null; isLoading: boolean; invalidate: () => void } {
  const [data, setData] = useState<TabDataMap[T] | null>(() => {
    const cached = cache.current?.get(tab);
    return cached ? (cached as TabDataMap[T]) : null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [version, setVersion] = useState(0);

  const invalidate = useCallback(() => {
    const cacheKey = tab === "graph" ? "memories" : tab;
    cache.current?.delete(cacheKey);
    setVersion((v) => v + 1);
  }, [tab, cache]);

  useEffect(() => {
    if (currentTab !== tab && currentTab !== "graph" && tab !== "memories")
      return;
    // Graph reuses memories data
    const cacheKey = tab === "graph" ? "memories" : tab;
    if (tab === "settings") return;

    const cached = cache.current?.get(cacheKey);
    if (cached) {
      setData(cached as TabDataMap[T]);
      return;
    }

    // Only fetch when this tab is active
    if (currentTab !== tab) return;

    let cancelled = false;
    setIsLoading(true);

    const basePath = `/api/v1/orgs/${orgSlug}/projects/${projectSlug}`;

    async function fetchData() {
      try {
        if (cacheKey === "memories") {
          const res = await fetch(`${basePath}/memories`);
          if (!res.ok) throw new Error("Failed to fetch memories");
          const json = await res.json();
          if (!cancelled) {
            cache.current?.set("memories", json.result);
            setData(json.result as TabDataMap[T]);
          }
        } else if (cacheKey === "members") {
          const res = await fetch(`${basePath}/members`);
          if (!res.ok) throw new Error("Failed to fetch members");
          const json = await res.json();
          if (!cancelled) {
            cache.current?.set("members", json.result);
            setData(json.result as TabDataMap[T]);
          }
        } else if (cacheKey === "activity") {
          const [actRes, sessRes] = await Promise.all([
            fetch(`${basePath}/activity`),
            fetch(`${basePath}/activity/sessions`),
          ]);
          if (!actRes.ok || !sessRes.ok)
            throw new Error("Failed to fetch activity");
          const [actJson, sessJson] = await Promise.all([
            actRes.json(),
            sessRes.json(),
          ]);

          const activities: ActivityItem[] = actJson.activities ?? [];
          const auditLogs: AuditLogItem[] = actJson.auditLogs ?? [];
          const sessions: SessionItem[] = sessJson.sessions ?? [];

          const actionBreakdown: Record<string, number> = {};
          for (const a of activities) {
            actionBreakdown[a.action] = (actionBreakdown[a.action] ?? 0) + 1;
          }

          const allDates = [
            ...activities.map((a) => a.createdAt),
            ...auditLogs.map((a) => a.createdAt),
          ]
            .filter(Boolean)
            .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

          const result: ActivityTabData = {
            activities,
            auditLogs,
            sessions,
            stats: {
              totalActions: activities.length,
              actionBreakdown,
              activeSessions: sessions.filter((s) => !s.endedAt).length,
              totalSessions: sessions.length,
            },
            initialCursor:
              allDates.length > 0 ? allDates[allDates.length - 1] : null,
            initialSessionsCursor:
              sessions.length > 0
                ? sessions[sessions.length - 1].startedAt
                : null,
          };

          if (!cancelled) {
            cache.current?.set("activity", result);
            setData(result as TabDataMap[T]);
          }
        } else if (cacheKey === "cleanup") {
          const res = await fetch(`${basePath}/hygiene`);
          if (!res.ok) throw new Error("Failed to fetch hygiene data");
          const json = await res.json();
          if (!cancelled) {
            cache.current?.set("cleanup", json.result);
            setData(json.result as TabDataMap[T]);
          }
        }
      } catch {
        // Silently fail, user can switch tabs again to retry
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [currentTab, tab, orgSlug, projectSlug, cache, version]);

  return { data, isLoading, invalidate };
}

function ProjectTabsInner({
  orgSlug,
  projectSlug,
  projectId,
  isAdmin,
  currentUserId,
  mcpConfig,
  settingsData,
}: ProjectTabsProps) {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") ?? "memories";
  const [currentTab, setCurrentTab] = useState(initialTab);

  const tabs = TAB_DEFS.filter((t) => !t.adminOnly || isAdmin);
  const currentIndex = tabs.findIndex((t) => t.id === currentTab);
  const [prevIndex, setPrevIndex] = useState(currentIndex);

  // Track direction for slide animation
  const direction = currentIndex >= prevIndex ? 1 : -1;
  useEffect(() => {
    setPrevIndex(currentIndex);
  }, [currentIndex]);

  // Animated underline positioning
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const navRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Shared tab data cache
  const tabCache = useRef<Map<string, unknown>>(new Map());

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  const updateIndicator = useCallback(() => {
    const el = tabRefs.current.get(currentTab);
    if (el) {
      setIndicator({
        left: el.offsetLeft,
        width: el.offsetWidth,
      });
    }
  }, [currentTab]);

  useEffect(() => {
    updateIndicator();
    checkScroll();
    window.addEventListener("resize", updateIndicator);
    window.addEventListener("resize", checkScroll);
    return () => {
      window.removeEventListener("resize", updateIndicator);
      window.removeEventListener("resize", checkScroll);
    };
  }, [updateIndicator, checkScroll]);

  // Scroll active tab into view on change
  useEffect(() => {
    const el = tabRefs.current.get(currentTab);
    const container = scrollRef.current;
    if (el && container) {
      const elLeft = el.offsetLeft;
      const elRight = elLeft + el.offsetWidth;
      const visLeft = container.scrollLeft;
      const visRight = visLeft + container.clientWidth;
      if (elLeft < visLeft) {
        container.scrollTo({ left: elLeft - 8, behavior: "smooth" });
      } else if (elRight > visRight) {
        container.scrollTo({
          left: elRight - container.clientWidth + 8,
          behavior: "smooth",
        });
      }
    }
  }, [currentTab]);

  const handleTabChange = (id: string) => {
    setCurrentTab(id);
    const params = new URLSearchParams(searchParams.toString());
    if (id === "memories") {
      params.delete("tab");
    } else {
      params.set("tab", id);
    }
    const qs = params.toString();
    const newUrl = `/org/${orgSlug}/projects/${projectSlug}${qs ? `?${qs}` : ""}`;
    window.history.replaceState(null, "", newUrl);
  };

  // Per-tab data hooks
  const memoriesTab = useTabData(
    "memories",
    currentTab,
    orgSlug,
    projectSlug,
    tabCache,
  );
  const membersTab = useTabData(
    "members",
    currentTab,
    orgSlug,
    projectSlug,
    tabCache,
  );
  const activityTab = useTabData(
    "activity",
    currentTab,
    orgSlug,
    projectSlug,
    tabCache,
  );
  const cleanupTab = useTabData(
    "cleanup",
    currentTab,
    orgSlug,
    projectSlug,
    tabCache,
  );

  // Graph reuses memories data
  const graphData = memoriesTab.data;

  // Pre-fetch memories when on graph tab
  const graphTab = useTabData(
    "graph",
    currentTab,
    orgSlug,
    projectSlug,
    tabCache,
  );
  const effectiveGraphData = graphTab.data ?? graphData;
  const effectiveGraphLoading =
    currentTab === "graph" &&
    !effectiveGraphData &&
    (graphTab.isLoading || memoriesTab.isLoading);

  const activityApiPath = `/api/v1/orgs/${orgSlug}/projects/${projectSlug}/activity`;
  const sessionsApiPath = `/api/v1/orgs/${orgSlug}/projects/${projectSlug}/activity/sessions`;

  return (
    <div>
      {/* Tab bar */}
      <div
        ref={navRef}
        className="relative mb-6 border-b border-[var(--landing-border)]"
      >
        {canScrollLeft && (
          <button
            onClick={() =>
              scrollRef.current?.scrollBy({ left: -120, behavior: "smooth" })
            }
            className="via-[var(--landing-bg)]/80 absolute bottom-0 left-0 top-0 z-10 flex w-8 items-center justify-start bg-gradient-to-r from-[var(--landing-bg)] to-transparent pl-1"
          >
            <ChevronLeft className="h-4 w-4 text-[var(--landing-text-tertiary)]" />
          </button>
        )}
        {canScrollRight && (
          <button
            onClick={() =>
              scrollRef.current?.scrollBy({ left: 120, behavior: "smooth" })
            }
            className="via-[var(--landing-bg)]/80 absolute bottom-0 right-0 top-0 z-10 flex w-8 items-center justify-end bg-gradient-to-l from-[var(--landing-bg)] to-transparent pr-1"
          >
            <ChevronRight className="h-4 w-4 text-[var(--landing-text-tertiary)]" />
          </button>
        )}
        <div
          ref={scrollRef}
          className="scrollbar-hide relative flex overflow-x-auto"
          onScroll={() => {
            checkScroll();
            updateIndicator();
          }}
        >
          {tabs.map((tab) => {
            const isActive = tab.id === currentTab;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  if (el) tabRefs.current.set(tab.id, el);
                }}
                onClick={() => handleTabChange(tab.id)}
                className="relative flex shrink-0 items-center gap-1.5 px-4 py-2.5 font-mono text-xs font-medium outline-none transition-colors"
                style={{
                  color: isActive
                    ? "var(--landing-text)"
                    : "var(--landing-text-tertiary)",
                }}
              >
                <Icon
                  className="h-3.5 w-3.5 transition-colors"
                  style={{
                    color: isActive ? "#F97316" : undefined,
                  }}
                />
                {tab.label}
                {isActive && (
                  <motion.span
                    layoutId="tab-dot"
                    className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-[#F97316]"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
            );
          })}

          {/* Animated underline (inside scroll container so it tracks scroll) */}
          <motion.div
            className="absolute bottom-0 h-0.5 bg-[#F97316]"
            animate={{ left: indicator.left, width: indicator.width }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{ borderRadius: "1px" }}
          />
        </div>
      </div>

      {/* Animated content */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={currentTab}
          initial={{ opacity: 0, y: direction * 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: direction * -8 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
        >
          {currentTab === "memories" && (
            <>
              {memoriesTab.isLoading || !memoriesTab.data ? (
                <MemoriesSkeleton />
              ) : memoriesTab.data.length === 0 ? (
                <div className="dash-card flex flex-col items-center justify-center py-12 text-center">
                  <Brain className="mb-3 h-8 w-8 text-[var(--landing-text-tertiary)]" />
                  <p className="mb-1 font-mono text-sm font-medium text-[var(--landing-text)]">
                    No memories stored yet
                  </p>
                  <p className="text-xs text-[var(--landing-text-tertiary)]">
                    Use the MCP server to store memories, or import from an
                    AGENTS.md file.
                  </p>
                </div>
              ) : (
                <MemoryBrowser
                  memories={memoriesTab.data}
                  orgSlug={orgSlug}
                  projectSlug={projectSlug}
                  onMutate={memoriesTab.invalidate}
                />
              )}
            </>
          )}

          {currentTab === "graph" && (
            <>
              {effectiveGraphLoading || !effectiveGraphData ? (
                <GraphSkeleton />
              ) : (
                <MemoryGraph memories={effectiveGraphData} />
              )}
            </>
          )}

          {currentTab === "members" && isAdmin && (
            <>
              {membersTab.isLoading || !membersTab.data ? (
                <MembersSkeleton />
              ) : (
                <ProjectMembers
                  orgSlug={orgSlug}
                  projectSlug={projectSlug}
                  projectId={projectId}
                  members={membersTab.data}
                  currentUserId={currentUserId}
                />
              )}
            </>
          )}

          {currentTab === "activity" && isAdmin && (
            <>
              {activityTab.isLoading || !activityTab.data ? (
                <ActivitySkeleton />
              ) : (
                <ActivityFeed
                  activities={activityTab.data.activities}
                  auditLogs={activityTab.data.auditLogs}
                  sessions={activityTab.data.sessions}
                  stats={activityTab.data.stats}
                  apiPath={activityApiPath}
                  sessionsApiPath={sessionsApiPath}
                  initialCursor={activityTab.data.initialCursor}
                  initialSessionsCursor={activityTab.data.initialSessionsCursor}
                />
              )}
            </>
          )}

          {currentTab === "cleanup" && (
            <>
              {cleanupTab.isLoading || !cleanupTab.data ? (
                <CleanupSkeleton />
              ) : (
                <HygieneDashboard
                  healthBuckets={cleanupTab.data.healthBuckets}
                  staleMemories={cleanupTab.data.staleMemories}
                  expiringMemories={cleanupTab.data.expiringMemories}
                  growth={cleanupTab.data.growth}
                  capacity={cleanupTab.data.capacity}
                  orgSlug={orgSlug}
                  projectSlug={projectSlug}
                  tableSizes={cleanupTab.data.tableSizes}
                />
              )}
            </>
          )}

          {currentTab === "settings" && isAdmin && (
            <ProjectSettings
              orgSlug={orgSlug}
              projectSlug={projectSlug}
              project={settingsData}
              mcpConfig={mcpConfig}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function ProjectTabs(props: ProjectTabsProps) {
  return (
    <Suspense>
      <ProjectTabsInner {...props} />
    </Suspense>
  );
}
