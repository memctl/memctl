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
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-[var(--landing-text)]">
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
              className="mt-1.5 border-[var(--landing-border)] bg-[var(--landing-bg)] text-[var(--landing-text)]"
            />
          </div>
          <div>
            <Label className="text-xs text-[var(--landing-text-secondary)]">
              Slug
            </Label>
            <Input
              value={orgSlug}
              disabled
              className="mt-1.5 border-[var(--landing-border)] bg-[var(--landing-surface-2)] text-[var(--landing-text-tertiary)]"
            />
            <p className="mt-1 text-xs text-[var(--landing-text-tertiary)]">
              Cannot be changed
            </p>
          </div>
        </div>
      </section>

      <div className="border-t border-[var(--landing-border)]" />

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-medium text-[var(--landing-text)]">
            Business Details
          </h2>
          <p className="mt-0.5 text-xs text-[var(--landing-text-tertiary)]">
            For tax-deductible purchases and invoicing.
          </p>
        </div>
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-[var(--landing-text-secondary)]">
              Company Name
            </Label>
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Inc."
              className="mt-1.5 border-[var(--landing-border)] bg-[var(--landing-bg)] text-[var(--landing-text)]"
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
              className="mt-1.5 border-[var(--landing-border)] bg-[var(--landing-bg)] text-[var(--landing-text)]"
            />
          </div>
        </div>
      </section>

      <Button
        onClick={handleSave}
        disabled={saving}
        className="bg-[#F97316] text-white hover:bg-[#EA580C]"
      >
        {saving ? "Saving..." : "Save changes"}
      </Button>
    </div>
  );
}
