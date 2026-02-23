"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";

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
    <Switch
      checked={isAdmin}
      onCheckedChange={handleToggle}
      disabled={loading}
      className="data-[state=checked]:bg-[#F97316]"
    />
  );
}
