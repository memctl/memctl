"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StatCard } from "@/components/dashboard/shared/stat-card";
import {
  Ticket,
  CheckCircle,
  Hash,
  DollarSign,
  Plus,
  MoreHorizontal,
  Copy,
  Eye,
  Pencil,
  Trash2,
  Power,
  Shuffle,
  Search,
  ChevronDown,
  X,
} from "lucide-react";

interface PromoCode {
  id: string;
  code: string;
  description: string | null;
  campaign: string | null;
  stripeCouponId: string;
  stripePromoCodeId: string;
  discountType: string;
  discountAmount: number;
  currency: string | null;
  duration: string;
  durationInMonths: number | null;
  applicablePlans: string | null;
  minimumPlanTier: string | null;
  restrictedToOrgs: string | null;
  maxRedemptions: number | null;
  maxRedemptionsPerOrg: number | null;
  firstSubscriptionOnly: boolean | null;
  noPreviousPromo: boolean | null;
  startsAt: string | null;
  expiresAt: string | null;
  active: boolean | null;
  timesRedeemed: number;
  totalDiscountGiven: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Redemption {
  id: string;
  orgName: string | null;
  orgSlug: string | null;
  userName: string | null;
  planId: string;
  discountApplied: number;
  redeemedAt: string;
}

interface OrgInfo {
  id: string;
  name: string;
  slug: string;
}

interface PromoCodesManagerProps {
  stats: {
    totalCodes: number;
    activeCodes: number;
    totalRedemptions: number;
    totalDiscountGiven: number;
  };
  orgList: OrgInfo[];
}

const PLAN_OPTIONS = ["lite", "pro", "business", "scale"] as const;
const PLAN_TIER_OPTIONS = [
  { value: "", label: "None" },
  { value: "lite", label: "Lite" },
  { value: "pro", label: "Pro" },
  { value: "business", label: "Business" },
  { value: "scale", label: "Scale" },
];

type FormData = {
  code: string;
  description: string;
  campaign: string;
  discountType: "percent" | "fixed";
  discountAmount: string;
  currency: string;
  duration: "once" | "repeating" | "forever";
  durationInMonths: string;
  applicablePlans: string[];
  minimumPlanTier: string;
  restrictedToOrgs: string[];
  maxRedemptions: string;
  maxRedemptionsPerOrg: string;
  firstSubscriptionOnly: boolean;
  noPreviousPromo: boolean;
  startsAt: string;
  expiresAt: string;
  bulkPrefix: string;
  bulkCount: string;
};

const defaultForm: FormData = {
  code: "",
  description: "",
  campaign: "",
  discountType: "percent",
  discountAmount: "",
  currency: "usd",
  duration: "once",
  durationInMonths: "3",
  applicablePlans: [],
  minimumPlanTier: "",
  restrictedToOrgs: [],
  maxRedemptions: "",
  maxRedemptionsPerOrg: "1",
  firstSubscriptionOnly: false,
  noPreviousPromo: false,
  startsAt: "",
  expiresAt: "",
  bulkPrefix: "",
  bulkCount: "",
};

function getStatus(code: PromoCode): string {
  if (!code.active) return "inactive";
  const now = Date.now();
  if (code.startsAt && new Date(code.startsAt).getTime() > now) return "scheduled";
  if (code.expiresAt && new Date(code.expiresAt).getTime() < now) return "expired";
  if (code.maxRedemptions !== null && code.timesRedeemed >= code.maxRedemptions) return "maxed";
  return "active";
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-500",
    inactive: "bg-[var(--landing-surface-2)] text-[var(--landing-text-secondary)]",
    expired: "bg-red-500/10 text-red-500",
    maxed: "bg-amber-500/10 text-amber-500",
    scheduled: "bg-blue-500/10 text-blue-500",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium capitalize ${styles[status] ?? styles.inactive}`}>
      {status}
    </span>
  );
}

function formatDiscount(code: PromoCode) {
  if (code.discountType === "percent") return `${code.discountAmount}% off`;
  return `$${(code.discountAmount / 100).toFixed(2)} off`;
}

function formatDuration(code: PromoCode) {
  if (code.duration === "once") return "once";
  if (code.duration === "forever") return "forever";
  return `${code.durationInMonths} months`;
}

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function generateRandomCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function PromoCodesManager({ stats, orgList }: PromoCodesManagerProps) {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [campaigns, setCampaigns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCampaign, setFilterCampaign] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDiscountType, setFilterDiscountType] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({ ...defaultForm });
  const [submitting, setSubmitting] = useState(false);
  const [showBulk, setShowBulk] = useState(false);

  const [detailCode, setDetailCode] = useState<PromoCode | null>(null);
  const [detailRedemptions, setDetailRedemptions] = useState<Redemption[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloneSourceId, setCloneSourceId] = useState<string | null>(null);
  const [cloneCode, setCloneCode] = useState("");

  const fetchCodes = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (filterCampaign) params.set("campaign", filterCampaign);
    if (filterStatus === "active") params.set("active", "true");
    if (filterStatus === "inactive") params.set("active", "false");

    const res = await fetch(`/api/v1/admin/promo-codes?${params}`);
    const data = await res.json();
    setCodes(data.codes ?? []);
    setCampaigns(data.campaigns ?? []);
    setLoading(false);
  }, [searchQuery, filterCampaign, filterStatus]);

  useEffect(() => {
    fetchCodes();
  }, [fetchCodes]);

  const filteredCodes = codes.filter((code) => {
    if (filterStatus === "expired" && getStatus(code) !== "expired") return false;
    if (filterStatus === "maxed" && getStatus(code) !== "maxed") return false;
    if (filterStatus === "scheduled" && getStatus(code) !== "scheduled") return false;
    if (filterDiscountType === "percent" && code.discountType !== "percent") return false;
    if (filterDiscountType === "fixed" && code.discountType !== "fixed") return false;
    return true;
  });

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (editingId) {
        // PATCH
        await fetch(`/api/v1/admin/promo-codes/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: form.description || null,
            campaign: form.campaign || null,
            applicablePlans: form.applicablePlans.length > 0 ? form.applicablePlans : null,
            minimumPlanTier: form.minimumPlanTier || null,
            restrictedToOrgs: form.restrictedToOrgs.length > 0 ? form.restrictedToOrgs : null,
            maxRedemptions: form.maxRedemptions ? parseInt(form.maxRedemptions) : null,
            maxRedemptionsPerOrg: form.maxRedemptionsPerOrg ? parseInt(form.maxRedemptionsPerOrg) : 1,
            firstSubscriptionOnly: form.firstSubscriptionOnly,
            noPreviousPromo: form.noPreviousPromo,
            startsAt: form.startsAt || null,
            expiresAt: form.expiresAt || null,
          }),
        });
      } else {
        // POST (create)
        const payload: Record<string, unknown> = {
          discountType: form.discountType,
          discountAmount: parseInt(form.discountAmount),
          currency: form.currency,
          duration: form.duration,
          durationInMonths: form.duration === "repeating" ? parseInt(form.durationInMonths) : undefined,
          description: form.description || null,
          campaign: form.campaign || null,
          applicablePlans: form.applicablePlans.length > 0 ? form.applicablePlans : null,
          minimumPlanTier: form.minimumPlanTier || null,
          restrictedToOrgs: form.restrictedToOrgs.length > 0 ? form.restrictedToOrgs : null,
          maxRedemptions: form.maxRedemptions ? parseInt(form.maxRedemptions) : null,
          maxRedemptionsPerOrg: form.maxRedemptionsPerOrg ? parseInt(form.maxRedemptionsPerOrg) : 1,
          firstSubscriptionOnly: form.firstSubscriptionOnly,
          noPreviousPromo: form.noPreviousPromo,
          startsAt: form.startsAt || null,
          expiresAt: form.expiresAt || null,
        };

        if (showBulk && form.bulkPrefix && form.bulkCount) {
          payload.bulkPrefix = form.bulkPrefix;
          payload.bulkCount = parseInt(form.bulkCount);
        } else {
          payload.code = form.code;
        }

        await fetch("/api/v1/admin/promo-codes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      setDialogOpen(false);
      setEditingId(null);
      setForm({ ...defaultForm });
      setShowBulk(false);
      fetchCodes();
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (code: PromoCode) => {
    setEditingId(code.id);
    setForm({
      code: code.code,
      description: code.description ?? "",
      campaign: code.campaign ?? "",
      discountType: code.discountType as "percent" | "fixed",
      discountAmount: String(code.discountAmount),
      currency: code.currency ?? "usd",
      duration: code.duration as "once" | "repeating" | "forever",
      durationInMonths: String(code.durationInMonths ?? 3),
      applicablePlans: code.applicablePlans ? JSON.parse(code.applicablePlans) : [],
      minimumPlanTier: code.minimumPlanTier ?? "",
      restrictedToOrgs: code.restrictedToOrgs ? JSON.parse(code.restrictedToOrgs) : [],
      maxRedemptions: code.maxRedemptions !== null ? String(code.maxRedemptions) : "",
      maxRedemptionsPerOrg: String(code.maxRedemptionsPerOrg ?? 1),
      firstSubscriptionOnly: code.firstSubscriptionOnly ?? false,
      noPreviousPromo: code.noPreviousPromo ?? false,
      startsAt: code.startsAt ? new Date(code.startsAt).toISOString().slice(0, 16) : "",
      expiresAt: code.expiresAt ? new Date(code.expiresAt).toISOString().slice(0, 16) : "",
      bulkPrefix: "",
      bulkCount: "",
    });
    setShowBulk(false);
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...defaultForm });
    setShowBulk(false);
    setDialogOpen(true);
  };

  const openDetail = async (code: PromoCode) => {
    setDetailCode(code);
    setDetailOpen(true);
    const res = await fetch(`/api/v1/admin/promo-codes/${code.id}`);
    const data = await res.json();
    if (data.code) setDetailCode(data.code);
    setDetailRedemptions(data.redemptions ?? []);
  };

  const toggleActive = async (code: PromoCode) => {
    await fetch(`/api/v1/admin/promo-codes/${code.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !code.active }),
    });
    fetchCodes();
  };

  const deleteCode = async (code: PromoCode) => {
    if (!confirm(`Deactivate promo code "${code.code}"?`)) return;
    await fetch(`/api/v1/admin/promo-codes/${code.id}`, { method: "DELETE" });
    fetchCodes();
  };

  const handleClone = async () => {
    if (!cloneSourceId || !cloneCode) return;
    setSubmitting(true);
    try {
      await fetch(`/api/v1/admin/promo-codes/${cloneSourceId}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: cloneCode }),
      });
      setCloneDialogOpen(false);
      setCloneCode("");
      setCloneSourceId(null);
      fetchCodes();
    } finally {
      setSubmitting(false);
    }
  };

  const bulkToggle = async (active: boolean) => {
    for (const id of selectedIds) {
      await fetch(`/api/v1/admin/promo-codes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
    }
    setSelectedIds(new Set());
    fetchCodes();
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
  };

  // Live preview helpers
  const previewDiscountText = () => {
    const amt = parseInt(form.discountAmount) || 0;
    if (form.discountType === "percent") return `${amt}% off`;
    return `$${(amt / 100).toFixed(2)} off`;
  };

  const previewDurationText = () => {
    if (form.duration === "once") return "once";
    if (form.duration === "forever") return "forever";
    return `for ${form.durationInMonths || "?"} months`;
  };

  const previewPriceExample = () => {
    const amt = parseInt(form.discountAmount) || 0;
    const basePrice = 2000; // Pro plan $20
    let discounted: number;
    if (form.discountType === "percent") {
      discounted = basePrice - Math.round(basePrice * (amt / 100));
    } else {
      discounted = Math.max(0, basePrice - amt);
    }
    const base = `$${(basePrice / 100).toFixed(2)}/mo`;
    const disc = `$${(discounted / 100).toFixed(2)}/mo`;
    if (form.duration === "once") return `Pro plan: ~${base}~ → ${disc} for first month, then ${base}`;
    if (form.duration === "forever") return `Pro plan: ~${base}~ → ${disc}`;
    return `Pro plan: ~${base}~ → ${disc} for ${form.durationInMonths || "?"} months, then ${base}`;
  };

  return (
    <div>
      {/* Stats Grid */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Ticket} label="Total Codes" value={stats.totalCodes} />
        <StatCard icon={CheckCircle} label="Active Codes" value={stats.activeCodes} />
        <StatCard icon={Hash} label="Total Redemptions" value={stats.totalRedemptions} />
        <StatCard icon={DollarSign} label="Total Discount Given" value={formatCents(stats.totalDiscountGiven)} />
      </div>

      {/* Filters Bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--landing-text-tertiary)]" />
          <Input
            placeholder="Search by code or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 border-[var(--landing-border)] bg-[var(--landing-surface)]"
          />
        </div>
        <Select value={filterCampaign} onValueChange={setFilterCampaign}>
          <SelectTrigger className="w-[160px] border-[var(--landing-border)] bg-[var(--landing-surface)]">
            <SelectValue placeholder="Campaign" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Campaigns</SelectItem>
            {campaigns.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px] border-[var(--landing-border)] bg-[var(--landing-surface)]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="maxed">Maxed</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterDiscountType} onValueChange={setFilterDiscountType}>
          <SelectTrigger className="w-[150px] border-[var(--landing-border)] bg-[var(--landing-surface)]">
            <SelectValue placeholder="Discount Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="percent">Percentage</SelectItem>
            <SelectItem value="fixed">Fixed Amount</SelectItem>
          </SelectContent>
        </Select>
        <Button
          onClick={openCreate}
          className="bg-[#F97316] text-white hover:bg-[#EA580C]"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Code
        </Button>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] p-3">
          <span className="text-sm text-[var(--landing-text-secondary)]">
            {selectedIds.size} selected
          </span>
          <Button size="sm" variant="outline" onClick={() => bulkToggle(true)} className="border-[var(--landing-border)]">
            Activate
          </Button>
          <Button size="sm" variant="outline" onClick={() => bulkToggle(false)} className="border-[var(--landing-border)]">
            Deactivate
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Codes Table */}
      <div className="dash-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-[var(--landing-border)] bg-[var(--landing-code-bg)] hover:bg-[var(--landing-code-bg)]">
              <TableHead className="w-10">
                <Checkbox
                  checked={selectedIds.size > 0 && selectedIds.size === filteredCodes.length}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedIds(new Set(filteredCodes.map((c) => c.id)));
                    } else {
                      setSelectedIds(new Set());
                    }
                  }}
                />
              </TableHead>
              <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">Code</TableHead>
              <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">Discount</TableHead>
              <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">Duration</TableHead>
              <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">Plans</TableHead>
              <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">Orgs</TableHead>
              <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">Redeemed</TableHead>
              <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">Status</TableHead>
              <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="border-[var(--landing-border)]">
                <TableCell colSpan={9} className="py-8 text-center font-mono text-sm text-[var(--landing-text-tertiary)]">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredCodes.length === 0 ? (
              <TableRow className="border-[var(--landing-border)]">
                <TableCell colSpan={9} className="py-8 text-center font-mono text-sm text-[var(--landing-text-tertiary)]">
                  No promo codes found
                </TableCell>
              </TableRow>
            ) : (
              filteredCodes.map((code) => {
                const status = getStatus(code);
                const plans = code.applicablePlans ? JSON.parse(code.applicablePlans) as string[] : null;
                const orgs = code.restrictedToOrgs ? JSON.parse(code.restrictedToOrgs) as string[] : null;
                return (
                  <TableRow key={code.id} className="border-[var(--landing-border)]">
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(code.id)}
                        onCheckedChange={(checked) => {
                          const next = new Set(selectedIds);
                          if (checked) next.add(code.id);
                          else next.delete(code.id);
                          setSelectedIds(next);
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => copyCode(code.code)}
                        className="font-mono text-sm font-medium text-[var(--landing-text)] transition-colors hover:text-[#F97316]"
                        title="Click to copy"
                      >
                        {code.code}
                      </button>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-[var(--landing-text-secondary)]">
                      {formatDiscount(code)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-[var(--landing-text-secondary)]">
                      {formatDuration(code)}
                    </TableCell>
                    <TableCell>
                      {plans ? (
                        <div className="flex flex-wrap gap-1">
                          {plans.map((p) => (
                            <span key={p} className="inline-flex rounded-full bg-[#F97316]/10 px-2 py-0.5 font-mono text-[10px] font-medium capitalize text-[#F97316]">
                              {p}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="font-mono text-xs text-[var(--landing-text-tertiary)]">All</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {orgs ? (
                        <span className="inline-flex rounded-full bg-blue-500/10 px-2 py-0.5 font-mono text-[10px] font-medium text-blue-500">
                          {orgs.length} org{orgs.length !== 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="font-mono text-xs text-[var(--landing-text-tertiary)]">All</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-[var(--landing-text-secondary)]">
                      {code.timesRedeemed} / {code.maxRedemptions ?? "\u221E"}
                    </TableCell>
                    <TableCell>{statusBadge(status)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openDetail(code)}>
                            <Eye className="mr-2 h-4 w-4" /> View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(code)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setCloneSourceId(code.id);
                            setCloneCode("");
                            setCloneDialogOpen(true);
                          }}>
                            <Copy className="mr-2 h-4 w-4" /> Clone
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleActive(code)}>
                            <Power className="mr-2 h-4 w-4" />
                            {code.active ? "Deactivate" : "Activate"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => deleteCode(code)} className="text-red-500 focus:text-red-500">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono">
              {editingId ? "Edit Promo Code" : "Create Promo Code"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* Left: Form */}
            <div className="space-y-6">
              {/* Code */}
              {!editingId && (
                <div className="space-y-2">
                  <Label className="font-mono text-xs">Code</Label>
                  <div className="flex gap-2">
                    <Input
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "") })}
                      placeholder="LAUNCH50"
                      className="font-mono border-[var(--landing-border)]"
                      disabled={showBulk}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setForm({ ...form, code: generateRandomCode() })}
                      className="shrink-0 border-[var(--landing-border)]"
                      disabled={showBulk}
                    >
                      <Shuffle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Description */}
              <div className="space-y-2">
                <Label className="font-mono text-xs">Description (internal)</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Partner deal with Acme Corp"
                  className="border-[var(--landing-border)]"
                  rows={2}
                />
              </div>

              {/* Campaign */}
              <div className="space-y-2">
                <Label className="font-mono text-xs">Campaign</Label>
                <Input
                  value={form.campaign}
                  onChange={(e) => setForm({ ...form, campaign: e.target.value })}
                  placeholder="launch-2026"
                  className="border-[var(--landing-border)]"
                  list="campaign-list"
                />
                <datalist id="campaign-list">
                  {campaigns.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              {/* Discount */}
              <div className="space-y-3">
                <Label className="font-mono text-xs">Discount</Label>
                <div className="flex gap-3">
                  <Select
                    value={form.discountType}
                    onValueChange={(v) => setForm({ ...form, discountType: v as "percent" | "fixed" })}
                    disabled={!!editingId}
                  >
                    <SelectTrigger className="w-[140px] border-[var(--landing-border)]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Percentage</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--landing-text-tertiary)]">
                      {form.discountType === "percent" ? "%" : "$"}
                    </span>
                    <Input
                      type="number"
                      value={form.discountAmount}
                      onChange={(e) => setForm({ ...form, discountAmount: e.target.value })}
                      placeholder={form.discountType === "percent" ? "50" : "500"}
                      className="pl-8 border-[var(--landing-border)]"
                      disabled={!!editingId}
                    />
                  </div>
                  {form.discountType === "fixed" && (
                    <Select
                      value={form.currency}
                      onValueChange={(v) => setForm({ ...form, currency: v })}
                      disabled={!!editingId}
                    >
                      <SelectTrigger className="w-[100px] border-[var(--landing-border)]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="usd">USD</SelectItem>
                        <SelectItem value="eur">EUR</SelectItem>
                        <SelectItem value="gbp">GBP</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              {/* Duration */}
              <div className="space-y-3">
                <Label className="font-mono text-xs">Duration</Label>
                <div className="flex gap-3">
                  <Select
                    value={form.duration}
                    onValueChange={(v) => setForm({ ...form, duration: v as "once" | "repeating" | "forever" })}
                    disabled={!!editingId}
                  >
                    <SelectTrigger className="w-[140px] border-[var(--landing-border)]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="once">Once</SelectItem>
                      <SelectItem value="repeating">Repeating</SelectItem>
                      <SelectItem value="forever">Forever</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.duration === "repeating" && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={36}
                        value={form.durationInMonths}
                        onChange={(e) => setForm({ ...form, durationInMonths: e.target.value })}
                        className="w-20 border-[var(--landing-border)]"
                        disabled={!!editingId}
                      />
                      <span className="text-sm text-[var(--landing-text-secondary)]">months</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Restrictions */}
              <div className="space-y-4">
                <Label className="font-mono text-xs">Restrictions</Label>

                {/* Applicable plans */}
                <div className="space-y-2">
                  <span className="text-xs text-[var(--landing-text-secondary)]">Applicable Plans</span>
                  <div className="flex flex-wrap gap-3">
                    {PLAN_OPTIONS.map((plan) => (
                      <label key={plan} className="flex items-center gap-2">
                        <Checkbox
                          checked={form.applicablePlans.includes(plan)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setForm({ ...form, applicablePlans: [...form.applicablePlans, plan] });
                            } else {
                              setForm({ ...form, applicablePlans: form.applicablePlans.filter((p) => p !== plan) });
                            }
                          }}
                        />
                        <span className="text-sm capitalize text-[var(--landing-text)]">{plan}</span>
                      </label>
                    ))}
                  </div>
                  {form.applicablePlans.length === 0 && (
                    <p className="text-[11px] text-[var(--landing-text-tertiary)]">No selection = all plans</p>
                  )}
                </div>

                {/* Minimum plan tier */}
                <div className="space-y-2">
                  <span className="text-xs text-[var(--landing-text-secondary)]">Minimum Plan Tier</span>
                  <Select value={form.minimumPlanTier} onValueChange={(v) => setForm({ ...form, minimumPlanTier: v === "none" ? "" : v })}>
                    <SelectTrigger className="w-[160px] border-[var(--landing-border)]">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      {PLAN_TIER_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value || "none"} value={opt.value || "none"}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Restricted to orgs */}
                <div className="space-y-2">
                  <span className="text-xs text-[var(--landing-text-secondary)]">Restricted to Organizations</span>
                  <Select
                    value=""
                    onValueChange={(v) => {
                      if (v && !form.restrictedToOrgs.includes(v)) {
                        setForm({ ...form, restrictedToOrgs: [...form.restrictedToOrgs, v] });
                      }
                    }}
                  >
                    <SelectTrigger className="border-[var(--landing-border)]">
                      <SelectValue placeholder="Add organization..." />
                    </SelectTrigger>
                    <SelectContent>
                      {orgList
                        .filter((o) => !form.restrictedToOrgs.includes(o.id))
                        .map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.name} ({org.slug})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {form.restrictedToOrgs.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {form.restrictedToOrgs.map((orgId) => {
                        const org = orgList.find((o) => o.id === orgId);
                        return (
                          <span key={orgId} className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] text-blue-500">
                            {org?.name ?? orgId}
                            <button onClick={() => setForm({ ...form, restrictedToOrgs: form.restrictedToOrgs.filter((id) => id !== orgId) })}>
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Max redemptions */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-xs text-[var(--landing-text-secondary)]">Max Total Redemptions</span>
                    <Input
                      type="number"
                      value={form.maxRedemptions}
                      onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })}
                      placeholder="Unlimited"
                      className="border-[var(--landing-border)]"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-[var(--landing-text-secondary)]">Max Per Org</span>
                    <Input
                      type="number"
                      value={form.maxRedemptionsPerOrg}
                      onChange={(e) => setForm({ ...form, maxRedemptionsPerOrg: e.target.value })}
                      className="border-[var(--landing-border)]"
                    />
                  </div>
                </div>

                {/* Boolean toggles */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--landing-text)]">First subscription only</span>
                    <Switch
                      checked={form.firstSubscriptionOnly}
                      onCheckedChange={(v) => setForm({ ...form, firstSubscriptionOnly: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--landing-text)]">No previous promo</span>
                    <Switch
                      checked={form.noPreviousPromo}
                      onCheckedChange={(v) => setForm({ ...form, noPreviousPromo: v })}
                    />
                  </div>
                </div>
              </div>

              {/* Scheduling */}
              <div className="space-y-3">
                <Label className="font-mono text-xs">Scheduling</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-xs text-[var(--landing-text-secondary)]">Starts At</span>
                    <Input
                      type="datetime-local"
                      value={form.startsAt}
                      onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                      className="border-[var(--landing-border)]"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-[var(--landing-text-secondary)]">Expires At</span>
                    <Input
                      type="datetime-local"
                      value={form.expiresAt}
                      onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                      className="border-[var(--landing-border)]"
                    />
                  </div>
                </div>
              </div>

              {/* Bulk generation */}
              {!editingId && (
                <div className="space-y-3">
                  <button
                    onClick={() => setShowBulk(!showBulk)}
                    className="flex items-center gap-2 text-sm text-[var(--landing-text-secondary)] hover:text-[var(--landing-text)]"
                  >
                    <ChevronDown className={`h-4 w-4 transition-transform ${showBulk ? "rotate-180" : ""}`} />
                    Bulk Generation
                  </button>
                  {showBulk && (
                    <div className="grid grid-cols-2 gap-3 rounded-lg border border-[var(--landing-border)] p-3">
                      <div className="space-y-1">
                        <span className="text-xs text-[var(--landing-text-secondary)]">Prefix</span>
                        <Input
                          value={form.bulkPrefix}
                          onChange={(e) => setForm({ ...form, bulkPrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "") })}
                          placeholder="BETA"
                          className="font-mono border-[var(--landing-border)]"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-[var(--landing-text-secondary)]">Count (2-100)</span>
                        <Input
                          type="number"
                          min={2}
                          max={100}
                          value={form.bulkCount}
                          onChange={(e) => setForm({ ...form, bulkCount: e.target.value })}
                          className="border-[var(--landing-border)]"
                        />
                      </div>
                      <p className="col-span-2 text-[11px] text-[var(--landing-text-tertiary)]">
                        Will generate {form.bulkPrefix || "PREFIX"}001 through {form.bulkPrefix || "PREFIX"}{String(parseInt(form.bulkCount) || 10).padStart(3, "0")}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <Button
                onClick={handleSubmit}
                disabled={submitting || (!editingId && !showBulk && !form.code) || !form.discountAmount}
                className="w-full bg-[#F97316] text-white hover:bg-[#EA580C]"
              >
                {submitting ? "..." : editingId ? "Save Changes" : showBulk ? "Generate Codes" : "Create Code"}
              </Button>
            </div>

            {/* Right: Live Preview */}
            <div className="space-y-4">
              <Label className="font-mono text-xs">Live Preview</Label>
              <div className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-6">
                {/* Preview badge */}
                <div className="mb-4">
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5 font-mono text-sm font-medium text-emerald-500">
                    <Ticket className="h-4 w-4" />
                    {previewDiscountText()} {previewDurationText()}
                  </span>
                </div>

                {/* Preview price calculation */}
                <div className="mb-4 rounded-lg bg-[var(--landing-code-bg)] p-4">
                  <p className="font-mono text-xs text-[var(--landing-text-secondary)]">
                    {previewPriceExample()}
                  </p>
                </div>

                {/* Preview code */}
                <div className="mb-4">
                  <p className="font-mono text-lg font-bold text-[var(--landing-text)]">
                    {showBulk ? `${form.bulkPrefix || "PREFIX"}001` : form.code || "CODE"}
                  </p>
                </div>

                {/* Restriction pills */}
                <div className="flex flex-wrap gap-2">
                  {form.applicablePlans.length > 0 && (
                    <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-500">
                      {form.applicablePlans.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(", ")} only
                    </span>
                  )}
                  {form.minimumPlanTier && (
                    <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-500">
                      {form.minimumPlanTier.charAt(0).toUpperCase() + form.minimumPlanTier.slice(1)}+ only
                    </span>
                  )}
                  {form.firstSubscriptionOnly && (
                    <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-500">
                      First purchase only
                    </span>
                  )}
                  {form.noPreviousPromo && (
                    <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-500">
                      No previous promos
                    </span>
                  )}
                  {form.restrictedToOrgs.length > 0 && (
                    <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-500">
                      {form.restrictedToOrgs.length} specific org{form.restrictedToOrgs.length !== 1 ? "s" : ""}
                    </span>
                  )}
                  {form.maxRedemptions && (
                    <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-500">
                      Max {form.maxRedemptions} uses
                    </span>
                  )}
                  {form.expiresAt && (
                    <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-500">
                      Expires {new Date(form.expiresAt).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {/* Status indicator */}
                <div className="mt-4 border-t border-[var(--landing-border)] pt-4">
                  {form.startsAt && new Date(form.startsAt).getTime() > Date.now() ? (
                    <span className="flex items-center gap-2 text-xs text-blue-500">
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                      Scheduled: starts {new Date(form.startsAt).toLocaleDateString()}
                    </span>
                  ) : form.expiresAt && new Date(form.expiresAt).getTime() < Date.now() ? (
                    <span className="flex items-center gap-2 text-xs text-red-500">
                      <span className="h-2 w-2 rounded-full bg-red-500" />
                      Expired
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-xs text-emerald-500">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Active now
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Clone Dialog */}
      <Dialog open={cloneDialogOpen} onOpenChange={setCloneDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono">Clone Promo Code</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="font-mono text-xs">New Code</Label>
              <Input
                value={cloneCode}
                onChange={(e) => setCloneCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
                placeholder="NEW-CODE"
                className="font-mono border-[var(--landing-border)]"
              />
            </div>
            <Button
              onClick={handleClone}
              disabled={submitting || !cloneCode}
              className="w-full bg-[#F97316] text-white hover:bg-[#EA580C]"
            >
              {submitting ? "..." : "Clone"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-[500px] overflow-y-auto sm:max-w-[500px]">
          <SheetHeader>
            <SheetTitle className="font-mono">{detailCode?.code}</SheetTitle>
          </SheetHeader>
          {detailCode && (
            <div className="mt-6 space-y-6">
              {/* Preview card */}
              <div className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-4">
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5 font-mono text-sm font-medium text-emerald-500">
                  <Ticket className="h-4 w-4" />
                  {formatDiscount(detailCode)} {formatDuration(detailCode)}
                </span>
                <div className="mt-3">
                  {statusBadge(getStatus(detailCode))}
                </div>
              </div>

              {/* Settings summary */}
              <div className="space-y-3">
                <h4 className="font-mono text-xs uppercase tracking-wider text-[var(--landing-text-tertiary)]">Settings</h4>
                <dl className="space-y-2 text-sm">
                  {detailCode.description && (
                    <div><dt className="text-[var(--landing-text-tertiary)]">Description</dt><dd className="text-[var(--landing-text)]">{detailCode.description}</dd></div>
                  )}
                  {detailCode.campaign && (
                    <div><dt className="text-[var(--landing-text-tertiary)]">Campaign</dt><dd className="text-[var(--landing-text)]">{detailCode.campaign}</dd></div>
                  )}
                  <div><dt className="text-[var(--landing-text-tertiary)]">Redeemed</dt><dd className="text-[var(--landing-text)]">{detailCode.timesRedeemed} / {detailCode.maxRedemptions ?? "\u221E"}</dd></div>
                  <div><dt className="text-[var(--landing-text-tertiary)]">Total Discount</dt><dd className="text-[var(--landing-text)]">{formatCents(detailCode.totalDiscountGiven)}</dd></div>
                  <div><dt className="text-[var(--landing-text-tertiary)]">Per Org Limit</dt><dd className="text-[var(--landing-text)]">{detailCode.maxRedemptionsPerOrg ?? 1}</dd></div>
                  {detailCode.firstSubscriptionOnly && (
                    <div><dt className="text-[var(--landing-text-tertiary)]">First Subscription Only</dt><dd className="text-emerald-500">Yes</dd></div>
                  )}
                  {detailCode.noPreviousPromo && (
                    <div><dt className="text-[var(--landing-text-tertiary)]">No Previous Promo</dt><dd className="text-emerald-500">Yes</dd></div>
                  )}
                  {detailCode.startsAt && (
                    <div><dt className="text-[var(--landing-text-tertiary)]">Starts At</dt><dd className="text-[var(--landing-text)]">{new Date(detailCode.startsAt).toLocaleString()}</dd></div>
                  )}
                  {detailCode.expiresAt && (
                    <div><dt className="text-[var(--landing-text-tertiary)]">Expires At</dt><dd className="text-[var(--landing-text)]">{new Date(detailCode.expiresAt).toLocaleString()}</dd></div>
                  )}
                </dl>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setDetailOpen(false); openEdit(detailCode); }} className="border-[var(--landing-border)]">
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </Button>
                <Button size="sm" variant="outline" onClick={() => {
                  setDetailOpen(false);
                  setCloneSourceId(detailCode.id);
                  setCloneCode("");
                  setCloneDialogOpen(true);
                }} className="border-[var(--landing-border)]">
                  <Copy className="mr-2 h-4 w-4" /> Clone
                </Button>
                <Button size="sm" variant="outline" onClick={() => { deleteCode(detailCode); setDetailOpen(false); }} className="border-red-500/20 text-red-500 hover:bg-red-500/10">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </Button>
              </div>

              {/* Redemption history */}
              <div>
                <h4 className="font-mono text-xs uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Redemption History ({detailRedemptions.length})
                </h4>
                {detailRedemptions.length === 0 ? (
                  <p className="mt-3 text-sm text-[var(--landing-text-tertiary)]">No redemptions yet</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {detailRedemptions.map((r) => (
                      <div key={r.id} className="flex items-center justify-between rounded-lg border border-[var(--landing-border)] p-3">
                        <div>
                          <p className="text-sm font-medium text-[var(--landing-text)]">{r.orgName ?? "Unknown Org"}</p>
                          <p className="text-xs text-[var(--landing-text-tertiary)]">{r.userName} &middot; {r.planId}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-sm font-medium text-[var(--landing-text)]">{formatCents(r.discountApplied)}</p>
                          <p className="text-xs text-[var(--landing-text-tertiary)]">{new Date(r.redeemedAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
