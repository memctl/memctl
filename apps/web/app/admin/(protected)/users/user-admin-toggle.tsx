"use client";

import { useState } from "react";

interface UserAdminToggleProps {
  userId: string;
  initialIsAdmin: boolean;
}

export function UserAdminToggle({
  userId,
  initialIsAdmin,
}: UserAdminToggleProps) {
  const [isAdmin, setIsAdmin] = useState(initialIsAdmin);
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAdmin: !isAdmin }),
      });
      if (res.ok) {
        setIsAdmin(!isAdmin);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
        isAdmin ? "bg-[#F97316]" : "bg-[var(--landing-border)]"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
          isAdmin ? "translate-x-4.5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
