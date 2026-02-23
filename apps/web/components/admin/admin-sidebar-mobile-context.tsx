"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

interface AdminMobileSidebarContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const AdminMobileSidebarContext =
  createContext<AdminMobileSidebarContextValue | null>(null);

export function AdminMobileSidebarProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <AdminMobileSidebarContext.Provider value={{ open, setOpen }}>
      {children}
    </AdminMobileSidebarContext.Provider>
  );
}

export function useAdminMobileSidebar() {
  const ctx = useContext(AdminMobileSidebarContext);
  if (!ctx) {
    throw new Error(
      "useAdminMobileSidebar must be used within AdminMobileSidebarProvider",
    );
  }
  return ctx;
}
