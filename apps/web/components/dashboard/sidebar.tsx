"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FolderOpen,
  BarChart3,
  Users,
  Key,
  CreditCard,
  Settings,
  ChevronsUpDown,
  Check,
  Plus,
  ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";

interface SidebarProps {
  orgSlug: string;
  currentOrg: { name: string; slug: string; planId: string };
  userOrgs: { name: string; slug: string; planId: string }[];
  projects: { id: string; name: string; slug: string }[];
  totalProjectCount: number;
}

const MAX_VISIBLE_PROJECTS = 7;

const navItems: {
  label: string;
  icon: LucideIcon;
  href: (s: string) => string;
  match?: (pathname: string, orgSlug: string) => boolean;
}[] = [
  {
    label: "Overview",
    icon: LayoutDashboard,
    href: (s) => `/org/${s}`,
    match: (p, s) => p === `/org/${s}`,
  },
  {
    label: "Usage",
    icon: BarChart3,
    href: (s) => `/org/${s}/usage`,
  },
  {
    label: "Members",
    icon: Users,
    href: (s) => `/org/${s}/members`,
  },
  {
    label: "Tokens",
    icon: Key,
    href: (s) => `/org/${s}/tokens`,
  },
  {
    label: "Billing",
    icon: CreditCard,
    href: (s) => `/org/${s}/billing`,
  },
  {
    label: "Settings",
    icon: Settings,
    href: (s) => `/org/${s}/settings`,
  },
];

function getPlanLabel(planId: string) {
  switch (planId) {
    case "pro":
      return "Pro";
    case "team":
      return "Team";
    case "enterprise":
      return "Enterprise";
    default:
      return "Free";
  }
}

