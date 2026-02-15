"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface SidebarProps {
  orgSlug: string;
}

const navItems = [
  { label: "Projects", href: (s: string) => `/${s}` },
  { label: "Members", href: (s: string) => `/${s}/members` },
  { label: "Tokens", href: (s: string) => `/${s}/tokens` },
  { label: "Billing", href: (s: string) => `/${s}/billing` },
  { label: "Settings", href: (s: string) => `/${s}/settings` },
];

export function Sidebar({ orgSlug }: SidebarProps) {
  const pathname = usePathname();

  return (
    <nav className="flex w-56 flex-col border-r border-border">
      <div className="border-b border-border p-4">
        <Link href="/" className="font-mono text-lg font-bold">
          mem<span className="text-primary">/</span>ctl
        </Link>
      </div>
      <div className="border-b border-border p-4">
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {orgSlug}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2">
        {navItems.map((item) => {
          const href = item.href(orgSlug);
          const isActive =
            pathname === href ||
            (item.label === "Projects" &&
              pathname.startsWith(`/${orgSlug}/projects`));

          return (
            <Link
              key={item.label}
              href={href}
              className={cn(
                "px-3 py-2 font-mono text-sm transition-colors hover:bg-muted",
                isActive && "bg-muted text-primary",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
