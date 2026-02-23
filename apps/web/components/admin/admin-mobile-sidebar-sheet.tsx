"use client";

import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "radix-ui";
import { useAdminMobileSidebar } from "./admin-sidebar-mobile-context";

export function AdminMobileSidebarSheet({
  children,
}: {
  children: ReactNode;
}) {
  const { open, setOpen } = useAdminMobileSidebar();
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="left"
        className="w-72 p-0 border-[var(--landing-border)] bg-[var(--landing-surface)]"
        showCloseButton={false}
      >
        <VisuallyHidden.Root>
          <SheetTitle>Admin Navigation</SheetTitle>
        </VisuallyHidden.Root>
        {children}
      </SheetContent>
    </Sheet>
  );
}
