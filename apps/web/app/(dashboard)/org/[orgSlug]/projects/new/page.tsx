"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/dashboard/shared/page-header";
import {
  Brain,
  Key,
  Globe,
  GitBranch,
  Users,
  Server,
  Terminal,
  Code,
  Copy,
  Sparkles,
  Check,
  Loader2,
} from "lucide-react";

export default function NewProjectPage() {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const slugify = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const displaySlug = slug || "my-project";

  const mcpConfigPreview = JSON.stringify(
    {
      mcpServers: {
        memctl: {
          command: "npx",
          args: ["memctl"],
          env: {
            MEMCTL_ORG: orgSlug,
            MEMCTL_PROJECT: displaySlug,
          },
        },
      },
    },
    null,
    2,
  );

  const apiEndpoint = `https://api.memctl.com/v1/orgs/${orgSlug}/projects/${displaySlug}/memories`;

  const handleCopyConfig = async () => {
    await navigator.clipboard.writeText(mcpConfigPreview);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
      router.refresh();
    } catch {
      setError("Something went wrong");
      setSaving(false);
    }
  };

  const steps = [
    { label: "Create project", icon: Code, active: true },
    { label: "Generate token", icon: Key, active: false },
    { label: "Configure MCP", icon: Terminal, active: false },
    { label: "Start coding", icon: Sparkles, active: false },
  ];

  const features = [
    {
      icon: Brain,
      label: "Memory storage",
      description: "Persistent context that survives across sessions",
    },
    {
      icon: Server,
      label: "MCP server endpoint",
      description: "Connect any MCP-compatible AI assistant",
    },
    {
      icon: Globe,
      label: "REST API access",
      description: "Full CRUD API for programmatic integration",
    },
    {
      icon: GitBranch,
      label: "Branch-level context",
      description: "Isolate memories per git branch automatically",
    },
    {
      icon: Users,
      label: "Team sharing",
      description: "Collaborate with shared project memories",
    },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="New project"
        description="Create a project to organize your memories and API access."
      />

      {/* Step indicator */}
      <div className="dash-card glass-border relative mb-8 overflow-hidden p-4">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[#F97316] via-[#F97316]/60 to-transparent" />
        <div className="flex items-center justify-between">
          {steps.map((step, i) => (
            <div key={step.label} className="flex items-center gap-2">
              {i > 0 && (
                <div className="mx-2 hidden h-px w-8 bg-[var(--landing-border)] sm:mx-4 sm:block sm:w-12 lg:w-16" />
              )}
              <div className="flex items-center gap-2">
                <div
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                    step.active
                      ? "bg-[#F97316] text-white shadow-[0_0_12px_rgba(249,115,22,0.4)]"
                      : "bg-[var(--landing-surface)] text-[var(--landing-text-tertiary)] ring-1 ring-[var(--landing-border)]"
                  }`}
                >
                  {i + 1}
                </div>
                <div className="hidden items-center gap-1.5 sm:flex">
                  <step.icon
                    className={`size-3.5 ${
                      step.active
                        ? "text-[#F97316]"
                        : "text-[var(--landing-text-tertiary)]"
                    }`}
                  />
                  <span
                    className={`text-xs font-medium ${
                      step.active
                        ? "text-[var(--landing-text)]"
                        : "text-[var(--landing-text-tertiary)]"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left column */}
        <div className="space-y-4 lg:col-span-3">
          {/* Form card */}
          <div className="dash-card glass-border relative overflow-hidden p-6">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[#F97316] via-[#F97316]/60 to-transparent" />
            <h2 className="mb-5 text-sm font-semibold text-[var(--landing-text)]">
              Project details
            </h2>
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
                  maxLength={128}
                  className="mt-1.5 border-[var(--landing-border)] bg-[var(--landing-bg)] text-[var(--landing-text)]"
                />
                <p className="mt-1 text-xs text-[var(--landing-text-tertiary)]">
                  A human-readable name for your project
                </p>
              </div>
              <div>
                <Label className="text-xs text-[var(--landing-text-secondary)]">
                  Slug
                </Label>
                <div className="mt-1.5 flex items-center overflow-hidden rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg)]">
                  <span className="shrink-0 border-r border-[var(--landing-border)] bg-[var(--landing-surface)] px-3 py-2 font-mono text-xs text-[var(--landing-text-tertiary)]">
                    MEMCTL_PROJECT=
                  </span>
                  <Input
                    value={slug}
                    onChange={(e) => setSlug(slugify(e.target.value))}
                    placeholder="my-app"
                    maxLength={64}
                    className="border-0 bg-transparent font-mono text-[var(--landing-text)] focus-visible:ring-0"
                  />
                </div>
                <p className="mt-1 text-xs text-[var(--landing-text-tertiary)]">
                  Used in your MCP config and API URLs
                </p>
              </div>
              <div>
                <Label className="text-xs text-[var(--landing-text-secondary)]">
                  Description{" "}
                  <span className="text-[var(--landing-text-tertiary)]">
                    (optional)
                  </span>
                </Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this project about?"
                  rows={3}
                  maxLength={512}
                  className="mt-1.5 border-[var(--landing-border)] bg-[var(--landing-bg)] text-[var(--landing-text)]"
                />
                <p className="mt-1 text-xs text-[var(--landing-text-tertiary)]">
                  Help your team understand this project&apos;s purpose
                </p>
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <Button
                onClick={handleCreate}
                disabled={saving || !name || !slug}
                className="w-full bg-[#F97316] text-white hover:bg-[#EA580C]"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Creating…
                  </>
                ) : (
                  "Create project"
                )}
              </Button>
            </div>
          </div>

          {/* Tip callout */}
          <div className="flex items-center gap-2.5 rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] px-4 py-3">
            <Sparkles className="size-4 shrink-0 text-[#F97316]" />
            <p className="text-xs text-[var(--landing-text-secondary)]">
              Use one project per repository or codebase — you can always rename
              it later from settings.
            </p>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4 lg:col-span-2">
          {/* Live preview card */}
          <div className="dash-card glass-border-always relative overflow-hidden p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--landing-text)]">
                Live preview
              </h2>
              <span className="flex items-center gap-1.5 rounded-full bg-[#F97316]/10 px-2 py-0.5 text-[10px] font-medium text-[#F97316]">
                <span className="inline-block size-1.5 animate-pulse rounded-full bg-[#F97316]" />
                Updates as you type
              </span>
            </div>

            {/* Auth callout */}
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-[#F97316]/20 bg-[#F97316]/5 px-3 py-2">
              <Terminal className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#F97316]" />
              <p className="font-mono text-[10px] leading-relaxed text-[var(--landing-text-secondary)]">
                Run{" "}
                <code className="rounded bg-[var(--landing-surface-2)] px-1 py-0.5 text-[#F97316]">
                  npx memctl auth
                </code>{" "}
                to authenticate.
              </p>
            </div>

            {/* MCP config preview */}
            <div className="relative">
              <div className="overflow-x-auto rounded-lg border border-[var(--landing-border)] bg-[var(--landing-bg)] p-3">
                <pre className="font-mono text-[11px] leading-relaxed text-[var(--landing-text-secondary)]">
                  {mcpConfigPreview}
                </pre>
              </div>
              <button
                onClick={handleCopyConfig}
                className="absolute right-2 top-2 rounded-md border border-[var(--landing-border)] bg-[var(--landing-surface)] p-1.5 text-[var(--landing-text-tertiary)] transition-colors hover:text-[var(--landing-text)]"
              >
                {copied ? (
                  <Check className="size-3.5 text-green-500" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </button>
            </div>

            {/* API endpoint */}
            <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--landing-border)] bg-[var(--landing-bg)] px-3 py-2.5">
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span className="shrink-0 font-semibold text-[#F97316]">
                  GET
                </span>
                <span className="text-[var(--landing-text-secondary)]">
                  {apiEndpoint}
                </span>
              </div>
            </div>
          </div>

          {/* What you'll get card */}
          <div className="dash-card glass-border relative overflow-hidden p-5">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[#F97316] via-[#F97316]/60 to-transparent" />
            <h2 className="mb-4 text-sm font-semibold text-[var(--landing-text)]">
              What you&apos;ll get
            </h2>
            <div className="space-y-3">
              {features.map((feature) => (
                <div key={feature.label} className="flex items-start gap-3">
                  <div className="shrink-0 rounded-lg bg-[#F97316]/10 p-2">
                    <feature.icon className="size-4 text-[#F97316]" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[var(--landing-text)]">
                      {feature.label}
                    </p>
                    <p className="text-xs text-[var(--landing-text-tertiary)]">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
