"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { AuthBackground } from "@/components/auth/auth-background";
import { TypingTagline } from "@/components/auth/typing-tagline";

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
  { label: "GitHub", letter: "G" },
  { label: "Twitter/X", letter: "T" },
  { label: "Blog post", letter: "B" },
  { label: "Friend/colleague", letter: "F" },
  { label: "Search", letter: "S" },
  { label: "Other", letter: "O" },
];

const ROLE_OPTIONS = [
  { label: "Developer", letter: "D" },
  { label: "Team lead", letter: "T" },
  { label: "Engineering manager", letter: "E" },
  { label: "Other", letter: "O" },
];

const TEAM_SIZE_OPTIONS = [
  { label: "Solo", letter: "1" },
  { label: "2-5", letter: "2" },
  { label: "6-20", letter: "6" },
  { label: "20+", letter: "+" },
];

const USE_CASE_OPTIONS = [
  { label: "Personal projects", letter: "P" },
  { label: "Team collaboration", letter: "T" },
  { label: "Enterprise", letter: "E" },
  { label: "Open source", letter: "O" },
];

const CONFETTI_PARTICLES = Array.from({ length: 8 }, (_, i) => {
  const angle = (i / 8) * Math.PI * 2;
  return {
    x: `${Math.cos(angle) * 40}px`,
    y: `${Math.sin(angle) * 40}px`,
  };
});

