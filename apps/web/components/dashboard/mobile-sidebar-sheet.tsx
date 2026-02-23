"use client";

import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "radix-ui";
import { useMobileSidebar } from "./sidebar-mobile-context";

export function MobileSidebarSheet({ children }: { children: ReactNode }) {
  const { open, setOpen } = useMobileSidebar();
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="left"
        className="w-72 p-0 border-[var(--landing-border)] bg-[var(--landing-surface)]"
        showCloseButton={false}
      >
        <VisuallyHidden.Root>
          <SheetTitle>Navigation</SheetTitle>
        </VisuallyHidden.Root>
        {children}
      </SheetContent>
    </Sheet>
  );
}
