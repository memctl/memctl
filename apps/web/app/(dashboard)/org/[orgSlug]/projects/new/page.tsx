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

      router.push(`/org/${orgSlug}/projects/${slug}`);
    } catch {
      setError("Something went wrong");
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md">
      <PageHeader title="New project" />

      <div className="space-y-4">
        <div>
          <Label className="text-xs text-[var(--landing-text-secondary)]">
            Project name
          </Label>
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSlug(slugify(e.target.value));
            }}
            placeholder="My App"
            className="mt-1.5 border-[var(--landing-border)] bg-[var(--landing-bg)] text-[var(--landing-text)]"
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
            className="mt-1.5 border-[var(--landing-border)] bg-[var(--landing-bg)] font-mono text-[var(--landing-text)]"
          />
          <p className="mt-1 text-xs text-[var(--landing-text-tertiary)]">
            Used in MCP config as MEMCTL_PROJECT
          </p>
        </div>
        <div>
          <Label className="text-xs text-[var(--landing-text-secondary)]">
            Description
          </Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this project about?"
            className="mt-1.5 border-[var(--landing-border)] bg-[var(--landing-bg)] text-[var(--landing-text)]"
          />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <Button
          onClick={handleCreate}
          disabled={saving || !name || !slug}
          className="w-full bg-[#F97316] text-white hover:bg-[#EA580C]"
        >
          {saving ? "Creating..." : "Create project"}
        </Button>
      </div>
    </div>
  );
}
