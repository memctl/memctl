"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { AuthBackground } from "@/components/auth/auth-background";
import { TerminalLines } from "@/components/auth/terminal-lines";
import { ThemeSwitcher } from "@/components/landing/theme-switcher";
import { AnimatePresence, motion } from "motion/react";

const TOOLS = [
  "Claude Code",
  "Cursor",
  "VS Code",
  "GitHub Copilot",
  "Windsurf",
  "Neovim",
];

const DEV_AUTH_BYPASS_ENABLED =
  process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";
const DEV_AUTH_BYPASS_ORG_SLUG =
  process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS_ORG_SLUG ?? "dev-org";

const TERMINAL_LINES = [
  { prefix: "$ ", prefixColor: "text-[#F97316]", text: "memctl connect" },
  {
    prefix: "\u2713 ",
    prefixColor: "text-green-500",
    text: "Authenticated via GitHub",
  },
  {
    prefix: "\u2713 ",
    prefixColor: "text-green-500",
    text: "Memory store online \u2014 3ms latency",
  },
  { prefix: "\u2713 ", prefixColor: "text-green-500", text: "847 memories loaded" },
];

type LoginToast = {
  id: number;
  title: string;
  message: string;
};

export default function LoginPage() {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [toast, setToast] = useState<LoginToast | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      setToast(null);
    }, 4800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function showErrorToast(message: string) {
    setToast({
      id: Date.now(),
      title: "GitHub sign-in failed",
      message,
    });
  }

  async function handleGitHubSignIn() {
    if (isSigningIn) return;
    setIsSigningIn(true);

    try {
      const res = await authClient.signIn.social({
        provider: "github",
        callbackURL: "/org",
      });

      if (res?.error) {
        const message =
          res.error.message?.includes("Provider not found")
            ? "GitHub OAuth is not configured locally. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET, or use Dev Bypass."
            : (res.error.message ?? "Unable to start GitHub sign-in.");
        showErrorToast(message);
      }
    } catch {
      showErrorToast(
        "Unable to start GitHub sign-in. Check server logs and OAuth settings.",
      );
    } finally {
      setIsSigningIn(false);
    }
  }

  return (
    <div className="relative box-border flex min-h-[100dvh] items-center justify-center bg-[var(--landing-bg)] p-3 sm:p-5 lg:p-8">
      <AuthBackground />

      <div className="relative z-10 w-full max-w-[1100px]">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4 lg:gap-3.5">
          {/* ── Branding ── */}
          <div className="animate-slide-in-left order-1 flex flex-col justify-center rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-6 md:order-2 lg:order-1 lg:p-7">
            <h1 className="mb-2 text-2xl font-bold text-[var(--landing-text)]">
              <span className="animate-pulse-glow inline-block text-[#F97316]">
                &#9656;
              </span>{" "}
              memctl
            </h1>
            <p className="text-sm leading-relaxed text-[var(--landing-text-tertiary)]">
              Persistent, branch-aware context for AI coding agents.
            </p>
          </div>

          {/* ── Login card — rotating orange border ── */}
          <div className="animate-scale-in order-2 overflow-hidden rounded-xl glow-border-spin p-7 md:order-1 md:col-span-2 lg:order-2 lg:col-span-2 lg:p-8 [animation-delay:100ms]">
            <h2 className="mb-1 text-center text-lg font-semibold text-[var(--landing-text)]">
              Sign in
            </h2>
            <p className="mb-6 text-center text-sm text-[var(--landing-text-tertiary)]">
              Continue with your GitHub account
            </p>

            <button
              onClick={handleGitHubSignIn}
              disabled={isSigningIn}
              className="group flex w-full items-center justify-center gap-2.5 rounded-lg border border-[var(--landing-border)] bg-[var(--landing-bg)] px-4 py-2.5 text-sm font-medium text-[var(--landing-text)] transition-all hover:border-[var(--landing-text-tertiary)] hover:shadow-[0_0_20px_rgba(249,115,22,0.12)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="transition-transform group-hover:scale-110 group-hover:rotate-[8deg]"
              >
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              {isSigningIn ? "Starting GitHub sign-in..." : "Sign in with GitHub"}
            </button>

            {DEV_AUTH_BYPASS_ENABLED && (
              <Link
                href={`/org/${DEV_AUTH_BYPASS_ORG_SLUG}`}
                className="mt-3 flex w-full items-center justify-center rounded-lg border border-dashed border-[#F97316]/40 bg-[#F97316]/5 px-4 py-2.5 text-sm font-medium text-[#F97316] transition-colors hover:bg-[#F97316]/10"
              >
                Continue with Dev Bypass
              </Link>
            )}

            <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-[var(--landing-text-tertiary)]">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              We only request your email address.
            </p>

            <p className="mt-4 text-center text-xs text-[var(--landing-text-tertiary)]">
              By signing in, you agree to our{" "}
              <Link
                href="/terms"
                className="text-[#F97316] transition-colors hover:text-[#FB923C]"
              >
                Terms
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="text-[#F97316] transition-colors hover:text-[#FB923C]"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>

          {/* ── Testimonial ── */}
          <div className="animate-slide-in-right order-5 flex flex-col justify-center rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-6 md:order-3 lg:order-3 lg:p-7 [animation-delay:200ms]">
            <span className="animate-float mb-2 block text-3xl leading-none text-[#F97316]/20 [animation-delay:1s]">
              &ldquo;
            </span>
            <p className="mb-4 text-sm leading-relaxed text-[var(--landing-text-secondary)]">
              memctl eliminated the #1 problem with AI coding assistants: every
              new conversation starts from zero.
            </p>
            <div>
              <p className="text-xs font-medium text-[var(--landing-text)]">
                Sarah Chen
              </p>
              <p className="text-xs text-[var(--landing-text-tertiary)]">
                VP of Engineering
              </p>
            </div>
          </div>

          {/* ── Terminal demo — live typing loop ── */}
          <div className="animate-fade-in-up order-3 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-code-bg)] p-5 font-mono text-xs md:order-4 lg:order-4 lg:col-span-2 lg:p-6 [animation-delay:300ms]">
            <div className="mb-3 flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]/80" />
              <div className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]/80" />
              <div className="h-2.5 w-2.5 rounded-full bg-[#28C840]/80" />
            </div>
            <TerminalLines lines={TERMINAL_LINES} />
          </div>

          {/* ── Integrations + trust ── */}
          <div className="animate-fade-in-up order-4 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-5 md:order-5 lg:order-5 lg:col-span-2 lg:p-6 [animation-delay:400ms]">
            <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-[var(--landing-text-tertiary)]">
              Works with your tools
            </p>
            <div className="mb-4 flex flex-wrap gap-2">
              {TOOLS.map((tool, i) => (
                <span
                  key={tool}
                  className="animate-scale-in rounded-full border border-[var(--landing-border)] bg-[var(--landing-bg)] px-3 py-1 text-xs text-[var(--landing-text-tertiary)] transition-all hover:-translate-y-0.5 hover:border-[#F97316]/30 hover:text-[var(--landing-text-secondary)]"
                  style={{ animationDelay: `${550 + i * 60}ms` }}
                >
                  {tool}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-[var(--landing-text-tertiary)]">
              <span className="flex items-center gap-1.5">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Encrypted
              </span>
              <span className="flex items-center gap-1.5">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                SOC 2
              </span>
              <span className="flex items-center gap-1.5">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m18 16 4-4-4-4" />
                  <path d="m6 8-4 4 4 4" />
                  <path d="m14.5 4-5 16" />
                </svg>
                Open source
              </span>
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="animate-fade-in-up order-6 col-span-full flex flex-col items-center justify-between gap-3 px-2 py-3 text-xs text-[var(--landing-text-tertiary)] sm:flex-row [animation-delay:550ms]">
            <span>&copy; 2026 Mindroot Ltd</span>
            <div className="flex items-center gap-6">
              <Link
                href="/privacy"
                className="transition-colors hover:text-[var(--landing-text-secondary)]"
              >
                Privacy
              </Link>
              <Link
                href="/terms"
                className="transition-colors hover:text-[var(--landing-text-secondary)]"
              >
                Terms
              </Link>
              <ThemeSwitcher />
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-none fixed top-4 right-4 z-50 w-[min(92vw,420px)]"
          >
            <div className="rounded-xl border border-[#F97316]/30 bg-[var(--landing-surface)]/95 p-3.5 shadow-[0_16px_42px_rgba(0,0,0,0.2)] backdrop-blur-md">
              <p className="font-mono text-[11px] uppercase tracking-wider text-[#F97316]">
                Auth Error
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--landing-text)]">
                {toast.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--landing-text-secondary)]">
                {toast.message}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
