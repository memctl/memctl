"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
    memoryLimitOrg: number | null;
    apiRatePerMinute: number | null;
    customLimits: boolean | null;
    ownerId: string;
    adminNotes: string | null;
    planDefaultMemoryPerProject: number;
    planDefaultMemoryOrg: number;
    planDefaultApiRate: number;
    trialEndsAt: string | null;
    planExpiresAt: string | null;
    stripeSubscriptionId: string | null;
    stripeCustomerId: string | null;
    meteredBilling: boolean | null;
    contractValue: number | null;
    contractNotes: string | null;
    contractStartDate: string | null;
    contractEndDate: string | null;
    planTemplateId: string | null;
  };
  members: { userId: string; name: string; email: string; role: string }[];
  templates: { id: string; name: string }[];
}

const statusBadgeStyles: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-500",
  suspended: "bg-amber-500/10 text-amber-500",
  banned: "bg-red-500/10 text-red-500",
};

export function OrgActionsPanel({ org, members, templates }: OrgActionsPanelProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Status dialog
  const [statusDialog, setStatusDialog] = useState<"suspend" | "ban" | null>(
    null,
  );
  const [statusReason, setStatusReason] = useState("");

  // Plan override
  const [planOverride, setPlanOverride] = useState<string>(
    org.planOverride ?? "none",
  );

  // Limits
  const [projectLimit, setProjectLimit] = useState(org.projectLimit);
  const [memberLimit, setMemberLimit] = useState(org.memberLimit);
  const [memoryLimitPerProject, setMemoryLimitPerProject] = useState<string>(
    org.memoryLimitPerProject != null ? String(org.memoryLimitPerProject) : "",
  );
  const [memoryLimitOrg, setMemoryLimitOrg] = useState<string>(
    org.memoryLimitOrg != null ? String(org.memoryLimitOrg) : "",
  );
  const [apiRatePerMinute, setApiRatePerMinute] = useState<string>(
    org.apiRatePerMinute != null ? String(org.apiRatePerMinute) : "",
  );

  // Ownership
  const [newOwnerId, setNewOwnerId] = useState("");
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);

  // Notes
  const [notes, setNotes] = useState(org.adminNotes ?? "");

  // Trial
  const [trialDays, setTrialDays] = useState(14);
  const trialActive = org.trialEndsAt && new Date(org.trialEndsAt) > new Date();

  // Subscription
  const [subPriceDollars, setSubPriceDollars] = useState("200");
  const [subInterval, setSubInterval] = useState<"month" | "year">("month");
  const [subMetering, setSubMetering] = useState(false);

  // Template
  const [selectedTemplate, setSelectedTemplate] = useState("");

  // Expiry
  const [expiryDate, setExpiryDate] = useState(
    org.planExpiresAt ? new Date(org.planExpiresAt).toISOString().slice(0, 10) : "",
  );

  // Contract
  const [contractValueDollars, setContractValueDollars] = useState(
    org.contractValue !== null ? String(org.contractValue / 100) : "",
  );
  const [contractNotes, setContractNotes] = useState(org.contractNotes ?? "");
  const [contractStart, setContractStart] = useState(
    org.contractStartDate ? new Date(org.contractStartDate).toISOString().slice(0, 10) : "",
  );
  const [contractEnd, setContractEnd] = useState(
    org.contractEndDate ? new Date(org.contractEndDate).toISOString().slice(0, 10) : "",
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
        alert(data.error ?? "Action failed");
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
    <div className="dash-card overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--landing-border)] bg-[var(--landing-code-bg)]">
        <span className="font-mono text-[11px] font-medium uppercase tracking-widest text-[var(--landing-text-tertiary)]">
          Admin Actions
        </span>
      </div>

      {/* Status section */}
      <div className="p-3 border-b border-[var(--landing-border)]">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--landing-text-tertiary)]">
            Status
          </span>
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium capitalize ${
              statusBadgeStyles[org.status] ?? statusBadgeStyles.active
            }`}
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
          <p className="mb-2 font-mono text-[10px] text-[var(--landing-text-tertiary)]">
            Changed: {new Date(org.statusChangedAt).toLocaleString()}
          </p>
        )}
        <div className="flex gap-2 mt-2">
          {org.status === "active" ? (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-7 font-mono text-[11px] text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
                onClick={() => setStatusDialog("suspend")}
                disabled={loading}
              >
                Suspend
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 font-mono text-[11px] text-red-500 border-red-500/30 hover:bg-red-500/10"
                onClick={() => setStatusDialog("ban")}
                disabled={loading}
              >
                Ban
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-7 font-mono text-[11px] text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10"
              onClick={() => doAction({ action: "reactivate" })}
              disabled={loading}
            >
              Reactivate
            </Button>
          )}
        </div>
      </div>

      {/* Plan override section */}
      <div className="p-3 border-b border-[var(--landing-border)]">
        <span className="block mb-2 font-mono text-[10px] uppercase tracking-widest text-[var(--landing-text-tertiary)]">
          Plan Override
        </span>
        <p className="mb-2 font-mono text-[11px] text-[var(--landing-text-secondary)]">
          Stripe plan: <span className="text-[var(--landing-text)]">{org.planId}</span>
          {org.planOverride && (
            <>
              {" "}/ Override: <span className="text-[#F97316]">{org.planOverride}</span>
            </>
          )}
        </p>
        <div className="flex gap-2">
          <Select value={planOverride} onValueChange={setPlanOverride}>
            <SelectTrigger className="h-7 font-mono text-[11px] flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No override</SelectItem>
              {PLAN_IDS.map((id) => (
                <SelectItem key={id} value={id}>
                  {id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            className="h-7 font-mono text-[11px]"
            onClick={() =>
              doAction({
                action: "override_plan",
                planId: planOverride === "none" ? null : (planOverride as PlanId),
              })
            }
            disabled={loading}
          >
            Apply
          </Button>
        </div>
      </div>

      {/* Limits section */}
      <div className="p-3 border-b border-[var(--landing-border)]">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--landing-text-tertiary)]">
            Limits
          </span>
          {org.customLimits && (
            <span className="rounded-full bg-[#F97316]/10 px-2 py-0.5 font-mono text-[9px] font-medium text-[#F97316]">
              Custom
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label className="block mb-1 font-mono text-[10px] text-[var(--landing-text-tertiary)]">
              Project limit
            </label>
            <Input
              type="number"
              min={1}
              value={projectLimit}
              onChange={(e) => setProjectLimit(Number(e.target.value))}
              className="h-7 font-mono text-[11px]"
            />
          </div>
          <div>
            <label className="block mb-1 font-mono text-[10px] text-[var(--landing-text-tertiary)]">
              Member limit
            </label>
            <Input
              type="number"
              min={1}
              value={memberLimit}
              onChange={(e) => setMemberLimit(Number(e.target.value))}
              className="h-7 font-mono text-[11px]"
            />
          </div>
          <div>
            <label className="block mb-1 font-mono text-[10px] text-[var(--landing-text-tertiary)]">
              Memory / project
            </label>
            <Input
              type="number"
              min={1}
              value={memoryLimitPerProject}
              onChange={(e) => setMemoryLimitPerProject(e.target.value)}
              placeholder={String(org.planDefaultMemoryPerProject)}
              className="h-7 font-mono text-[11px]"
            />
          </div>
          <div>
            <label className="block mb-1 font-mono text-[10px] text-[var(--landing-text-tertiary)]">
              Memory org-wide
            </label>
            <Input
              type="number"
              min={1}
              value={memoryLimitOrg}
              onChange={(e) => setMemoryLimitOrg(e.target.value)}
              placeholder={String(org.planDefaultMemoryOrg)}
              className="h-7 font-mono text-[11px]"
            />
          </div>
          <div>
            <label className="block mb-1 font-mono text-[10px] text-[var(--landing-text-tertiary)]">
              API rate / min
            </label>
            <Input
              type="number"
              min={1}
              value={apiRatePerMinute}
              onChange={(e) => setApiRatePerMinute(e.target.value)}
              placeholder={String(org.planDefaultApiRate)}
              className="h-7 font-mono text-[11px]"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 font-mono text-[11px]"
            onClick={() => {
              const body: Record<string, unknown> = {
                action: "override_limits",
                projectLimit,
                memberLimit,
              };
              if (memoryLimitPerProject)
                body.memoryLimitPerProject = Number(memoryLimitPerProject);
              if (memoryLimitOrg)
                body.memoryLimitOrg = Number(memoryLimitOrg);
              if (apiRatePerMinute)
                body.apiRatePerMinute = Number(apiRatePerMinute);
              doAction(body);
            }}
            disabled={loading}
          >
            Save Limits
          </Button>
          {org.customLimits && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 font-mono text-[11px] text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
              onClick={() => doAction({ action: "reset_limits" })}
              disabled={loading}
            >
              Reset to Plan Defaults
            </Button>
          )}
        </div>
      </div>

      {/* Trial section */}
      <div className="p-3 border-b border-[var(--landing-border)]">
        <span className="block mb-2 font-mono text-[10px] uppercase tracking-widest text-[var(--landing-text-tertiary)]">
          Trial
        </span>
        {trialActive ? (
          <div>
            <p className="mb-2 font-mono text-[11px] text-amber-500">
              Trial active, ends {new Date(org.trialEndsAt!).toLocaleDateString()}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="h-7 font-mono text-[11px] text-red-500 border-red-500/30 hover:bg-red-500/10"
              onClick={() => doAction({ action: "end_trial" })}
              disabled={loading}
            >
              End Trial
            </Button>
          </div>
        ) : (
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block mb-1 font-mono text-[10px] text-[var(--landing-text-tertiary)]">
                Duration (days)
              </label>
              <Input
                type="number"
                min={1}
                max={365}
                value={trialDays}
                onChange={(e) => setTrialDays(Number(e.target.value))}
                className="h-7 font-mono text-[11px]"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 font-mono text-[11px]"
              onClick={() =>
                doAction({ action: "start_trial", durationDays: trialDays })
              }
              disabled={loading}
            >
              Start Trial
            </Button>
          </div>
        )}
      </div>

      {/* Subscription section */}
      <div className="p-3 border-b border-[var(--landing-border)]">
        <span className="block mb-2 font-mono text-[10px] uppercase tracking-widest text-[var(--landing-text-tertiary)]">
          Subscription
        </span>
        {org.stripeSubscriptionId ? (
          <div>
            <p className="mb-2 font-mono text-[11px] text-[var(--landing-text-secondary)]">
              ID: <span className="text-[var(--landing-text)]">{org.stripeSubscriptionId}</span>
            </p>
            {org.meteredBilling && (
              <p className="mb-2 font-mono text-[10px] text-[var(--landing-text-tertiary)]">
                Metered billing active
              </p>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-7 font-mono text-[11px] text-red-500 border-red-500/30 hover:bg-red-500/10"
              onClick={() => doAction({ action: "cancel_subscription" })}
              disabled={loading}
            >
              Cancel Subscription
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block mb-1 font-mono text-[10px] text-[var(--landing-text-tertiary)]">
                  Price ($)
                </label>
                <Input
                  type="number"
                  min={1}
                  value={subPriceDollars}
                  onChange={(e) => setSubPriceDollars(e.target.value)}
                  className="h-7 font-mono text-[11px]"
                />
              </div>
              <div>
                <label className="block mb-1 font-mono text-[10px] text-[var(--landing-text-tertiary)]">
                  Interval
                </label>
                <Select value={subInterval} onValueChange={(v) => setSubInterval(v as "month" | "year")}>
                  <SelectTrigger className="h-7 font-mono text-[11px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Monthly</SelectItem>
                    <SelectItem value="year">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <label className="flex items-center gap-2 font-mono text-[11px] text-[var(--landing-text-secondary)]">
              <input
                type="checkbox"
                checked={subMetering}
                onChange={(e) => setSubMetering(e.target.checked)}
                className="rounded border-[var(--landing-border)]"
              />
              Enable metered billing
            </label>
            <Button
              size="sm"
              variant="outline"
              className="h-7 font-mono text-[11px]"
              onClick={() =>
                doAction({
                  action: "create_subscription",
                  priceInCents: Math.round(Number(subPriceDollars) * 100),
                  interval: subInterval,
                  enableMetering: subMetering,
                })
              }
              disabled={loading || !subPriceDollars}
            >
              Create Subscription
            </Button>
          </div>
        )}
      </div>

      {/* Template section */}
      <div className="p-3 border-b border-[var(--landing-border)]">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--landing-text-tertiary)]">
            Plan Template
          </span>
          {org.planTemplateId && (
            <span className="rounded-full bg-[#F97316]/10 px-2 py-0.5 font-mono text-[9px] font-medium text-[#F97316]">
              {templates.find((t) => t.id === org.planTemplateId)?.name ?? "Applied"}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
            <SelectTrigger className="h-7 font-mono text-[11px] flex-1">
              <SelectValue placeholder="Select template" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            className="h-7 font-mono text-[11px]"
            onClick={() =>
              doAction({ action: "apply_template", templateId: selectedTemplate })
            }
            disabled={loading || !selectedTemplate}
          >
            Apply
          </Button>
        </div>
      </div>

      {/* Expiry section */}
      <div className="p-3 border-b border-[var(--landing-border)]">
        <span className="block mb-2 font-mono text-[10px] uppercase tracking-widest text-[var(--landing-text-tertiary)]">
          Plan Expiry
        </span>
        {org.planExpiresAt && (
          <p className="mb-2 font-mono text-[11px] text-[var(--landing-text-secondary)]">
            Expires: <span className="text-[var(--landing-text)]">{new Date(org.planExpiresAt).toLocaleDateString()}</span>
          </p>
        )}
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block mb-1 font-mono text-[10px] text-[var(--landing-text-tertiary)]">
              Expiry date
            </label>
            <Input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="h-7 font-mono text-[11px]"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 font-mono text-[11px]"
            onClick={() =>
              doAction({
                action: "set_expiry",
                expiresAt: new Date(expiryDate).getTime(),
              })
            }
            disabled={loading || !expiryDate}
          >
            Set
          </Button>
          {org.planExpiresAt && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 font-mono text-[11px] text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
              onClick={() => doAction({ action: "clear_expiry" })}
              disabled={loading}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Contract section */}
      <div className="p-3 border-b border-[var(--landing-border)]">
        <span className="block mb-2 font-mono text-[10px] uppercase tracking-widest text-[var(--landing-text-tertiary)]">
          Contract
        </span>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label className="block mb-1 font-mono text-[10px] text-[var(--landing-text-tertiary)]">
              Annual value ($)
            </label>
            <Input
              type="number"
              min={0}
              value={contractValueDollars}
              onChange={(e) => setContractValueDollars(e.target.value)}
              placeholder="0"
              className="h-7 font-mono text-[11px]"
            />
          </div>
          <div>
            <label className="block mb-1 font-mono text-[10px] text-[var(--landing-text-tertiary)]">
              Start date
            </label>
            <Input
              type="date"
              value={contractStart}
              onChange={(e) => setContractStart(e.target.value)}
              className="h-7 font-mono text-[11px]"
            />
          </div>
          <div>
            <label className="block mb-1 font-mono text-[10px] text-[var(--landing-text-tertiary)]">
              End date
            </label>
            <Input
              type="date"
              value={contractEnd}
              onChange={(e) => setContractEnd(e.target.value)}
              className="h-7 font-mono text-[11px]"
            />
          </div>
        </div>
        <div className="mb-2">
          <label className="block mb-1 font-mono text-[10px] text-[var(--landing-text-tertiary)]">
            Notes
          </label>
          <Textarea
            value={contractNotes}
            onChange={(e) => setContractNotes(e.target.value)}
            rows={2}
            className="font-mono text-[11px] resize-none"
            placeholder="Deal details, contact info, etc."
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 font-mono text-[11px]"
          onClick={() =>
            doAction({
              action: "update_contract",
              contractValue: contractValueDollars ? Math.round(Number(contractValueDollars) * 100) : null,
              contractNotes: contractNotes || null,
              contractStartDate: contractStart ? new Date(contractStart).getTime() : null,
              contractEndDate: contractEnd ? new Date(contractEnd).getTime() : null,
            })
          }
          disabled={loading}
        >
          Save Contract
        </Button>
      </div>

      {/* Ownership section */}
      <div className="p-3 border-b border-[var(--landing-border)]">
        <span className="block mb-2 font-mono text-[10px] uppercase tracking-widest text-[var(--landing-text-tertiary)]">
          Ownership
        </span>
        <p className="mb-2 font-mono text-[11px] text-[var(--landing-text-secondary)]">
          Current owner:{" "}
          <span className="text-[var(--landing-text)]">
            {members.find((m) => m.userId === org.ownerId)?.name ?? "Unknown"}
          </span>
        </p>
        <div className="flex gap-2">
          <Select value={newOwnerId} onValueChange={setNewOwnerId}>
            <SelectTrigger className="h-7 font-mono text-[11px] flex-1">
              <SelectValue placeholder="Select member" />
            </SelectTrigger>
            <SelectContent>
              {members
                .filter((m) => m.userId !== org.ownerId)
                .map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.name} ({m.email})
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            className="h-7 font-mono text-[11px]"
            onClick={() => setShowTransferConfirm(true)}
            disabled={loading || !newOwnerId}
          >
            Transfer
          </Button>
        </div>
      </div>

      {/* Notes section */}
      <div className="p-3">
        <span className="block mb-2 font-mono text-[10px] uppercase tracking-widest text-[var(--landing-text-tertiary)]">
          Admin Notes
        </span>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="mb-2 font-mono text-[11px] resize-none"
          placeholder="Internal notes (not visible to org members)"
        />
        <Button
          size="sm"
          variant="outline"
          className="h-7 font-mono text-[11px]"
          onClick={() => doAction({ action: "update_notes", notes })}
          disabled={loading}
        >
          Save Notes
        </Button>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-mono text-sm capitalize">
              {statusDialog} Organization
            </DialogTitle>
          </DialogHeader>
          <Textarea
            value={statusReason}
            onChange={(e) => setStatusReason(e.target.value)}
            rows={3}
            className="font-mono text-[11px] resize-none"
            placeholder="Reason (required)"
          />
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="h-7 font-mono text-[11px]"
              onClick={() => {
                setStatusDialog(null);
                setStatusReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className={`h-7 font-mono text-[11px] ${
                statusDialog === "ban"
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-amber-500 hover:bg-amber-600"
              }`}
              onClick={handleStatusAction}
              disabled={!statusReason.trim() || loading}
            >
              Confirm {statusDialog}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer ownership confirm */}
      <Dialog
        open={showTransferConfirm}
        onOpenChange={setShowTransferConfirm}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">
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
              size="sm"
              className="h-7 font-mono text-[11px]"
              onClick={() => setShowTransferConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 font-mono text-[11px] bg-[#F97316] hover:bg-[#F97316]/80"
              onClick={() => {
                doAction({
                  action: "transfer_ownership",
                  newOwnerId,
                });
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
