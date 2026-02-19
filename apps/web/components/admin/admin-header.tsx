"use client";

import { usePathname, useRouter } from "next/navigation";
import { ThemeSwitcher } from "@/components/landing/theme-switcher";
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
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { authClient } from "@/lib/auth-client";
import { LogOut } from "lucide-react";

interface AdminHeaderProps {
  user: {
    name: string;
    email: string;
    image?: string | null;
  };
}

function buildBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  // Remove "admin" from the start
  if (segments[0] === "admin") {
    segments.shift();
  }

  const crumbs: { label: string; href?: string }[] = [
    { label: "Admin", href: "/admin" },
  ];

  let currentPath = "/admin";
  for (const seg of segments) {
    currentPath += `/${seg}`;
    crumbs.push({
      label: seg.charAt(0).toUpperCase() + seg.slice(1),
      href: currentPath,
    });
  }

  return crumbs;
}

export function AdminHeader({ user }: AdminHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const crumbs = buildBreadcrumbs(pathname);

  const initials = user.name
    ? user.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user.email[0].toUpperCase();

  return (
    <header className="flex h-14 items-center justify-between border-b border-[var(--landing-border)] bg-[var(--landing-surface)]/80 px-6 backdrop-blur-xl">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList className="font-mono text-xs">
          {crumbs.map((crumb, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <span key={crumb.href} className="contents">
                {i > 0 && <BreadcrumbSeparator>/</BreadcrumbSeparator>}
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage className="text-[var(--landing-text)]">
                      {crumb.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      href={crumb.href}
                      className="text-[var(--landing-text-tertiary)] transition-colors hover:text-[var(--landing-text)]"
                    >
                      {crumb.label}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </span>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>

      {/* Right side */}
      <div className="flex items-center gap-3">
        <ThemeSwitcher />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-[#F97316]">
              <Avatar className="h-8 w-8 border border-[var(--landing-border)]">
                {user.image && <AvatarImage src={user.image} alt={user.name} />}
                <AvatarFallback className="bg-[var(--landing-surface-2)] font-mono text-xs text-[var(--landing-text-secondary)]">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 border-[var(--landing-border)] bg-[var(--landing-surface)]"
          >
            <div className="px-3 py-2">
              <p className="text-sm font-medium text-[var(--landing-text)]">
                {user.name}
              </p>
              <p className="font-mono text-xs text-[var(--landing-text-tertiary)]">
                {user.email}
              </p>
            </div>
            <DropdownMenuSeparator className="bg-[var(--landing-border)]" />
            <DropdownMenuItem
              className="gap-2 text-sm text-[var(--landing-text-secondary)]"
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
    </header>
  );
}
