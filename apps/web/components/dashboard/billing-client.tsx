"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, CreditCard, FileText } from "lucide-react";
import type { PlanId } from "@memctl/shared/constants";

interface PlanInfo {
  name: string;
  price: number;
  projectLimit: number;
  memberLimit: number;
  memoryLimit: number;
  apiCallLimit: number;
}

interface BillingClientProps {
  orgSlug: string;
  currentPlan: PlanId;
  hasSubscription: boolean;
  plans: Record<string, PlanInfo>;
}

const PLAN_ORDER: PlanId[] = [
  "free",
  "lite",
  "pro",
  "business",
  "scale",
  "enterprise",
];

const PAID_PLANS: PlanId[] = ["lite", "pro", "business", "scale"];

function formatLimit(val: number) {
  return val === Infinity ? "Unlimited" : val.toLocaleString();
}

function formatPrice(price: number) {
  if (price === 0) return "Free";
  if (price === -1) return "Custom";
  return `$${price}/mo`;
}

export function BillingClient({
  orgSlug,
  currentPlan,
  hasSubscription,
  plans,
}: BillingClientProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleCheckout = async (planId: string) => {
    setLoading(planId);
    try {
      const res = await fetch(`/api/v1/orgs/${orgSlug}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(null);
    }
  };

  const handlePortal = async () => {
    setLoading("portal");
    try {
      const res = await fetch(`/api/v1/orgs/${orgSlug}/portal`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(null);
    }
  };

  const renderActionButton = (planId: PlanId) => {
    if (planId === currentPlan) {
      return (
        <span className="mt-4 block text-center text-xs text-[var(--landing-text-tertiary)]">
          Current plan
        </span>
      );
    }

    if (planId === "enterprise") {
      return (
        <Button
          variant="outline"
          className="mt-4 w-full border-[var(--landing-border)] text-[var(--landing-text-secondary)]"
          asChild
        >
          <a href="mailto:sales@memctl.com">Contact Sales</a>
        </Button>
      );
    }

    if (planId === "free") {
      return null;
    }

    // Free user viewing paid plan → Upgrade (checkout)
    if (!hasSubscription) {
      return (
        <Button
          onClick={() => handleCheckout(planId)}
          disabled={loading !== null}
          className="mt-4 w-full bg-[#F97316] text-white hover:bg-[#EA580C]"
        >
          {loading === planId ? "..." : "Upgrade"}
        </Button>
      );
    }

    // Paid user viewing other plan → Switch plan (portal)
    return (
      <Button
        variant="outline"
        onClick={handlePortal}
        disabled={loading !== null}
        className="mt-4 w-full border-[var(--landing-border)] text-[var(--landing-text-secondary)]"
      >
        {loading === "portal" ? "..." : "Switch plan"}
      </Button>
    );
  };

  return (
    <>
      {/* Plan Cards Grid */}
      <div className="mt-10">
        <h2 className="text-sm font-medium text-[var(--landing-text)]">
          All plans
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PLAN_ORDER.map((id) => {
            const plan = plans[id];
            if (!plan) return null;
            const isCurrent = id === currentPlan;
            return (
              <div
                key={id}
                className={`rounded-xl border p-6 ${
                  isCurrent
                    ? "border-[#F97316]/40 bg-[#F97316]/5"
                    : "border-[var(--landing-border)] bg-[var(--landing-surface)]"
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="text-sm font-medium text-[var(--landing-text)]">
                    {plan.name}
                  </h3>
                  <span className="text-sm font-medium text-[var(--landing-text)]">
                    {formatPrice(plan.price)}
                  </span>
                </div>

                <ul className="mt-4 space-y-2">
                  {[
                    `${formatLimit(plan.projectLimit)} projects`,
                    `${formatLimit(plan.memberLimit)} members`,
                    `${formatLimit(plan.memoryLimit)} memories`,
                    `${formatLimit(plan.apiCallLimit)} API calls/mo`,
                  ].map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check className="size-3.5 shrink-0 text-[#F97316]" />
                      <span className="text-xs text-[var(--landing-text-secondary)]">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {renderActionButton(id)}
              </div>
            );
          })}
        </div>
      </div>

      {/* Billing Management */}
      <div className="mt-10">
        <h2 className="text-sm font-medium text-[var(--landing-text)]">
          Billing management
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-6">
            <div className="flex items-center gap-3">
              <CreditCard className="size-5 text-[var(--landing-text-tertiary)]" />
              <div>
                <p className="text-sm font-medium text-[var(--landing-text)]">
                  Payment Method
                </p>
                <p className="text-xs text-[var(--landing-text-tertiary)]">
                  Update your card or billing details
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handlePortal}
              disabled={loading !== null || !hasSubscription}
              className="mt-4 w-full border-[var(--landing-border)] text-[var(--landing-text-secondary)]"
            >
              {loading === "portal" ? "..." : "Manage payment"}
            </Button>
          </div>

          <div className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-6">
            <div className="flex items-center gap-3">
              <FileText className="size-5 text-[var(--landing-text-tertiary)]" />
              <div>
                <p className="text-sm font-medium text-[var(--landing-text)]">
                  Invoices
                </p>
                <p className="text-xs text-[var(--landing-text-tertiary)]">
                  View and download past invoices
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handlePortal}
              disabled={loading !== null || !hasSubscription}
              className="mt-4 w-full border-[var(--landing-border)] text-[var(--landing-text-secondary)]"
            >
              {loading === "portal" ? "..." : "View invoices"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
