"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Building2,
  FileText,
  History,
  Mail,
  Ticket,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const navItems: {
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

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex w-60 flex-col border-r border-[var(--landing-border)] bg-[var(--landing-surface)]">
      {/* Logo */}
      <div className="border-b border-[var(--landing-border)] p-5">
        <Link href="/admin" className="flex items-center gap-2">
          <span className="font-mono text-lg font-bold text-[var(--landing-text)]">
            mem<span className="text-[#F97316] glow-text">/</span>ctl
          </span>
          <span className="rounded bg-[#F97316]/10 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-[#F97316]">
            Admin
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex flex-1 flex-col gap-0.5 p-3">
        {navItems.map((item) => {
          const isActive = item.match
            ? item.match(pathname)
            : pathname === item.href;

          return (
            <Link
              key={item.label}
              href={item.href}
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
      </div>
    </nav>
  );
}
