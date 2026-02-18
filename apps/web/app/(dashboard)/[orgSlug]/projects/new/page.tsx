"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/dashboard/shared/page-header";

export default function NewProjectPage() {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const slugify = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const handleCreate = async () => {
    if (!name || !slug) {
      setError("Name and slug are required");
      return;
    }
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/v1/projects?org=${orgSlug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          description: description || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Something went wrong");
        setSaving(false);
        return;
      }

      router.push(`/${orgSlug}/projects/${slug}`);
    } catch {
      setError("Something went wrong");
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md">
      <PageHeader badge="New" title="New Project" />

      <div className="dash-card glass-border relative p-6">
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-[var(--landing-text-secondary)]">
              Project Name
            </Label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSlug(slugify(e.target.value));
              }}
              placeholder="My App"
              className="mt-1 border-[var(--landing-border)] bg-[var(--landing-surface)] text-[var(--landing-text)] focus:border-[#F97316] focus:ring-[#F97316]"
            />
          </div>
          <div>
            <Label className="text-xs text-[var(--landing-text-secondary)]">
              Slug
            </Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              placeholder="my-app"
              className="mt-1 border-[var(--landing-border)] bg-[var(--landing-surface)] font-mono text-[var(--landing-text)] focus:border-[#F97316] focus:ring-[#F97316]"
            />
            <p className="mt-1 font-mono text-[11px] text-[var(--landing-text-tertiary)]">
              Used in MCP config as MEMCTL_PROJECT
            </p>
          </div>
          <div>
            <Label className="text-xs text-[var(--landing-text-secondary)]">
              Description (optional)
            </Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project about?"
              className="mt-1 border-[var(--landing-border)] bg-[var(--landing-surface)] text-[var(--landing-text)] focus:border-[#F97316] focus:ring-[#F97316]"
            />
          </div>
          {error && (
            <p className="font-mono text-xs text-red-500">{error}</p>
          )}
          <Button
            onClick={handleCreate}
            disabled={saving || !name || !slug}
            className="w-full bg-[#F97316] text-white hover:bg-[#FB923C]"
          >
            {saving ? "Creating..." : "Create Project"}
          </Button>
        </div>
      </div>
    </div>
  );
}
