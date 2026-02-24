"use client";

import { useEffect, useState } from "react";

interface ActionEntry {
  id: string;
  action: string;
  details: Record<string, unknown> | null;
  createdAt: string;
  adminName: string;
  adminEmail: string;
}

const actionBadgeStyles: Record<string, string> = {
  org_suspended: "bg-amber-500/10 text-amber-500",
  org_banned: "bg-red-500/10 text-red-500",
  org_reactivated: "bg-emerald-500/10 text-emerald-500",
  plan_overridden: "bg-blue-500/10 text-blue-500",
  limits_overridden: "bg-purple-500/10 text-purple-500",
  ownership_transferred: "bg-[#F97316]/10 text-[#F97316]",
  notes_updated:
    "bg-[var(--landing-surface-2)] text-[var(--landing-text-secondary)]",
};

function formatAction(action: string): string {
  return action.replace(/_/g, " ");
}

function summarizeDetails(
  action: string,
  details: Record<string, unknown> | null,
): string | null {
  if (!details) return null;

  switch (action) {
    case "org_suspended":
    case "org_banned":
      return details.reason ? String(details.reason) : null;
    case "org_reactivated":
      return details.previousStatus ? `Was: ${details.previousStatus}` : null;
    case "plan_overridden":
      return details.newPlanOverride
        ? `Set to: ${details.newPlanOverride}`
        : "Override cleared";
    case "limits_overridden":
      return `Projects: ${details.newProjectLimit}, Members: ${details.newMemberLimit}`;
    case "ownership_transferred":
      return null;
    default:
      return null;
  }
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function OrgActionHistory({ orgSlug }: { orgSlug: string }) {
  const [actions, setActions] = useState<ActionEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/v1/admin/organizations/${orgSlug}/actions`)
      .then((r) => r.json())
      .then((data) => setActions(data.result ?? []))
      .finally(() => setLoading(false));
  }, [orgSlug]);

  return (
    <div className="dash-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--landing-border)] bg-[var(--landing-code-bg)] px-3 py-2">
        <span className="font-mono text-[11px] font-medium tracking-widest text-[var(--landing-text-tertiary)] uppercase">
          Action History
        </span>
        <span className="rounded-full bg-[var(--landing-surface-2)] px-2 py-0.5 font-mono text-[10px] text-[var(--landing-text-tertiary)]">
          {actions.length}
        </span>
      </div>

      <div className="max-h-[500px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex gap-1">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--landing-text-tertiary)]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--landing-text-tertiary)] [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--landing-text-tertiary)] [animation-delay:300ms]" />
            </div>
          </div>
        ) : actions.length === 0 ? (
          <div className="py-8 text-center font-mono text-[11px] text-[var(--landing-text-tertiary)]">
            No admin actions recorded
          </div>
        ) : (
          actions.map((entry, i) => {
            const badge =
              actionBadgeStyles[entry.action] ??
              actionBadgeStyles.notes_updated;
            const summary = summarizeDetails(entry.action, entry.details);
            return (
              <div
                key={entry.id}
                className={`px-3 py-2.5 ${
                  i < actions.length - 1
                    ? "border-b border-[var(--landing-border)]"
                    : ""
                }`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 font-mono text-[10px] font-medium capitalize ${badge}`}
                  >
                    {formatAction(entry.action)}
                  </span>
                  <span className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">
                    {timeAgo(entry.createdAt)}
                  </span>
                </div>
                <p className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">
                  by {entry.adminEmail}
                </p>
                {summary && (
                  <p className="mt-1 font-mono text-[11px] text-[var(--landing-text-secondary)]">
                    {summary}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
