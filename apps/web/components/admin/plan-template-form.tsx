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
import { PLAN_IDS } from "@memctl/shared/constants";
import { toast } from "sonner";

const selectPopoverCls =
  "bg-[var(--landing-surface)] border-[var(--landing-border)] text-[var(--landing-text)] shadow-xl";
const selectItemCls =
  "font-mono text-[11px] text-[var(--landing-text-secondary)] focus:bg-[var(--landing-surface-2)] focus:text-[var(--landing-text)]";
const dialogCls =
  "bg-[var(--landing-surface)] border-[var(--landing-border)] text-[var(--landing-text)] shadow-xl";

interface PlanTemplateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: {
    id: string;
    name: string;
    description: string | null;
    basePlanId: string;
    projectLimit: number;
    memberLimit: number;
    memoryLimitPerProject: number;
    memoryLimitOrg: number;
    apiRatePerMinute: number;
    stripePriceInCents: number | null;
  } | null;
}

export function PlanTemplateForm({
  open,
  onOpenChange,
  template,
}: PlanTemplateFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [basePlanId, setBasePlanId] = useState(template?.basePlanId ?? "enterprise");
  const [projectLimit, setProjectLimit] = useState(String(template?.projectLimit ?? 100));
  const [memberLimit, setMemberLimit] = useState(String(template?.memberLimit ?? 50));
  const [memoryLimitPerProject, setMemoryLimitPerProject] = useState(
    String(template?.memoryLimitPerProject ?? 10000),
  );
  const [memoryLimitOrg, setMemoryLimitOrg] = useState(
    String(template?.memoryLimitOrg ?? 500000),
  );
  const [apiRatePerMinute, setApiRatePerMinute] = useState(
    String(template?.apiRatePerMinute ?? 3000),
  );
  const [priceDollars, setPriceDollars] = useState(
    template?.stripePriceInCents ? String(template.stripePriceInCents / 100) : "",
  );

  async function handleSubmit() {
    setLoading(true);
    try {
      const body = {
        name,
        description: description || undefined,
        basePlanId,
        projectLimit: Number(projectLimit),
        memberLimit: Number(memberLimit),
        memoryLimitPerProject: Number(memoryLimitPerProject),
        memoryLimitOrg: Number(memoryLimitOrg),
        apiRatePerMinute: Number(apiRatePerMinute),
        stripePriceInCents: priceDollars ? Math.round(Number(priceDollars) * 100) : null,
      };

      const url = template
        ? `/api/v1/admin/plan-templates/${template.id}`
        : "/api/v1/admin/plan-templates";
      const method = template ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to save template");
        return;
      }

      onOpenChange(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${dialogCls} max-w-md`}>
        <DialogHeader>
          <DialogTitle className="font-mono text-sm text-[var(--landing-text)]">
            {template ? "Edit Template" : "New Template"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="block mb-1 font-mono text-[10px] text-[var(--landing-text-tertiary)]">
              Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 font-mono text-[11px]"
              placeholder="Enterprise Standard"
            />
          </div>
          <div>
            <label className="block mb-1 font-mono text-[10px] text-[var(--landing-text-tertiary)]">
              Description
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="font-mono text-[11px] resize-none"
              placeholder="Optional description"
            />
          </div>
          <div>
            <label className="block mb-1 font-mono text-[10px] text-[var(--landing-text-tertiary)]">
              Base plan
            </label>
            <Select value={basePlanId} onValueChange={setBasePlanId}>
              <SelectTrigger className="h-8 font-mono text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={selectPopoverCls}>
                {PLAN_IDS.map((id) => (
                  <SelectItem key={id} value={id} className={selectItemCls}>
                    {id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block mb-1 font-mono text-[10px] text-[var(--landing-text-tertiary)]">
                Project limit
              </label>
              <Input
                type="number"
                min={1}
                value={projectLimit}
                onChange={(e) => setProjectLimit(e.target.value)}
                className="h-8 font-mono text-[11px]"
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
                onChange={(e) => setMemberLimit(e.target.value)}
                className="h-8 font-mono text-[11px]"
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
                className="h-8 font-mono text-[11px]"
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
                className="h-8 font-mono text-[11px]"
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
                className="h-8 font-mono text-[11px]"
              />
            </div>
            <div>
              <label className="block mb-1 font-mono text-[10px] text-[var(--landing-text-tertiary)]">
                Price ($/mo)
              </label>
              <Input
                type="number"
                min={0}
                value={priceDollars}
                onChange={(e) => setPriceDollars(e.target.value)}
                placeholder="Optional"
                className="h-8 font-mono text-[11px]"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            className="h-8 font-mono text-[11px]"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-8 font-mono text-[11px] bg-[#F97316] hover:bg-[#F97316]/80"
            onClick={handleSubmit}
            disabled={loading || !name.trim()}
          >
            {template ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
