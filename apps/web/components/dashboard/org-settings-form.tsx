"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface OrgSettingsFormProps {
  orgSlug: string;
  initialName: string;
}

export function OrgSettingsForm({
  orgSlug,
  initialName,
}: OrgSettingsFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/orgs/${orgSlug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to save settings");
      } else {
        toast.success("Settings saved");
        router.refresh();
      }
    } catch {
      toast.error("Network error");
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
      <Button
        onClick={handleSave}
        disabled={saving}
        className="bg-[#F97316] text-white hover:bg-[#EA580C]"
      >
        {saving ? (
          <>
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            Saving...
          </>
        ) : (
          "Save changes"
        )}
      </Button>
    </div>
  );
}