function OptionCard({
  label,
  letter,
  selected,
  onClick,
  delay,
}: {
  label: string;
  letter: string;
  selected: boolean;
  onClick: () => void;
  delay: number;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      className={`glass-border relative flex w-full items-center gap-3 rounded-lg border px-4 py-3.5 text-left font-mono text-sm transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(249,115,22,0.1)] ${
        selected
          ? "border-[#F97316]/50 bg-[#F97316]/5 text-[var(--landing-text)]"
          : "border-[var(--landing-border)] bg-[var(--landing-surface)] text-[var(--landing-text-secondary)] hover:border-[var(--landing-border-hover)]"
      }`}
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
          selected
            ? "bg-[#F97316] text-white"
            : "bg-[var(--landing-surface-2)] text-[var(--landing-text-tertiary)]"
        }`}
      >
        {letter}
      </span>
      {label}
    </motion.button>
  );
}

function StepContent({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      key={title}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <h2 className="mb-5 font-mono text-lg font-bold text-[var(--landing-text)]">
        {title}
      </h2>
      {children}
    </motion.div>
  );
}

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
  const progress = ((step + 1) / STEPS.length) * 100;

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));

  const handleComplete = async () => {
    if (!orgName || !orgSlug) {
      setError("Organization name and slug are required");
      return;
    }
    setSaving(true);
    setError("");

    try {
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
        router.push(`/org/${orgSlug}`);
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
    <div className="relative flex min-h-screen items-center justify-center bg-[var(--landing-bg)]">
      <AuthBackground />

      <div className="relative z-10 w-full max-w-lg px-6 py-12">
        {/* Progress bar */}
        {currentStep !== "done" && (
          <div className="mb-8">
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--landing-border)]">
              <motion.div
                className="animate-progress-glow h-full rounded-full bg-[#F97316]"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <p className="mt-2 text-center font-mono text-xs text-[var(--landing-text-tertiary)]">
              Step {step + 1} of {STEPS.length}
            </p>
          </div>
        )}

        {/* Card */}
        <div
          className={`glass-border glow-orange relative rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-8 ${
            currentStep === "done" ? "overflow-hidden" : ""
          }`}
        >
          <AnimatePresence mode="wait">
            {/* ── Welcome ── */}
            {currentStep === "welcome" && (
              <motion.div
                key="welcome"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="text-center"
              >
                <div className="mb-4">
                  <h1 className="mb-2 text-3xl font-bold text-[var(--landing-text)]">
                    <span className="text-[#F97316]">&#9656;</span> memctl
                  </h1>
                </div>
                <div className="mx-auto mb-6 w-fit">
                  <TypingTagline text="let's get you set up" />
                </div>
                <p className="mb-8 text-sm text-[var(--landing-text-tertiary)]">
                  Under a minute &mdash; we promise.
                </p>
                <button
                  onClick={next}
                  className="group w-full rounded-lg bg-[#F97316] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#EA580C] hover:shadow-[0_0_20px_rgba(249,115,22,0.25)]"
                >
                  Let&apos;s go
                </button>
              </motion.div>
            )}

            {/* ── Heard-from ── */}
            {currentStep === "heard-from" && (
              <StepContent title="How did you hear about us?">
                <div className="space-y-2">
                  {HEARD_FROM_OPTIONS.map((opt, i) => (
                    <OptionCard
                      key={opt.label}
                      label={opt.label}
                      letter={opt.letter}
                      selected={heardFrom === opt.label.toLowerCase()}
                      delay={i * 0.05}
                      onClick={() => {
                        setHeardFrom(opt.label.toLowerCase());
                        next();
                      }}
                    />
                  ))}
                </div>
              </StepContent>
            )}

            {/* ── Role ── */}
            {currentStep === "role" && (
              <StepContent title="Your role">
                <div className="space-y-2">
                  {ROLE_OPTIONS.map((opt, i) => (
                    <OptionCard
                      key={opt.label}
                      label={opt.label}
                      letter={opt.letter}
                      selected={
                        role === opt.label.toLowerCase().replace(/ /g, "_")
                      }
                      delay={i * 0.05}
                      onClick={() => {
                        setRole(opt.label.toLowerCase().replace(/ /g, "_"));
                        next();
                      }}
                    />
                  ))}
                </div>
              </StepContent>
            )}

            {/* ── Team size ── */}
            {currentStep === "team-size" && (
              <StepContent title="Team size">
                <div className="space-y-2">
                  {TEAM_SIZE_OPTIONS.map((opt, i) => (
                    <OptionCard
                      key={opt.label}
                      label={opt.label}
                      letter={opt.letter}
                      selected={teamSize === opt.label.toLowerCase()}
                      delay={i * 0.05}
                      onClick={() => {
                        setTeamSize(opt.label.toLowerCase());
                        next();
                      }}
                    />
                  ))}
                </div>
              </StepContent>
            )}

            {/* ── Use case ── */}
            {currentStep === "use-case" && (
              <StepContent title="Primary use case">
                <div className="space-y-2">
                  {USE_CASE_OPTIONS.map((opt, i) => (
                    <OptionCard
                      key={opt.label}
                      label={opt.label}
                      letter={opt.letter}
                      selected={
                        useCase === opt.label.toLowerCase().replace(/ /g, "_")
                      }
                      delay={i * 0.05}
                      onClick={() => {
                        setUseCase(opt.label.toLowerCase().replace(/ /g, "_"));
                        setOrgName("My Hobby");
                        setOrgSlug("my-hobby");
                        next();
                      }}
                    />
                  ))}
                </div>
              </StepContent>
            )}

            {/* ── Create org ── */}
            {currentStep === "create-org" && (
              <motion.div
                key="create-org"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                <h2 className="mb-5 font-mono text-lg font-bold text-[var(--landing-text)]">
                  Create your first organization
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--landing-text-secondary)]">
                      Organization Name
                    </label>
                    <input
                      value={orgName}
                      onChange={(e) => {
                        setOrgName(e.target.value);
                        setOrgSlug(slugify(e.target.value));
                      }}
                      className="w-full rounded-lg border border-[var(--landing-border)] bg-[var(--landing-bg)] px-3 py-2.5 text-sm text-[var(--landing-text)] placeholder:text-[var(--landing-text-tertiary)] focus:border-[#F97316]/50 focus:ring-2 focus:ring-[#F97316]/20 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--landing-text-secondary)]">
                      Slug
                    </label>
                    <div className="flex items-stretch overflow-hidden rounded-lg border border-[var(--landing-border)] focus-within:border-[#F97316]/50 focus-within:ring-2 focus-within:ring-[#F97316]/20">
                      <span className="flex shrink-0 items-center bg-[var(--landing-surface-2)] px-2.5 font-mono text-[11px] text-[var(--landing-text-tertiary)]">
                        memctl.com/org/
                      </span>
                      <input
                        value={orgSlug}
                        onChange={(e) => setOrgSlug(slugify(e.target.value))}
                        className="min-w-0 flex-1 bg-[var(--landing-bg)] px-2.5 py-2.5 font-mono text-sm text-[var(--landing-text)] focus:outline-none"
                      />
                    </div>
                    <p className="mt-1.5 font-mono text-xs text-[var(--landing-text-tertiary)]">
                      Used in URLs and MCP config
                    </p>
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="font-mono text-xs text-red-400"
                      >
                        {error}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <button
                    onClick={handleComplete}
                    disabled={saving}
                    className="w-full rounded-lg bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#EA580C] hover:shadow-[0_0_20px_rgba(249,115,22,0.25)] disabled:opacity-50"
                  >
                    {saving ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg
                          className="animate-spin-slow h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                          <path d="M12 2a10 10 0 0 1 10 10" />
                        </svg>
                        Creating&hellip;
                      </span>
                    ) : (
                      "Create organization"
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Done ── */}
            {currentStep === "done" && (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="relative py-6 text-center"
              >
                {/* Confetti burst */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {CONFETTI_PARTICLES.map((p, i) => (
                    <div
                      key={i}
                      className="animate-confetti-fall absolute h-2 w-2 rounded-full"
                      style={
                        {
                          "--x": p.x,
                          "--y": p.y,
                          backgroundColor: i % 2 === 0 ? "#F97316" : "#FB923C",
                          animationDelay: `${i * 0.06}s`,
                        } as React.CSSProperties
                      }
                    />
                  ))}
                </div>

                {/* Checkmark SVG */}
                <div className="relative mx-auto mb-6 flex h-16 w-16 items-center justify-center">
                  <div className="absolute inset-0 animate-pulse rounded-full bg-[#F97316]/10" />
                  <svg
                    width="36"
                    height="36"
                    viewBox="0 0 36 36"
                    fill="none"
                    className="relative"
                  >
                    <motion.path
                      d="M8 18 L15 25 L28 11"
                      stroke="#F97316"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{
                        delay: 0.3,
                        duration: 0.5,
                        ease: "easeOut",
                      }}
                    />
                  </svg>
                </div>

                <motion.h2
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                  className="glow-text mb-2 font-mono text-2xl font-bold text-[#F97316]"
                >
                  You&apos;re all set!
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.4 }}
                  className="font-mono text-sm text-[var(--landing-text-tertiary)]"
                >
                  Redirecting to your dashboard
                  <span className="inline-flex w-6">
                    <motion.span
                      animate={{ opacity: [0, 1, 0] }}
                      transition={{
                        repeat: Infinity,
                        duration: 1.5,
                        times: [0, 0.5, 1],
                      }}
                    >
                      ...
                    </motion.span>
                  </span>
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
