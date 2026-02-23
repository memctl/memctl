"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  LogOut,
  Sun,
  Moon,
  Activity,
  HeartPulse,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth-client";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";

interface SidebarProps {
  orgSlug: string;
  currentOrg: { name: string; slug: string; planId: string };
  userOrgs: { name: string; slug: string; planId: string }[];
  projects: { id: string; name: string; slug: string }[];
  totalProjectCount: number;
  user: {
    name: string;
    email: string;
    image?: string | null;
  };
  userRole: "owner" | "admin" | "member";
  onNavigate?: () => void;
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
    label: "Activity",
    icon: Activity,
    href: (s) => `/org/${s}/activity`,
  },
  {
    label: "Health",
    icon: HeartPulse,
    href: (s) => `/org/${s}/health`,
  },
  {
    label: "Hygiene",
    icon: Sparkles,
    href: (s) => `/org/${s}/hygiene`,
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
  user,
  userRole,
  onNavigate,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [projectsOpen, setProjectsOpen] = useState(true);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const visibleProjects = projects.slice(0, MAX_VISIBLE_PROJECTS);
  const overflowCount = totalProjectCount - MAX_VISIBLE_PROJECTS;

  const initials = user.name
    ? user.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user.email[0].toUpperCase();

  return (
    <nav className="flex h-full w-72 flex-col border-r border-[var(--landing-border)] bg-[var(--landing-surface)]">
      {/* Org Switcher */}
      <div className="px-3 pt-3 pb-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors duration-150 hover:bg-[var(--landing-surface-2)] focus:outline-none data-[state=open]:bg-[var(--landing-surface-2)]">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#F97316] text-xs font-semibold text-white">
                {currentOrg.name.charAt(0).toUpperCase()}
              </div>
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold text-[var(--landing-text)]">
                  {currentOrg.name}
                </span>
                <span className="truncate text-xs text-[var(--landing-text-tertiary)]">
                  {getPlanLabel(currentOrg.planId)}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 shrink-0 text-[var(--landing-text-tertiary)]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side="bottom"
            sideOffset={6}
            className="w-[256px] rounded-xl border-[var(--landing-border)] bg-[var(--landing-surface)] shadow-lg"
          >
            {userOrgs.map((org) => (
              <DropdownMenuItem
                key={org.slug}
                asChild
                className="rounded-lg transition-colors hover:bg-[var(--landing-surface-2)] focus:bg-[var(--landing-surface-2)] focus:text-[var(--landing-text)]"
              >
                <Link
                  href={`/org/${org.slug}`}
                  className="flex items-center gap-3"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#F97316]/10 text-[10px] font-bold text-[#F97316]">
                    {org.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 truncate text-sm text-[var(--landing-text)]">
                    {org.name}
                  </span>
                  {org.slug === orgSlug && (
                    <Check className="h-4 w-4 shrink-0 text-[#F97316]" />
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
                onClick={onNavigate}
                className="flex items-center gap-3"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--landing-surface-2)]">
                  <Plus className="h-3.5 w-3.5 text-[var(--landing-text-tertiary)]" />
                </div>
                <span className="text-sm text-[var(--landing-text-secondary)]">
                  Create Organization
                </span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Separator className="bg-[var(--landing-border)]" />

      {/* Main Navigation */}
      <div className="flex flex-1 flex-col overflow-y-auto px-3 pt-4 pb-2">
        <span className="mb-1.5 px-3 text-[11px] font-medium uppercase tracking-widest text-[var(--landing-text-tertiary)]">
          General
        </span>
        <div className="flex flex-col gap-0.5">
          {navItems.map((item) => {
            const href = item.href(orgSlug);
            const isActive = item.match
              ? item.match(pathname, orgSlug)
              : pathname === href;

            return (
              <Link
                key={item.label}
                href={href}
                onClick={onNavigate}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200",
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
        </div>

        {/* Projects Section */}
        <Collapsible
          open={projectsOpen}
          onOpenChange={setProjectsOpen}
          className="mt-6"
        >
          <div className="mb-1.5 flex items-center justify-between px-3">
            <CollapsibleTrigger className="flex items-center gap-1.5 text-[var(--landing-text-tertiary)] transition-colors hover:text-[var(--landing-text-secondary)]">
              <ChevronRight
                className={cn(
                  "h-3 w-3 transition-transform duration-200",
                  projectsOpen && "rotate-90",
                )}
              />
              <span className="text-[11px] font-medium uppercase tracking-widest">
                Projects
              </span>
            </CollapsibleTrigger>
            {userRole === "member" ? (
              <span
                className="rounded-md p-1 text-[var(--landing-text-tertiary)] opacity-40 cursor-not-allowed"
                title="Only owners and admins can create projects"
              >
                <Plus className="h-3.5 w-3.5" />
              </span>
            ) : (
              <Link
                href={`/org/${orgSlug}/projects/new`}
                onClick={onNavigate}
                className="rounded-md p-1 text-[var(--landing-text-tertiary)] transition-colors hover:bg-[var(--landing-surface-2)] hover:text-[var(--landing-text)]"
              >
                <Plus className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
          <CollapsibleContent>
            <div className="flex flex-col gap-0.5">
              {visibleProjects.length === 0 ? (
                userRole === "member" ? (
                  <span className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-[var(--landing-text-tertiary)] opacity-40 cursor-not-allowed">
                    <Plus className="h-4 w-4 shrink-0" />
                    No projects assigned
                  </span>
                ) : (
                  <Link
                    href={`/org/${orgSlug}/projects/new`}
                    onClick={onNavigate}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-[var(--landing-text-tertiary)] transition-colors hover:bg-[var(--landing-surface-2)] hover:text-[var(--landing-text)]"
                  >
                    <Plus className="h-4 w-4 shrink-0" />
                    Create a project
                  </Link>
                )
              ) : (
                <>
                  {visibleProjects.map((project) => {
                    const projectHref = `/org/${orgSlug}/projects/${project.slug}`;
                    const isActive = pathname.startsWith(projectHref);

                    return (
                      <Link
                        key={project.id}
                        href={projectHref}
                        onClick={onNavigate}
                        className={cn(
                          "relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200",
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
                      onClick={onNavigate}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs text-[var(--landing-text-tertiary)] transition-colors hover:bg-[var(--landing-surface-2)] hover:text-[var(--landing-text)]"
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

      {/* Bottom: User */}
      <Separator className="bg-[var(--landing-border)]" />
      <div className="px-3 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-all duration-200 hover:bg-[var(--landing-surface-2)] focus:outline-none">
              <Avatar className="h-8 w-8 border border-[var(--landing-border)]">
                {user.image && <AvatarImage src={user.image} alt={user.name} />}
                <AvatarFallback className="bg-[var(--landing-surface-2)] text-xs font-medium text-[var(--landing-text-secondary)]">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-[var(--landing-text)]">
                  {user.name}
                </span>
                <span className="block truncate text-[11px] text-[var(--landing-text-tertiary)]">
                  {user.email}
                </span>
              </div>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-[var(--landing-text-tertiary)]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side="top"
            sideOffset={8}
            className="w-[256px] rounded-xl border-[var(--landing-border)] bg-[var(--landing-surface)] shadow-lg"
          >
            <div className="px-3 py-2">
              <p className="text-sm font-medium text-[var(--landing-text)]">
                {user.name}
              </p>
              <p className="text-xs text-[var(--landing-text-tertiary)]">
                {user.email}
              </p>
            </div>
            <DropdownMenuSeparator className="bg-[var(--landing-border)]" />
            {mounted && (
              <DropdownMenuItem
                className="gap-3 rounded-lg text-sm text-[var(--landing-text-secondary)] transition-colors hover:bg-[var(--landing-surface-2)] focus:bg-[var(--landing-surface-2)] focus:text-[var(--landing-text)]"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="gap-3 rounded-lg text-sm text-[var(--landing-text-secondary)] transition-colors hover:bg-[var(--landing-surface-2)] focus:bg-[var(--landing-surface-2)] focus:text-[var(--landing-text)]"
              onClick={async () => {
                await authClient.signOut();
                router.push("/");
              }}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
