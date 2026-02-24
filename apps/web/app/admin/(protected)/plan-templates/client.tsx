"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlanTemplateForm } from "@/components/admin/plan-template-form";
import { Search } from "lucide-react";
import { toast } from "sonner";

interface Template {
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
  isArchived: boolean | null;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
}

export function PlanTemplatesClient({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);
  const [archiving, setArchiving] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    if (!searchQuery) return templates;
    const q = searchQuery.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q)),
    );
  }, [templates, searchQuery]);

  async function handleArchive(id: string) {
    setArchiving(id);
    try {
      const res = await fetch(`/api/v1/admin/plan-templates/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to archive");
        return;
      }
      router.refresh();
    } finally {
      setArchiving(null);
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--landing-text-tertiary)]" />
          <Input
            placeholder="Search name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          className="bg-[#F97316] font-mono hover:bg-[#F97316]/80"
          onClick={() => {
            setEditTemplate(null);
            setShowForm(true);
          }}
        >
          New Template
        </Button>
      </div>

      <div className="dash-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-[var(--landing-border)] bg-[var(--landing-code-bg)] hover:bg-[var(--landing-code-bg)]">
                <TableHead className="font-mono text-[11px] tracking-wider text-[var(--landing-text-tertiary)] uppercase">
                  Name
                </TableHead>
                <TableHead className="font-mono text-[11px] tracking-wider text-[var(--landing-text-tertiary)] uppercase">
                  Base Plan
                </TableHead>
                <TableHead className="hidden font-mono text-[11px] tracking-wider text-[var(--landing-text-tertiary)] uppercase sm:table-cell">
                  Limits
                </TableHead>
                <TableHead className="hidden font-mono text-[11px] tracking-wider text-[var(--landing-text-tertiary)] uppercase md:table-cell">
                  Price
                </TableHead>
                <TableHead className="font-mono text-[11px] tracking-wider text-[var(--landing-text-tertiary)] uppercase">
                  Usage
                </TableHead>
                <TableHead className="font-mono text-[11px] tracking-wider text-[var(--landing-text-tertiary)] uppercase">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow className="border-[var(--landing-border)]">
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center font-mono text-sm text-[var(--landing-text-tertiary)]"
                  >
                    {searchQuery
                      ? "No templates match your search"
                      : "No templates yet"}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((t) => (
                  <TableRow
                    key={t.id}
                    className="border-[var(--landing-border)]"
                  >
                    <TableCell>
                      <p className="text-sm font-medium text-[var(--landing-text)]">
                        {t.name}
                      </p>
                      {t.description && (
                        <p className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">
                          {t.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex rounded-full bg-[var(--landing-surface-2)] px-2 py-0.5 font-mono text-[11px] text-[var(--landing-text-secondary)] capitalize">
                        {t.basePlanId}
                      </span>
                    </TableCell>
                    <TableCell className="hidden font-mono text-[10px] text-[var(--landing-text-tertiary)] sm:table-cell">
                      {t.projectLimit}p / {t.memberLimit}m /{" "}
                      {t.apiRatePerMinute}rpm
                    </TableCell>
                    <TableCell className="hidden font-mono text-[11px] text-[var(--landing-text-secondary)] md:table-cell">
                      {t.stripePriceInCents
                        ? `$${(t.stripePriceInCents / 100).toLocaleString()}/mo`
                        : "N/A"}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-[var(--landing-text-secondary)]">
                      {t.usageCount} org{t.usageCount !== 1 ? "s" : ""}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="font-mono"
                          onClick={() => {
                            setEditTemplate(t);
                            setShowForm(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-500/30 font-mono text-red-500 hover:bg-red-500/10"
                          onClick={() => handleArchive(t.id)}
                          disabled={archiving === t.id}
                        >
                          Archive
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <PlanTemplateForm
        open={showForm}
        onOpenChange={setShowForm}
        template={editTemplate}
      />
    </>
  );
}
