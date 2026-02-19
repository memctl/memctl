"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface DeleteEntryButtonProps {
  version: string;
  title: string;
}

export function DeleteEntryButton({ version, title }: DeleteEntryButtonProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/changelog/${version}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to delete entry");
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="text-xs font-medium text-red-500 transition-colors hover:text-red-400">
          Delete
        </button>
      </DialogTrigger>
      <DialogContent className="border-[var(--landing-border)] bg-[var(--landing-surface)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--landing-text)]">
            Delete Changelog Entry
          </DialogTitle>
          <DialogDescription className="text-[var(--landing-text-secondary)]">
            Are you sure you want to delete &ldquo;{title}&rdquo; (v{version})?
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="border-[var(--landing-border)] text-[var(--landing-text-secondary)]"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
