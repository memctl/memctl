"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  Building2,
  FileText,
  History,
  Mail,
  Ticket,
  Layers,
  ChevronsUpDown,
  LogOut,
  Sun,
  Moon,
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
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth-client";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";

interface AdminSidebarProps {
  user: {
    name: string;
    email: string;
    image?: string | null;
  };
  onNavigate?: () => void;
}

const platformItems: {
  label: string;
  icon: LucideIcon;
  href: string;
  match?: (pathname: string) => boolean;
}[] = [
  {
    label: "Overview",
    icon: LayoutDashboard,
    href: "/admin",
    match: (p) => p === "/admin",
  },
  {
    label: "Users",
    icon: Users,
    href: "/admin/users",
    match: (p) => p.startsWith("/admin/users"),
  },
  {
    label: "Organizations",
    icon: Building2,
    href: "/admin/organizations",
    match: (p) => p.startsWith("/admin/organizations"),
  },
  {
    label: "Plan Templates",
    icon: Layers,
    href: "/admin/plan-templates",
    match: (p) => p.startsWith("/admin/plan-templates"),
  },
];

const contentItems: {
  label: string;
  icon: LucideIcon;
  href: string;
  match?: (pathname: string) => boolean;
}[] = [
  {
    label: "Promo Codes",
    icon: Ticket,
    href: "/admin/promo-codes",
    match: (p) => p.startsWith("/admin/promo-codes"),
  },
  {
    label: "Blog",
    icon: FileText,
    href: "/admin/blog",
    match: (p) => p.startsWith("/admin/blog"),
  },
  {
    label: "Changelog",
    icon: History,
    href: "/admin/changelog",
    match: (p) => p.startsWith("/admin/changelog"),
  },
  {
    label: "Emails",
    icon: Mail,
    href: "/admin/emails/preview",
    match: (p) => p.startsWith("/admin/emails"),
  },
];

function NavItem({
  item,
  pathname,
  onNavigate,
}: {
  item: { label: string; icon: LucideIcon; href: string; match?: (p: string) => boolean };
  pathname: string;
  onNavigate?: () => void;
}) {
  const isActive = item.match ? item.match(pathname) : pathname === item.href;

  return (
    <Link
      href={item.href}
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
}

export function AdminSidebar({ user, onNavigate }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

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
      {/* Brand */}
      <div className="px-3 pt-3 pb-2">
        <Link
          href="/admin"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-[var(--landing-surface-2)]"
        >
          <span className="font-mono text-sm font-bold text-[var(--landing-text)]">
            mem<span className="text-[#F97316]">/</span>ctl
          </span>
          <span className="rounded bg-[#F97316]/10 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-[#F97316]">
            Admin
          </span>
        </Link>
      </div>

      <Separator className="bg-[var(--landing-border)]" />

      {/* Navigation */}
      <div className="flex flex-1 flex-col overflow-y-auto px-3 pt-4 pb-2">
        {/* Platform section */}
        <span className="mb-1.5 px-3 text-[11px] font-medium uppercase tracking-widest text-[var(--landing-text-tertiary)]">
          Platform
        </span>
        <div className="flex flex-col gap-0.5">
          {platformItems.map((item) => (
            <NavItem
              key={item.label}
              item={item}
              pathname={pathname}
              onNavigate={onNavigate}
            />
          ))}
        </div>

        {/* Content section */}
        <span className="mt-6 mb-1.5 px-3 text-[11px] font-medium uppercase tracking-widest text-[var(--landing-text-tertiary)]">
          Content
        </span>
        <div className="flex flex-col gap-0.5">
          {contentItems.map((item) => (
            <NavItem
              key={item.label}
              item={item}
              pathname={pathname}
              onNavigate={onNavigate}
            />
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />
      </div>

      {/* Bottom: User */}
      <Separator className="bg-[var(--landing-border)]" />
      <div className="px-3 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex h-auto w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-all duration-200 hover:bg-[var(--landing-surface-2)] focus:outline-none">
              <Avatar className="h-8 w-8 border border-[var(--landing-border)]">
                {user.image && (
                  <AvatarImage src={user.image} alt={user.name} />
                )}
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
            </Button>
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
