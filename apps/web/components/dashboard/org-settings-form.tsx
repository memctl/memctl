"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

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
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Organization Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Label>Slug</Label>
            <Input value={orgSlug} disabled />
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              Cannot be changed
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Business Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="font-mono text-xs text-muted-foreground">
            Optional. For tax-deductible purchases and proper invoicing.
          </p>
          <div>
            <Label>Company Name</Label>
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Inc."
            />
          </div>
          <div>
            <Label>VAT / Tax ID</Label>
            <Input
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              placeholder="EU123456789"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
