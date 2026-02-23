"use client";

import type { ReactNode } from "react";
import {
  AdminMobileSidebarProvider,
  useAdminMobileSidebar,
} from "./admin-sidebar-mobile-context";
import { AdminMobileSidebarSheet } from "./admin-mobile-sidebar-sheet";
import { AdminSidebar } from "./admin-sidebar";
import { AdminHeader } from "./admin-header";

interface AdminShellProps {
  user: {
    name: string;
    email: string;
    image?: string | null;
  };
  children: ReactNode;
}

function AdminShellInner({ user, children }: AdminShellProps) {
  const { setOpen } = useAdminMobileSidebar();

  return (
    <div className="flex h-screen bg-[var(--landing-bg)]">
      <div className="hidden md:flex">
        <AdminSidebar user={user} />
      </div>
      <AdminMobileSidebarSheet>
        <AdminSidebar user={user} onNavigate={() => setOpen(false)} />
      </AdminMobileSidebarSheet>
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader />
        <main className="flex-1 overflow-auto bg-[var(--landing-bg)] px-4 py-4 md:px-8 md:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export function AdminShell(props: AdminShellProps) {
  return (
    <AdminMobileSidebarProvider>
      <AdminShellInner {...props} />
    </AdminMobileSidebarProvider>
  );
}
