"use client";

import type { ReactNode } from "react";
import {
  MobileSidebarProvider,
  useMobileSidebar,
} from "./sidebar-mobile-context";
import { MobileSidebarSheet } from "./mobile-sidebar-sheet";
import { Sidebar } from "./sidebar";
import { Header } from "./header";

interface DashboardShellProps {
  orgSlug: string;
  orgName: string;
  sidebarProps: {
    orgSlug: string;
    currentOrg: { name: string; slug: string; planId: string };
    userOrgs: { name: string; slug: string; planId: string }[];
    projects: { id: string; name: string; slug: string }[];
    totalProjectCount: number;
    user: { name: string; email: string; image?: string | null };
    userRole: "owner" | "admin" | "member";
  };
  children: ReactNode;
}

function DashboardShellInner({
  orgSlug,
  orgName,
  sidebarProps,
  children,
}: DashboardShellProps) {
  const { setOpen } = useMobileSidebar();

  return (
    <div className="flex h-screen bg-[var(--landing-bg)]">
      <div className="hidden md:flex">
        <Sidebar {...sidebarProps} />
      </div>
      <MobileSidebarSheet>
        <Sidebar {...sidebarProps} onNavigate={() => setOpen(false)} />
      </MobileSidebarSheet>
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header orgSlug={orgSlug} orgName={orgName} />
        <main className="flex-1 overflow-auto bg-[var(--landing-bg)] px-4 py-4 md:px-8 md:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export function DashboardShell(props: DashboardShellProps) {
  return (
    <MobileSidebarProvider>
      <DashboardShellInner {...props} />
    </MobileSidebarProvider>
  );
}
