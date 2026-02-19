"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/dashboard/shared/page-header";
import { Check } from "lucide-react";

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
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="New project"
        description="Create a project to organize your memories and API access."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Form */}
        <div className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-6">
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
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this project about?"
                rows={3}
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

        {/* Tips */}
        <div className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-6">
          <h3 className="text-sm font-medium text-[var(--landing-text)]">
            What is a project?
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-[var(--landing-text-secondary)]">
            A project groups related memories together and scopes API access.
            Each project gets its own set of memories, accessible via the MCP
            server or REST API.
          </p>

          <h3 className="mt-6 text-sm font-medium text-[var(--landing-text)]">
            Tips
          </h3>
          <ul className="mt-3 space-y-2.5">
            {[
              "Use one project per repository or codebase",
              "The slug is used as MEMCTL_PROJECT in your MCP config",
              "You can rename the project later from its settings",
            ].map((tip) => (
              <li key={tip} className="flex items-start gap-2">
                <Check className="mt-0.5 size-3.5 shrink-0 text-[#F97316]" />
                <span className="text-xs text-[var(--landing-text-secondary)]">
                  {tip}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
