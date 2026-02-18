"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";

interface BillingActionsProps {
  orgSlug: string;
  currentPlan: string;
  hasSubscription: boolean;
}

export function BillingActions({
  orgSlug,
  currentPlan,
  hasSubscription,
}: BillingActionsProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleUpgrade = async (planId: string) => {
    setLoading(planId);
    try {
      const res = await fetch(`/api/v1/orgs/${orgSlug}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setLoading(null);
    }
  };

  const handleManage = async () => {
    setLoading("manage");
    try {
      const res = await fetch(`/api/v1/orgs/${orgSlug}/portal`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex gap-3">
      {currentPlan === "free" && (
        <>
          <Button
            onClick={() => handleUpgrade("lite")}
            disabled={loading !== null}
            className="bg-[#F97316] text-white hover:bg-[#FB923C]"
          >
            {loading === "lite" ? "..." : "Upgrade to Lite — $5/mo"}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleUpgrade("pro")}
            disabled={loading !== null}
            className="border-[var(--landing-border)] text-[var(--landing-text-secondary)]"
          >
            {loading === "pro" ? "..." : "Upgrade to Pro — $20/mo"}
          </Button>
        </>
      )}
      {hasSubscription && (
        <Button
          variant="outline"
          onClick={handleManage}
          disabled={loading !== null}
          className="border-[var(--landing-border)] text-[var(--landing-text-secondary)]"
        >
          {loading === "manage" ? "..." : "Manage subscription"}
        </Button>
      )}
    </div>
  );
}
