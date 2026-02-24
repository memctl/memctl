"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { PLAN_IDS, type PlanId } from "@memctl/shared/constants";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";

interface OrgActionsPanelProps {
  org: {
    slug: string;
    status: string;
    statusReason: string | null;
    statusChangedAt: string | null;
    planId: string;
    planOverride: string | null;
    projectLimit: number;
    memberLimit: number;
    memoryLimitPerProject: number | null;
    apiRatePerMinute: number | null;
    customLimits: boolean | null;
    ownerId: string;
    adminNotes: string | null;
    planDefaultProjectLimit: number;
    planDefaultMemberLimit: number;
    planDefaultMemoryPerProject: number;
    planDefaultApiRate: number;
    trialEndsAt: string | null;
    planExpiresAt: string | null;
    stripeSubscriptionId: string | null;
    stripeCustomerId: string | null;
    contractValue: number | null;
    contractNotes: string | null;
    contractStartDate: string | null;
    contractEndDate: string | null;
    planTemplateId: string | null;
  };
  members: { userId: string; name: string; email: string; role: string }[];
  templates: { id: string; name: string; stripePriceInCents: number | null }[];
}

const statusBadgeStyles: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-500",
  suspended: "bg-amber-500/10 text-amber-500",
  banned: "bg-red-500/10 text-red-500",
};

const selectPopoverCls =
  "bg-[var(--landing-surface)] border-[var(--landing-border)] text-[var(--landing-text)] shadow-xl";
const selectItemCls =
  "font-mono text-[var(--landing-text-secondary)] focus:bg-[var(--landing-surface-2)] focus:text-[var(--landing-text)]";
const dialogCls =
  "bg-[var(--landing-surface)] border-[var(--landing-border)] text-[var(--landing-text)] shadow-xl";

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--landing-border)] bg-[var(--landing-code-bg)] px-4 py-2.5">
      <span className="font-mono text-[11px] font-medium uppercase tracking-widest text-[var(--landing-text-tertiary)]">
        {children}
      </span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-[var(--landing-text-tertiary)]">
      {children}
    </span>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block font-mono text-[10px] text-[var(--landing-text-tertiary)]">
      {children}
    </label>
  );
}

