"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface DeletePostButtonProps {
  slug: string;
  title: string;
}

export function DeletePostButton({ slug, title }: DeletePostButtonProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete "${title}"? This action cannot be undone.`)) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/blog/${slug}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to delete post");
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