export function Sidebar({
  orgSlug,
  currentOrg,
  userOrgs,
  projects,
  totalProjectCount,
}: SidebarProps) {
  const pathname = usePathname();
  const [projectsOpen, setProjectsOpen] = useState(true);

  const visibleProjects = projects.slice(0, MAX_VISIBLE_PROJECTS);
  const overflowCount = totalProjectCount - MAX_VISIBLE_PROJECTS;

  return (
    <nav className="flex w-64 flex-col border-r border-[var(--landing-border)] bg-[var(--landing-surface)]">
      {/* Logo */}
      <div className="border-b border-[var(--landing-border)] p-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-mono text-lg font-bold text-[var(--landing-text)]">
            mem<span className="text-[#F97316] glow-text">/</span>ctl
          </span>
        </Link>
      </div>

      {/* Org Switcher */}
      <div className="border-b border-[var(--landing-border)] px-3 py-2.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[var(--landing-surface-2)] focus:outline-none">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#F97316] text-[11px] font-bold text-white">
                {currentOrg.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <span className="block truncate font-mono text-[13px] font-medium text-[var(--landing-text)]">
                  {currentOrg.name}
                </span>
                <span className="block font-mono text-[10px] text-[var(--landing-text-tertiary)]">
                  {getPlanLabel(currentOrg.planId)}
                </span>
              </div>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-[var(--landing-text-tertiary)]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side="bottom"
            sideOffset={6}
            className="w-[232px] rounded-xl border-[var(--landing-border)] bg-[var(--landing-surface)]"
          >
            {userOrgs.map((org) => (
              <DropdownMenuItem
                key={org.slug}
                asChild
                className="rounded-lg transition-colors hover:bg-[var(--landing-surface-2)] focus:bg-[var(--landing-surface-2)] focus:text-[var(--landing-text)]"
              >
                <Link
                  href={`/org/${org.slug}`}
                  className="flex items-center gap-2.5"
                >
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#F97316]/10 text-[10px] font-bold text-[#F97316]">
                    {org.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 truncate font-mono text-sm text-[var(--landing-text)]">
                    {org.name}
                  </span>
                  {org.slug === orgSlug && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-[#F97316]" />
                  )}
                </Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator className="bg-[var(--landing-border)]" />
            <DropdownMenuItem
              asChild
              className="rounded-lg transition-colors hover:bg-[var(--landing-surface-2)] focus:bg-[var(--landing-surface-2)] focus:text-[var(--landing-text)]"
            >
              <Link
                href="/onboarding"
                className="flex items-center gap-2.5"
              >
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[var(--landing-surface-2)]">
                  <Plus className="h-3 w-3 text-[var(--landing-text-tertiary)]" />
                </div>
                <span className="font-mono text-sm text-[var(--landing-text-secondary)]">
                  Create Organization
                </span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Main Navigation */}
      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        {navItems.map((item) => {
          const href = item.href(orgSlug);
          const isActive = item.match
            ? item.match(pathname, orgSlug)
            : pathname === href;

          return (
            <Link
              key={item.label}
              href={href}
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-2.5 font-mono text-sm transition-colors",
                isActive
                  ? "bg-[#F97316]/10 text-[#F97316]"
                  : "text-[var(--landing-text-secondary)] hover:bg-[var(--landing-surface-2)] hover:text-[var(--landing-text)]",
              )}
            >
              {isActive && <span className="sidebar-active-indicator" />}
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}

        {/* Projects Section */}
        <Collapsible
          open={projectsOpen}
          onOpenChange={setProjectsOpen}
          className="mt-4"
        >
          <div className="flex items-center justify-between px-3 py-1">
            <CollapsibleTrigger className="flex items-center gap-1.5 text-[var(--landing-text-tertiary)] transition-colors hover:text-[var(--landing-text-secondary)]">
              <ChevronRight
                className={cn(
                  "h-3 w-3 transition-transform",
                  projectsOpen && "rotate-90",
                )}
              />
              <span className="font-mono text-[11px] uppercase tracking-widest">
                Projects
              </span>
            </CollapsibleTrigger>
            <Link
              href={`/org/${orgSlug}/projects/new`}
              className="rounded-md p-1 text-[var(--landing-text-tertiary)] transition-colors hover:bg-[var(--landing-surface-2)] hover:text-[var(--landing-text)]"
            >
              <Plus className="h-3.5 w-3.5" />
            </Link>
          </div>
          <CollapsibleContent>
            <div className="mt-1 flex flex-col gap-0.5">
              {visibleProjects.length === 0 ? (
                <Link
                  href={`/org/${orgSlug}/projects/new`}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 font-mono text-sm text-[var(--landing-text-tertiary)] transition-colors hover:bg-[var(--landing-surface-2)] hover:text-[var(--landing-text)]"
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  Create a project
                </Link>
              ) : (
                <>
                  {visibleProjects.map((project) => {
                    const projectHref = `/org/${orgSlug}/projects/${project.slug}`;
                    const isActive = pathname.startsWith(projectHref);

                    return (
                      <Link
                        key={project.id}
                        href={projectHref}
                        className={cn(
                          "relative flex items-center gap-3 rounded-lg px-3 py-2 font-mono text-sm transition-colors",
                          isActive
                            ? "bg-[#F97316]/10 text-[#F97316]"
                            : "text-[var(--landing-text-secondary)] hover:bg-[var(--landing-surface-2)] hover:text-[var(--landing-text)]",
                        )}
                      >
                        {isActive && (
                          <span className="sidebar-active-indicator" />
                        )}
                        <FolderOpen className="h-4 w-4 shrink-0" />
                        <span className="truncate">{project.name}</span>
                      </Link>
                    );
                  })}
                  {overflowCount > 0 && (
                    <Link
                      href={`/org/${orgSlug}/projects`}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 font-mono text-xs text-[var(--landing-text-tertiary)] transition-colors hover:bg-[var(--landing-surface-2)] hover:text-[var(--landing-text)]"
                    >
                      <span className="ml-7">+ {overflowCount} more</span>
                    </Link>
                  )}
                </>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Spacer */}
        <div className="flex-1" />
      </div>
    </nav>
  );
}