export function OrgActionsPanel({
  org,
  members,
  templates,
}: OrgActionsPanelProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [statusDialog, setStatusDialog] = useState<"suspend" | "ban" | null>(
    null,
  );
  const [statusReason, setStatusReason] = useState("");
  const [planOverride, setPlanOverride] = useState<string>(
    org.planOverride ?? "none",
  );
  const [projectLimit, setProjectLimit] = useState(org.projectLimit);
  const [memberLimit, setMemberLimit] = useState(org.memberLimit);
  const [memoryLimitPerProject, setMemoryLimitPerProject] = useState<string>(
    org.memoryLimitPerProject != null ? String(org.memoryLimitPerProject) : "",
  );
  const [apiRatePerMinute, setApiRatePerMinute] = useState<string>(
    org.apiRatePerMinute != null ? String(org.apiRatePerMinute) : "",
  );
  const [newOwnerId, setNewOwnerId] = useState("");
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [notes, setNotes] = useState(org.adminNotes ?? "");
  const [trialDays, setTrialDays] = useState(14);
  const trialActive = org.trialEndsAt && new Date(org.trialEndsAt) > new Date();
  const [subPriceDollars, setSubPriceDollars] = useState("200");
  const [subInterval, setSubInterval] = useState<"month" | "year">("month");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [applyTemplateSubscription, setApplyTemplateSubscription] =
    useState(false);
  const [templateSubscriptionInterval, setTemplateSubscriptionInterval] =
    useState<"month" | "year">("month");
  const [expiryDate, setExpiryDate] = useState<Date | undefined>(
    org.planExpiresAt ? new Date(org.planExpiresAt) : undefined,
  );
  const [contractValueDollars, setContractValueDollars] = useState(
    org.contractValue !== null ? String(org.contractValue / 100) : "",
  );
  const [contractNotes, setContractNotes] = useState(org.contractNotes ?? "");
  const [contractStart, setContractStart] = useState<Date | undefined>(
    org.contractStartDate ? new Date(org.contractStartDate) : undefined,
  );
  const [contractEnd, setContractEnd] = useState<Date | undefined>(
    org.contractEndDate ? new Date(org.contractEndDate) : undefined,
  );
  const selectedTemplateConfig = templates.find(
    (t) => t.id === selectedTemplate,
  );

  async function doAction(body: Record<string, unknown>) {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/organizations/${org.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Action failed");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  function handleStatusAction() {
    if (!statusDialog) return;
    doAction({ action: statusDialog, reason: statusReason });
    setStatusDialog(null);
    setStatusReason("");
  }

  return (
    <div className="space-y-4">
      {/* Status + Plan */}
      <div className="dash-card overflow-hidden">
        <SectionHeader>Status &amp; Plan</SectionHeader>
        <div className="grid grid-cols-1 divide-y divide-[var(--landing-border)] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <div className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <SectionLabel>Status</SectionLabel>
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium capitalize ${statusBadgeStyles[org.status] ?? statusBadgeStyles.active}`}
              >
                {org.status}
              </span>
            </div>
            {org.statusReason && (
              <p className="mb-2 font-mono text-[11px] text-[var(--landing-text-secondary)]">
                Reason: {org.statusReason}
              </p>
            )}
            {org.statusChangedAt && (
              <p className="mb-3 font-mono text-[10px] text-[var(--landing-text-tertiary)]">
                Changed: {new Date(org.statusChangedAt).toLocaleString()}
              </p>
            )}
            <div className="flex gap-2">
              {org.status === "active" ? (
                <>
                  <Button
                    variant="outline"
                    className="border-amber-500/30 font-mono text-amber-500 hover:bg-amber-500/10"
                    onClick={() => setStatusDialog("suspend")}
                    disabled={loading}
                  >
                    Suspend
                  </Button>
                  <Button
                    variant="outline"
                    className="border-red-500/30 font-mono text-red-500 hover:bg-red-500/10"
                    onClick={() => setStatusDialog("ban")}
                    disabled={loading}
                  >
                    Ban
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  className="border-emerald-500/30 font-mono text-emerald-500 hover:bg-emerald-500/10"
                  onClick={() => doAction({ action: "reactivate" })}
                  disabled={loading}
                >
                  Reactivate
                </Button>
              )}
            </div>
          </div>
          <div className="p-4">
            <SectionLabel>Plan Override</SectionLabel>
            <p className="mb-3 font-mono text-[11px] text-[var(--landing-text-secondary)]">
              Stripe:{" "}
              <span className="text-[var(--landing-text)]">{org.planId}</span>
              {org.planOverride && (
                <>
                  {" "}
                  / Override:{" "}
                  <span className="text-[#F97316]">{org.planOverride}</span>
                </>
              )}
            </p>
            <div className="flex gap-2">
              <Select value={planOverride} onValueChange={setPlanOverride}>
                <SelectTrigger className="flex-1 font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={selectPopoverCls}>
                  <SelectItem value="none" className={selectItemCls}>
                    No override
                  </SelectItem>
                  {PLAN_IDS.map((id) => (
                    <SelectItem key={id} value={id} className={selectItemCls}>
                      {id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                className="border-[#F97316]/30 font-mono text-[#F97316] hover:bg-[#F97316]/10"
                onClick={() =>
                  doAction({
                    action: "override_plan",
                    planId:
                      planOverride === "none" ? null : (planOverride as PlanId),
                  })
                }
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Apply"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Limits */}
      <div className="dash-card overflow-hidden">
        <SectionHeader>
          <div className="flex items-center gap-2">
            Limits
            {org.customLimits && (
              <span className="rounded-full bg-[#F97316]/10 px-2 py-0.5 font-mono text-[9px] font-medium normal-case tracking-normal text-[#F97316]">
                Custom
              </span>
            )}
          </div>
        </SectionHeader>
        <div className="p-4">
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <LimitField
              label="Project limit"
              value={String(projectLimit)}
              onChange={(v) =>
                setProjectLimit(Number(v) || org.planDefaultProjectLimit)
              }
              planDefault={org.planDefaultProjectLimit}
              isOverridden={projectLimit !== org.planDefaultProjectLimit}
              onClear={() => setProjectLimit(org.planDefaultProjectLimit)}
            />
            <LimitField
              label="Member limit"
              value={String(memberLimit)}
              onChange={(v) =>
                setMemberLimit(Number(v) || org.planDefaultMemberLimit)
              }
              planDefault={org.planDefaultMemberLimit}
              isOverridden={memberLimit !== org.planDefaultMemberLimit}
              onClear={() => setMemberLimit(org.planDefaultMemberLimit)}
            />
            <LimitField
              label="Memory / project"
              value={memoryLimitPerProject}
              onChange={setMemoryLimitPerProject}
              planDefault={org.planDefaultMemoryPerProject}
              isOverridden={memoryLimitPerProject !== ""}
              onClear={() => setMemoryLimitPerProject("")}
            />
            <LimitField
              label="API rate / min"
              value={apiRatePerMinute}
              onChange={setApiRatePerMinute}
              planDefault={org.planDefaultApiRate}
              isOverridden={apiRatePerMinute !== ""}
              onClear={() => setApiRatePerMinute("")}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="border-[#F97316]/30 font-mono text-[#F97316] hover:bg-[#F97316]/10"
              onClick={() => {
                const body: Record<string, unknown> = {
                  action: "override_limits",
                  projectLimit,
                  memberLimit,
                };
                if (memoryLimitPerProject)
                  body.memoryLimitPerProject = Number(memoryLimitPerProject);
                else body.memoryLimitPerProject = null;
                if (apiRatePerMinute)
                  body.apiRatePerMinute = Number(apiRatePerMinute);
                else body.apiRatePerMinute = null;
                doAction(body);
              }}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Save Limits"
              )}
            </Button>
            {org.customLimits && (
              <Button
                variant="outline"
                className="border-amber-500/30 font-mono text-amber-500 hover:bg-amber-500/10"
                onClick={() => {
                  setProjectLimit(org.planDefaultProjectLimit);
                  setMemberLimit(org.planDefaultMemberLimit);
                  setMemoryLimitPerProject("");
                  setApiRatePerMinute("");
                  doAction({ action: "reset_limits" });
                }}
                disabled={loading}
              >
                Reset All
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Enterprise: Trial + Subscription + Template + Expiry */}
      <div className="dash-card overflow-hidden">
        <SectionHeader>Enterprise</SectionHeader>
        <div className="grid grid-cols-1 divide-y divide-[var(--landing-border)] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          {/* Trial */}
          <div className="border-b border-[var(--landing-border)] p-4 sm:border-b-0">
            <SectionLabel>Trial</SectionLabel>
            {trialActive ? (
              <div className="mt-2">
                <div className="mb-3 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 font-mono text-[11px] text-amber-500">
                  Active until {new Date(org.trialEndsAt!).toLocaleDateString()}
                </div>
                <Button
                  variant="outline"
                  className="border-red-500/30 font-mono text-red-500 hover:bg-red-500/10"
                  onClick={() => doAction({ action: "end_trial" })}
                  disabled={loading}
                >
                  End Trial
                </Button>
              </div>
            ) : (
              <div className="mt-2 flex items-end gap-2">
                <div className="flex-1">
                  <FieldLabel>Duration (days)</FieldLabel>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={trialDays}
                    onChange={(e) => setTrialDays(Number(e.target.value))}
                    className="font-mono"
                  />
                </div>
                <Button
                  variant="outline"
                  className="border-[#F97316]/30 font-mono text-[#F97316] hover:bg-[#F97316]/10"
                  onClick={() =>
                    doAction({ action: "start_trial", durationDays: trialDays })
                  }
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    "Start Trial"
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Subscription */}
          <div className="p-4">
            <SectionLabel>Subscription</SectionLabel>
            {org.stripeSubscriptionId ? (
              <div className="mt-2">
                <div className="mb-2 break-all rounded-md border border-[var(--landing-border)] bg-[var(--landing-code-bg)] px-3 py-2 font-mono text-[10px] text-[var(--landing-text-secondary)]">
                  {org.stripeSubscriptionId}
                </div>
                <Button
                  variant="outline"
                  className="border-red-500/30 font-mono text-red-500 hover:bg-red-500/10"
                  onClick={() => doAction({ action: "cancel_subscription" })}
                  disabled={loading}
                >
                  Cancel Subscription
                </Button>
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <FieldLabel>Price ($)</FieldLabel>
                    <Input
                      type="number"
                      min={1}
                      value={subPriceDollars}
                      onChange={(e) => setSubPriceDollars(e.target.value)}
                      className="font-mono"
                    />
                  </div>
                  <div>
                    <FieldLabel>Interval</FieldLabel>
                    <Select
                      value={subInterval}
                      onValueChange={(v) =>
                        setSubInterval(v as "month" | "year")
                      }
                    >
                      <SelectTrigger className="font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={selectPopoverCls}>
                        <SelectItem value="month" className={selectItemCls}>
                          Monthly
                        </SelectItem>
                        <SelectItem value="year" className={selectItemCls}>
                          Yearly
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="border-[#F97316]/30 font-mono text-[#F97316] hover:bg-[#F97316]/10"
                  onClick={() =>
                    doAction({
                      action: "create_subscription",
                      priceInCents: Math.round(Number(subPriceDollars) * 100),
                      interval: subInterval,
                    })
                  }
                  disabled={loading || !subPriceDollars}
                >
                  {loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    "Create Subscription"
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 divide-y divide-[var(--landing-border)] border-t border-[var(--landing-border)] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          {/* Template */}
          <div className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <SectionLabel>Plan Template</SectionLabel>
              {org.planTemplateId && (
                <span className="rounded-full bg-[#F97316]/10 px-2 py-0.5 font-mono text-[9px] font-medium text-[#F97316]">
                  {templates.find((t) => t.id === org.planTemplateId)?.name ??
                    "Applied"}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Select
                value={selectedTemplate}
                onValueChange={(value) => {
                  setSelectedTemplate(value);
                  setApplyTemplateSubscription(false);
                }}
              >
                <SelectTrigger className="flex-1 font-mono">
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent className={selectPopoverCls}>
                  {templates.map((t) => (
                    <SelectItem
                      key={t.id}
                      value={t.id}
                      className={selectItemCls}
                    >
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                className="border-[#F97316]/30 font-mono text-[#F97316] hover:bg-[#F97316]/10"
                onClick={() =>
                  doAction({
                    action: "apply_template",
                    templateId: selectedTemplate,
                    createSubscription:
                      applyTemplateSubscription &&
                      !!selectedTemplateConfig?.stripePriceInCents,
                    subscriptionInterval: templateSubscriptionInterval,
                  })
                }
                disabled={loading || !selectedTemplate}
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Apply"
                )}
              </Button>
            </div>
            {selectedTemplateConfig?.stripePriceInCents ? (
              <div className="mt-3 rounded-md border border-[var(--landing-border)] bg-[var(--landing-code-bg)] p-2.5">
                <div className="mb-2 flex items-center justify-between">
                  <label className="flex items-center gap-2 font-mono text-[11px] text-[var(--landing-text-secondary)]">
                    <Checkbox
                      checked={applyTemplateSubscription}
                      onCheckedChange={(checked) =>
                        setApplyTemplateSubscription(checked === true)
                      }
                    />
                    Create Stripe subscription
                  </label>
                  <span className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">
                    $
                    {(
                      selectedTemplateConfig.stripePriceInCents / 100
                    ).toLocaleString()}
                  </span>
                </div>
                <div className="w-40">
                  <FieldLabel>Interval</FieldLabel>
                  <Select
                    value={templateSubscriptionInterval}
                    onValueChange={(v) =>
                      setTemplateSubscriptionInterval(v as "month" | "year")
                    }
                  >
                    <SelectTrigger className="font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={selectPopoverCls}>
                      <SelectItem value="month" className={selectItemCls}>
                        Monthly
                      </SelectItem>
                      <SelectItem value="year" className={selectItemCls}>
                        Yearly
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : null}
          </div>

          {/* Expiry */}
          <div className="p-4">
            <SectionLabel>Plan Expiry</SectionLabel>
            {org.planExpiresAt && (
              <p className="mb-2 font-mono text-[11px] text-[var(--landing-text-secondary)]">
                Expires:{" "}
                <span className="text-[var(--landing-text)]">
                  {new Date(org.planExpiresAt).toLocaleDateString()}
                </span>
              </p>
            )}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <FieldLabel>Date</FieldLabel>
                <DatePicker
                  value={expiryDate}
                  onChange={setExpiryDate}
                  placeholder="Select expiry"
                />
              </div>
              <Button
                variant="outline"
                className="border-[#F97316]/30 font-mono text-[#F97316] hover:bg-[#F97316]/10"
                onClick={() =>
                  doAction({
                    action: "set_expiry",
                    expiresAt: expiryDate!.getTime(),
                  })
                }
                disabled={loading || !expiryDate}
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Set"
                )}
              </Button>
              {org.planExpiresAt && (
                <Button
                  variant="outline"
                  className="border-amber-500/30 font-mono text-amber-500 hover:bg-amber-500/10"
                  onClick={() => {
                    setExpiryDate(undefined);
                    doAction({ action: "clear_expiry" });
                  }}
                  disabled={loading}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Contract */}
      <div className="dash-card overflow-hidden">
        <SectionHeader>Contract</SectionHeader>
        <div className="p-4">
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <FieldLabel>Annual value ($)</FieldLabel>
              <Input
                type="number"
                min={0}
                value={contractValueDollars}
                onChange={(e) => setContractValueDollars(e.target.value)}
                placeholder="0"
                className="font-mono"
              />
            </div>
            <div>
              <FieldLabel>Start date</FieldLabel>
              <DatePicker
                value={contractStart}
                onChange={setContractStart}
                placeholder="Start"
              />
            </div>
            <div>
              <FieldLabel>End date</FieldLabel>
              <DatePicker
                value={contractEnd}
                onChange={setContractEnd}
                placeholder="End"
              />
            </div>
          </div>
          <div className="mb-3">
            <FieldLabel>Notes</FieldLabel>
            <Textarea
              value={contractNotes}
              onChange={(e) => setContractNotes(e.target.value)}
              rows={2}
              className="resize-none font-mono"
              placeholder="Deal details, contact info, etc."
            />
          </div>
          <Button
            variant="outline"
            className="border-[#F97316]/30 font-mono text-[#F97316] hover:bg-[#F97316]/10"
            onClick={() =>
              doAction({
                action: "update_contract",
                contractValue: contractValueDollars
                  ? Math.round(Number(contractValueDollars) * 100)
                  : null,
                contractNotes: contractNotes || null,
                contractStartDate: contractStart
                  ? contractStart.getTime()
                  : null,
                contractEndDate: contractEnd ? contractEnd.getTime() : null,
              })
            }
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              "Save Contract"
            )}
          </Button>
        </div>
      </div>

      {/* Ownership */}
      <div className="dash-card overflow-hidden">
        <SectionHeader>Ownership</SectionHeader>
        <div className="p-4">
          <SectionLabel>Owner</SectionLabel>
          <p className="mb-3 font-mono text-[11px] text-[var(--landing-text-secondary)]">
            Current:{" "}
            <span className="text-[var(--landing-text)]">
              {members.find((m) => m.userId === org.ownerId)?.name ?? "Unknown"}
            </span>
          </p>
          <div className="flex gap-2">
            <Select value={newOwnerId} onValueChange={setNewOwnerId}>
              <SelectTrigger className="flex-1 font-mono">
                <SelectValue placeholder="Select member" />
              </SelectTrigger>
              <SelectContent className={selectPopoverCls}>
                {members
                  .filter((m) => m.userId !== org.ownerId)
                  .map((m) => (
                    <SelectItem
                      key={m.userId}
                      value={m.userId}
                      className={selectItemCls}
                    >
                      {m.name} ({m.email})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              className="border-[#F97316]/30 font-mono text-[#F97316] hover:bg-[#F97316]/10"
              onClick={() => setShowTransferConfirm(true)}
              disabled={loading || !newOwnerId}
            >
              Transfer
            </Button>
          </div>
        </div>
      </div>

      {/* Admin Notes - full width */}
      <div className="dash-card overflow-hidden">
        <SectionHeader>Admin Notes</SectionHeader>
        <div className="p-4">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={8}
            className="mb-3 min-h-[180px] font-mono text-[11px] leading-relaxed"
            placeholder="Internal notes, context, decisions, history (not visible to org members)"
          />
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] text-[var(--landing-text-tertiary)]">
              {notes.length > 0 ? `${notes.length} chars` : ""}
            </span>
            <Button
              variant="outline"
              className="border-[#F97316]/30 font-mono text-[#F97316] hover:bg-[#F97316]/10"
              onClick={() => doAction({ action: "update_notes", notes })}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Save Notes"
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Suspend/Ban dialog */}
      <Dialog
        open={!!statusDialog}
        onOpenChange={(open) => {
          if (!open) {
            setStatusDialog(null);
            setStatusReason("");
          }
        }}
      >
        <DialogContent className={dialogCls}>
          <DialogHeader>
            <DialogTitle className="font-mono text-sm capitalize text-[var(--landing-text)]">
              {statusDialog} Organization
            </DialogTitle>
          </DialogHeader>
          <Textarea
            value={statusReason}
            onChange={(e) => setStatusReason(e.target.value)}
            rows={3}
            className="resize-none font-mono"
            placeholder="Reason (required)"
          />
          <DialogFooter>
            <Button
              variant="outline"
              className="font-mono"
              onClick={() => {
                setStatusDialog(null);
                setStatusReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              className={`font-mono ${statusDialog === "ban" ? "bg-red-500 hover:bg-red-600" : "bg-amber-500 hover:bg-amber-600"}`}
              onClick={handleStatusAction}
              disabled={!statusReason.trim() || loading}
            >
              Confirm {statusDialog}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer ownership confirm */}
      <Dialog open={showTransferConfirm} onOpenChange={setShowTransferConfirm}>
        <DialogContent className={dialogCls}>
          <DialogHeader>
            <DialogTitle className="font-mono text-sm text-[var(--landing-text)]">
              Transfer Ownership
            </DialogTitle>
          </DialogHeader>
          <p className="font-mono text-[11px] text-[var(--landing-text-secondary)]">
            This will transfer ownership to{" "}
            <span className="text-[var(--landing-text)]">
              {members.find((m) => m.userId === newOwnerId)?.name}
            </span>
            . The current owner will be demoted to admin. This action is logged.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              className="font-mono"
              onClick={() => setShowTransferConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-[#F97316] font-mono hover:bg-[#F97316]/80"
              onClick={() => {
                doAction({ action: "transfer_ownership", newOwnerId });
                setShowTransferConfirm(false);
                setNewOwnerId("");
              }}
              disabled={loading}
            >
              Confirm Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LimitField({
  label,
  value,
  onChange,
  planDefault,
  isOverridden,
  onClear,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  planDefault: number;
  isOverridden: boolean;
  onClear: () => void;
}) {
  const displayDefault =
    planDefault >= 999999 ? "unlimited" : String(planDefault);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">
          {label}
        </label>
        {isOverridden && (
          <button
            type="button"
            onClick={onClear}
            className="font-mono text-[9px] text-[var(--landing-text-tertiary)] transition-colors hover:text-[var(--landing-text)]"
          >
            clear
          </button>
        )}
      </div>
      <Input
        type="number"
        min={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={displayDefault}
        className={`font-mono ${isOverridden ? "border-[#F97316]/30" : ""}`}
      />
      {!isOverridden && (
        <span className="mt-0.5 block font-mono text-[9px] text-[var(--landing-text-tertiary)]">
          plan default
        </span>
      )}
    </div>
  );
}
