"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Check,
  CreditCard,
  Loader2,
  Ticket,
  X,
  ChevronDown,
} from "lucide-react";
import { InvoiceHistory } from "./invoice-history";
import type { PlanId } from "@memctl/shared/constants";

interface PlanInfo {
  name: string;
  price: number;
  projectLimit: number;
  memberLimit: number;
  memoryLimitPerProject: number;
  apiCallLimit: number;
}

interface BillingClientProps {
  orgSlug: string;
  currentPlan: PlanId;
  hasSubscription: boolean;
  plans: Record<string, PlanInfo>;
}

interface PromoDiscount {
  type: string;
  amount: number;
  currency: string;
  duration: string;
  durationInMonths: number | null;
}

const isSelfHostedClient = process.env.NEXT_PUBLIC_SELF_HOSTED === "true";

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
  const searchParams = useSearchParams();

  // Promo code state
  const [promoExpanded, setPromoExpanded] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promoValidating, setPromoValidating] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discount: PromoDiscount;
  } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const validatePromo = useCallback(
    async (code: string, planId?: string) => {
      if (!code) return;
      setPromoValidating(true);
      setPromoError(null);
      try {
        const res = await fetch(`/api/v1/orgs/${orgSlug}/validate-promo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: code.toUpperCase(), planId }),
        });
        const data = await res.json();
        if (data.valid) {
          setAppliedPromo({
            code: code.toUpperCase(),
            discount: data.discount,
          });
          setPromoError(null);
        } else {
          setAppliedPromo(null);
          setPromoError(data.reason ?? "Invalid promo code");
        }
      } catch {
        setPromoError("Failed to validate code");
      } finally {
        setPromoValidating(false);
      }
    },
    [orgSlug],
  );

  // Auto-apply promo from URL param
  useEffect(() => {
    const promoParam = searchParams.get("promo");
    if (promoParam) {
      setPromoExpanded(true);
      setPromoInput(promoParam.toUpperCase());
      validatePromo(promoParam);
    }
  }, [searchParams, validatePromo]);

  // Re-validate when plan selection changes
  const appliedCode = appliedPromo?.code;
  useEffect(() => {
    if (appliedCode && selectedPlan) {
      validatePromo(appliedCode, selectedPlan);
    }
  }, [selectedPlan, appliedCode, validatePromo]);

  const handleApplyPromo = () => {
    if (!promoInput.trim()) return;
    validatePromo(promoInput, selectedPlan ?? undefined);
  };

  const removePromo = () => {
    setAppliedPromo(null);
    setPromoInput("");
    setPromoError(null);
  };

  const handleCheckout = async (planId: string) => {
    setLoading(planId);
    setSelectedPlan(planId);
    try {
      const res = await fetch(`/api/v1/orgs/${orgSlug}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          promoCode: appliedPromo?.code ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to start checkout");
      } else if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(null);
    }
  };

  const handlePortal = async (planId?: string) => {
    setLoading("portal");
    try {
      const res = await fetch(`/api/v1/orgs/${orgSlug}/portal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to open billing portal");
      } else if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(null);
    }
  };

  const formatDiscountBadge = (discount: PromoDiscount) => {
    const amount =
      discount.type === "percent"
        ? `${discount.amount}% off`
        : `$${(discount.amount / 100).toFixed(2)} off`;
    const dur =
      discount.duration === "once"
        ? "once"
        : discount.duration === "forever"
          ? "forever"
          : `for ${discount.durationInMonths} months`;
    return `${amount} ${dur}`;
  };

  const getDiscountedPrice = (planPrice: number, discount: PromoDiscount) => {
    if (discount.type === "percent") {
      return planPrice - planPrice * (discount.amount / 100);
    }
    return Math.max(0, planPrice - discount.amount / 100);
  };

  const renderActionButton = (planId: PlanId) => {
    if (isSelfHostedClient) return null;

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
          <a href="mailto:team@memctl.com">Contact Sales</a>
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
          {loading === planId ? <Loader2 className="h-3 w-3 animate-spin" /> : "Upgrade"}
        </Button>
      );
    }

    // Paid user viewing other plan → Switch plan (portal with deep link)
    return (
      <Button
        variant="outline"
        onClick={() => handlePortal(planId)}
        disabled={loading !== null}
        className="mt-4 w-full border-[var(--landing-border)] text-[var(--landing-text-secondary)]"
      >
        {loading === "portal" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Switch plan"}
      </Button>
    );
  };

  return (
    <>
      {/* Promo Code Section */}
      {!isSelfHostedClient && (
        <div className="mt-6">
          <button
            onClick={() => setPromoExpanded(!promoExpanded)}
            className="flex items-center gap-2 text-sm text-[var(--landing-text-secondary)] transition-colors hover:text-[var(--landing-text)]"
          >
            <Ticket className="h-4 w-4" />
            Have a promo code?
            <ChevronDown
              className={`h-4 w-4 transition-transform ${promoExpanded ? "rotate-180" : ""}`}
            />
          </button>

          {promoExpanded && (
            <div className="mt-3">
              {appliedPromo ? (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 font-mono text-sm font-medium text-emerald-500">
                        <Ticket className="h-3.5 w-3.5" />
                        {formatDiscountBadge(appliedPromo.discount)}
                      </span>
                    </div>
                    <p className="mt-2 font-mono text-xs text-[var(--landing-text-secondary)]">
                      Code: {appliedPromo.code}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={removePromo}
                    className="text-[var(--landing-text-tertiary)] hover:text-[var(--landing-text)]"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={promoInput}
                    onChange={(e) =>
                      setPromoInput(e.target.value.toUpperCase())
                    }
                    placeholder="Enter code"
                    className="max-w-[240px] border-[var(--landing-border)] bg-[var(--landing-surface)] font-mono"
                    onKeyDown={(e) => e.key === "Enter" && handleApplyPromo()}
                  />
                  <Button
                    onClick={handleApplyPromo}
                    disabled={promoValidating || !promoInput.trim()}
                    variant="outline"
                    className="border-[var(--landing-border)]"
                  >
                    {promoValidating ? <Loader2 className="h-3 w-3 animate-spin" /> : "Apply"}
                  </Button>
                </div>
              )}

              {promoError && (
                <p className="mt-2 text-sm text-red-500">{promoError}</p>
              )}
            </div>
          )}
        </div>
      )}

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
            const showDiscount =
              appliedPromo && PAID_PLANS.includes(id) && plan.price > 0;
            const discountedPrice = showDiscount
              ? getDiscountedPrice(plan.price, appliedPromo.discount)
              : null;
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
                    {showDiscount && discountedPrice !== null ? (
                      <>
                        <span className="mr-1.5 text-[var(--landing-text-tertiary)] line-through">
                          {formatPrice(plan.price)}
                        </span>
                        <span className="text-emerald-500">
                          {formatPrice(Math.round(discountedPrice * 100) / 100)}
                        </span>
                      </>
                    ) : (
                      formatPrice(plan.price)
                    )}
                  </span>
                </div>

                <ul className="mt-4 space-y-2">
                  {[
                    `${formatLimit(plan.projectLimit)} projects`,
                    `${formatLimit(plan.memberLimit)} members`,
                    `${formatLimit(plan.memoryLimitPerProject)} memories/project`,
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
      {!isSelfHostedClient && (
        <div className="mt-10">
          <h2 className="text-sm font-medium text-[var(--landing-text)]">
            Billing management
          </h2>
          <div className="mt-4">
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
                onClick={() => handlePortal()}
                disabled={loading !== null || !hasSubscription}
                className="mt-4 w-full border-[var(--landing-border)] text-[var(--landing-text-secondary)]"
              >
                {loading === "portal" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Manage payment"}
              </Button>
            </div>
          </div>

          <InvoiceHistory orgSlug={orgSlug} />
        </div>
      )}
    </>
  );
}
