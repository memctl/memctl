"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Menu } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useAdminMobileSidebar } from "./admin-sidebar-mobile-context";

function buildBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] === "admin") {
    segments.shift();
  }

  const crumbs: { label: string; href?: string }[] = [
    { label: "Admin", href: "/admin" },
  ];

  if (segments.length === 0) {
    crumbs.push({ label: "Overview", href: "/admin" });
  } else {
    let currentPath = "/admin";
    for (const seg of segments) {
      currentPath += `/${seg}`;
      crumbs.push({
        label: seg.charAt(0).toUpperCase() + seg.slice(1),
        href: currentPath,
      });
    }
  }

  return crumbs;
}

export function AdminHeader() {
  const pathname = usePathname();
  const crumbs = buildBreadcrumbs(pathname);
  const { setOpen } = useAdminMobileSidebar();

  return (
    <header className="flex shrink-0 items-center bg-[var(--landing-bg)] px-4 py-3 md:px-8 md:py-6">
      <button
        onClick={() => setOpen(true)}
        className="mr-2 rounded-md p-1.5 text-[var(--landing-text-secondary)] hover:bg-[var(--landing-surface-2)] hover:text-[var(--landing-text)] md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      <Link href="/admin" className="flex shrink-0 items-center gap-2 px-1">
        <span className="font-mono text-sm font-bold text-[var(--landing-text)]">
          mem<span className="text-[#F97316]">/</span>ctl
        </span>
      </Link>
      <Separator
        orientation="vertical"
        className="mx-3 data-[orientation=vertical]:h-4 bg-[var(--landing-border)]"
      />
      <div className="min-w-0">
        <Breadcrumb>
          <BreadcrumbList className="text-sm flex-nowrap">
            {crumbs.map((crumb, i) => {
              const isLast = i === crumbs.length - 1;
              return (
                <span
                  key={`${crumb.href ?? crumb.label}-${i}`}
                  className={
                    isLast ? "contents" : "hidden contents sm:!contents"
                  }
                >
                  {i > 0 && (
                    <BreadcrumbSeparator className="text-[var(--landing-text-tertiary)]">
                      <ChevronRight className="size-3.5" />
                    </BreadcrumbSeparator>
                  )}
                  <BreadcrumbItem className="min-w-0">
                    {isLast ? (
                      <BreadcrumbPage className="truncate font-medium text-[var(--landing-text)]">
                        {crumb.label}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink
                        href={crumb.href}
                        className="truncate text-[var(--landing-text-tertiary)] transition-colors hover:text-[var(--landing-text)]"
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
      </div>
    </header>
  );
}
