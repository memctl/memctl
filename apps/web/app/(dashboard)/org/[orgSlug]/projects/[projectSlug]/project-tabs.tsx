"use client";

import { Suspense, useRef, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

interface ActivityStats {
  totalActions: number;
  actionBreakdown: Record<string, number>;
  activeSessions: number;
  totalSessions: number;
}

interface HygieneData {
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

interface AuditLogItem {
  id: string;
  action: string;
  actorName: string;
  targetUserName: string | null;
  details: string | null;
  createdAt: string;
}

export interface ProjectTabsProps {
  orgSlug: string;
  projectSlug: string;
  projectId: string;
  isAdmin: boolean;
  currentUserId: string;
  memories: SerializedMemory[];
  mcpConfig: string;
  activities: ActivityItem[];
  auditLogs: AuditLogItem[];
  sessions: SessionItem[];
  activityStats: ActivityStats;
  hygieneData: HygieneData;
  settingsData: ProjectSettingsProps["project"];
  membersData: ProjectMembersProps["members"];
  activityApiPath?: string;
  sessionsApiPath?: string;
  initialActivityCursor?: string | null;
  initialSessionsCursor?: string | null;
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

function ProjectTabsInner({
  orgSlug,
  projectSlug,
  projectId,
  isAdmin,
  currentUserId,
  memories,
  mcpConfig,
  activities,
  auditLogs,
  sessions,
  activityStats,
  hygieneData,
  settingsData,
  membersData,
  activityApiPath,
  sessionsApiPath,
  initialActivityCursor,
  initialSessionsCursor,
}: ProjectTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") ?? "memories";

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
    const params = new URLSearchParams(searchParams.toString());
    if (id === "memories") {
      params.delete("tab");
    } else {
      params.set("tab", id);
    }
    const qs = params.toString();
    router.push(
      `/org/${orgSlug}/projects/${projectSlug}${qs ? `?${qs}` : ""}`,
      { scroll: false },
    );
  };

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
            className="absolute top-0 bottom-0 left-0 z-10 flex w-8 items-center justify-start bg-gradient-to-r from-[var(--landing-bg)] via-[var(--landing-bg)]/80 to-transparent pl-1"
          >
            <ChevronLeft className="h-4 w-4 text-[var(--landing-text-tertiary)]" />
          </button>
        )}
        {canScrollRight && (
          <button
            onClick={() =>
              scrollRef.current?.scrollBy({ left: 120, behavior: "smooth" })
            }
            className="absolute top-0 right-0 bottom-0 z-10 flex w-8 items-center justify-end bg-gradient-to-l from-[var(--landing-bg)] via-[var(--landing-bg)]/80 to-transparent pr-1"
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
                className="relative flex shrink-0 items-center gap-1.5 px-4 py-2.5 font-mono text-xs font-medium transition-colors outline-none"
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
              {memories.length === 0 ? (
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
                  memories={memories}
                  orgSlug={orgSlug}
                  projectSlug={projectSlug}
                />
              )}
            </>
          )}

          {currentTab === "graph" && <MemoryGraph memories={memories} />}

          {currentTab === "members" && isAdmin && (
            <ProjectMembers
              orgSlug={orgSlug}
              projectSlug={projectSlug}
              projectId={projectId}
              members={membersData}
              currentUserId={currentUserId}
            />
          )}

          {currentTab === "activity" && isAdmin && (
            <ActivityFeed
              activities={activities}
              auditLogs={auditLogs}
              sessions={sessions}
              stats={activityStats}
              apiPath={activityApiPath}
              sessionsApiPath={sessionsApiPath}
              initialCursor={initialActivityCursor}
              initialSessionsCursor={initialSessionsCursor}
            />
          )}

          {currentTab === "cleanup" && (
            <HygieneDashboard
              healthBuckets={hygieneData.healthBuckets}
              staleMemories={hygieneData.staleMemories}
              expiringMemories={hygieneData.expiringMemories}
              growth={hygieneData.growth}
              capacity={hygieneData.capacity}
              orgSlug={orgSlug}
              projectSlug={projectSlug}
              tableSizes={hygieneData.tableSizes}
            />
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
