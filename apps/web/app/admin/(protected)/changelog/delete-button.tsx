"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface DeleteEntryButtonProps {
  version: string;
  title: string;
}

export function DeleteEntryButton({ version, title }: DeleteEntryButtonProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete "${title}" (v${version})? This action cannot be undone.`)) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/changelog/${version}`, { method: "DELETE" });
      if (res.ok) {
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
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="text-xs font-medium text-red-500 transition-colors hover:text-red-400 disabled:opacity-50"
    >
      {deleting ? "Deleting…" : "Delete"}
    </button>
  );
}
