"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface OrgSettingsFormProps {
  orgSlug: string;
  initialName: string;
  initialCompanyName: string;
  initialTaxId: string;
}

export function OrgSettingsForm({
  orgSlug,
  initialName,
  initialCompanyName,
  initialTaxId,
}: OrgSettingsFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [companyName, setCompanyName] = useState(initialCompanyName);
  const [taxId, setTaxId] = useState(initialTaxId);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/v1/orgs/${orgSlug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, companyName, taxId }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* General */}
      <div className="dash-card glass-border relative p-6">
        <h2 className="mb-4 font-mono text-sm font-bold text-[var(--landing-text)]">
          General
        </h2>
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-[var(--landing-text-secondary)]">
              Organization Name
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 border-[var(--landing-border)] bg-[var(--landing-surface)] text-[var(--landing-text)] focus:border-[#F97316] focus:ring-[#F97316]"
            />
          </div>
          <div>
            <Label className="text-xs text-[var(--landing-text-secondary)]">
              Slug
            </Label>
            <Input
              value={orgSlug}
              disabled
              className="mt-1 border-[var(--landing-border)] bg-[var(--landing-surface-2)] font-mono text-[var(--landing-text-tertiary)]"
            />
            <p className="mt-1 font-mono text-[11px] text-[var(--landing-text-tertiary)]">
              Cannot be changed
            </p>
          </div>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#F97316] text-white hover:bg-[#FB923C]"
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Business Details */}
      <div className="dash-card glass-border relative p-6">
        <h2 className="mb-2 font-mono text-sm font-bold text-[var(--landing-text)]">
          Business Details
        </h2>
        <p className="mb-4 text-xs text-[var(--landing-text-tertiary)]">
          Optional. For tax-deductible purchases and proper invoicing.
        </p>
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-[var(--landing-text-secondary)]">
              Company Name
            </Label>
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Inc."
              className="mt-1 border-[var(--landing-border)] bg-[var(--landing-surface)] text-[var(--landing-text)] focus:border-[#F97316] focus:ring-[#F97316]"
            />
          </div>
          <div>
            <Label className="text-xs text-[var(--landing-text-secondary)]">
              VAT / Tax ID
            </Label>
            <Input
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              placeholder="EU123456789"
              className="mt-1 border-[var(--landing-border)] bg-[var(--landing-surface)] text-[var(--landing-text)] focus:border-[#F97316] focus:ring-[#F97316]"
            />
          </div>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#F97316] text-white hover:bg-[#FB923C]"
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
