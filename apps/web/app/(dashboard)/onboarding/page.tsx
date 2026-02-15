"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STEPS = [
  "welcome",
  "heard-from",
  "role",
  "team-size",
  "use-case",
  "create-org",
  "done",
] as const;

const HEARD_FROM_OPTIONS = [
  "GitHub",
  "Twitter/X",
  "Blog post",
  "Friend/colleague",
  "Search",
  "Other",
];

const ROLE_OPTIONS = [
  "Developer",
  "Team lead",
  "Engineering manager",
  "Other",
];

const TEAM_SIZE_OPTIONS = ["Solo", "2-5", "6-20", "20+"];

const USE_CASE_OPTIONS = [
  "Personal projects",
  "Team collaboration",
  "Enterprise",
  "Open source",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [heardFrom, setHeardFrom] = useState("");
  const [role, setRole] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [useCase, setUseCase] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const currentStep = STEPS[step];

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));

  const handleComplete = async () => {
    if (!orgName || !orgSlug) {
      setError("Organization name and slug are required");
      return;
    }
    setSaving(true);
    setError("");

    try {
      // Save onboarding + create org
      const res = await fetch("/api/v1/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heardFrom,
          role,
          teamSize,
          useCase,
          orgName,
          orgSlug,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Something went wrong");
        setSaving(false);
        return;
      }

      next();
      setTimeout(() => {
        router.push(`/${orgSlug}`);
      }, 2000);
    } catch {
      setError("Something went wrong");
      setSaving(false);
    }
  };

  const slugify = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md border border-border p-8">
        {/* Progress */}
        <div className="mb-8 flex gap-1">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 ${i <= step ? "bg-primary" : "bg-border"}`}
            />
          ))}
        </div>

        {currentStep === "welcome" && (
          <div>
            <h1 className="mb-2 font-mono text-2xl font-bold">
              Welcome to mem<span className="text-primary">/</span>ctl
            </h1>
            <p className="mb-8 font-mono text-sm text-muted-foreground">
              Let&apos;s get you set up in under a minute.
            </p>
            <Button onClick={next} className="w-full">
              Let&apos;s go
            </Button>
          </div>
        )}

        {currentStep === "heard-from" && (
          <div>
            <h2 className="mb-4 font-mono text-lg font-bold">
              How did you hear about us?
            </h2>
            <div className="space-y-2">
              {HEARD_FROM_OPTIONS.map((option) => (
                <button
                  key={option}
                  onClick={() => {
                    setHeardFrom(option.toLowerCase());
                    next();
                  }}
                  className={`w-full border px-4 py-3 text-left font-mono text-sm transition-colors hover:bg-muted ${
                    heardFrom === option.toLowerCase()
                      ? "border-primary"
                      : "border-border"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}

        {currentStep === "role" && (
          <div>
            <h2 className="mb-4 font-mono text-lg font-bold">Your role</h2>
            <div className="space-y-2">
              {ROLE_OPTIONS.map((option) => (
                <button
                  key={option}
                  onClick={() => {
                    setRole(option.toLowerCase().replace(/ /g, "_"));
                    next();
                  }}
                  className={`w-full border px-4 py-3 text-left font-mono text-sm transition-colors hover:bg-muted ${
                    role === option.toLowerCase().replace(/ /g, "_")
                      ? "border-primary"
                      : "border-border"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}

        {currentStep === "team-size" && (
          <div>
            <h2 className="mb-4 font-mono text-lg font-bold">Team size</h2>
            <div className="space-y-2">
              {TEAM_SIZE_OPTIONS.map((option) => (
                <button
                  key={option}
                  onClick={() => {
                    setTeamSize(option.toLowerCase());
                    next();
                  }}
                  className={`w-full border px-4 py-3 text-left font-mono text-sm transition-colors hover:bg-muted ${
                    teamSize === option.toLowerCase()
                      ? "border-primary"
                      : "border-border"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}

        {currentStep === "use-case" && (
          <div>
            <h2 className="mb-4 font-mono text-lg font-bold">
              Primary use case
            </h2>
            <div className="space-y-2">
              {USE_CASE_OPTIONS.map((option) => (
                <button
                  key={option}
                  onClick={() => {
                    setUseCase(option.toLowerCase().replace(/ /g, "_"));
                    setOrgName("My Hobby");
                    setOrgSlug("my-hobby");
                    next();
                  }}
                  className={`w-full border px-4 py-3 text-left font-mono text-sm transition-colors hover:bg-muted ${
                    useCase === option.toLowerCase().replace(/ /g, "_")
                      ? "border-primary"
                      : "border-border"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}

        {currentStep === "create-org" && (
          <div>
            <h2 className="mb-4 font-mono text-lg font-bold">
              Create your first organization
            </h2>
            <div className="space-y-4">
              <div>
                <Label>Organization Name</Label>
                <Input
                  value={orgName}
                  onChange={(e) => {
                    setOrgName(e.target.value);
                    setOrgSlug(slugify(e.target.value));
                  }}
                />
              </div>
              <div>
                <Label>Slug</Label>
                <Input
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(slugify(e.target.value))}
                />
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  Used in URLs and MCP config
                </p>
              </div>
              {error && (
                <p className="font-mono text-xs text-destructive">{error}</p>
              )}
              <Button
                onClick={handleComplete}
                disabled={saving}
                className="w-full"
              >
                {saving ? "Creating..." : "Create organization"}
              </Button>
            </div>
          </div>
        )}

        {currentStep === "done" && (
          <div className="text-center">
            <h2 className="mb-2 font-mono text-2xl font-bold text-primary">
              You&apos;re all set!
            </h2>
            <p className="font-mono text-sm text-muted-foreground">
              Redirecting to your dashboard...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
