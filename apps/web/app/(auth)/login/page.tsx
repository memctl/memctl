"use client";

import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { AuthBackground } from "@/components/auth/auth-background";
import { Navbar } from "@/components/landing/navbar";
import { ThemeSwitcher } from "@/components/landing/theme-switcher";

const TOOLS = [
  "Claude Code",
  "Cursor",
  "VS Code",
  "GitHub Copilot",
  "Windsurf",
  "Neovim",
];

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-[var(--landing-bg)]">
      <AuthBackground />
      <Navbar />

      <main className="relative z-10 flex flex-1 flex-col">
        {/* Login section — centers in remaining space above the bottom strip */}
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          {/* Branding */}
          <div className="mb-6 text-center">
            <h1 className="mb-1 text-2xl font-bold text-[var(--landing-text)]">
              <span className="text-[#F97316]">&#9656;</span> memctl
            </h1>
            <p className="text-sm text-[var(--landing-text-tertiary)]">
              Give your agents a memory
            </p>
          </div>

          {/* Login card */}
          <div className="w-full max-w-sm">
            <div className="glass-border-always glow-orange animate-fade-in-up relative rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-8">
              <h2 className="mb-1 text-center text-lg font-semibold text-[var(--landing-text)]">
                Sign in
              </h2>
              <p className="mb-6 text-center text-sm text-[var(--landing-text-tertiary)]">
                Continue with your GitHub account
              </p>

              {/* GitHub OAuth button */}
              <button
                onClick={() =>
                  authClient.signIn.social({
                    provider: "github",
                    callbackURL: "/onboarding",
                  })
                }
                className="group flex w-full items-center justify-center gap-2.5 rounded-lg border border-[var(--landing-border)] bg-[var(--landing-bg)] px-4 py-2.5 text-sm font-medium text-[var(--landing-text)] transition-all hover:border-[var(--landing-text-tertiary)] hover:shadow-[0_0_20px_rgba(249,115,22,0.12)]"
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
                Sign in with GitHub
              </button>

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

              {/* Terms/Privacy consent */}
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

              {/* Admin link */}
              <div className="mt-6 border-t border-[var(--landing-border)] pt-4 text-center">
                <Link
                  href="/admin/login"
                  className="text-sm text-[var(--landing-text-tertiary)] transition-colors hover:text-[var(--landing-text-secondary)]"
                >
                  Admin?{" "}
                  <span className="text-[#F97316]">
                    Sign in with magic link
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Works-with & trust strip */}
        <div className="border-t border-[var(--landing-border)] px-6 py-12 lg:px-8">
          <div className="mx-auto max-w-2xl">
            <p className="mb-5 text-center font-mono text-[11px] uppercase tracking-widest text-[var(--landing-text-tertiary)]">
              Works with your tools
            </p>
            <div className="mb-8 flex flex-wrap items-center justify-center gap-2.5">
              {TOOLS.map((tool) => (
                <span
                  key={tool}
                  className="rounded-full border border-[var(--landing-border)] bg-[var(--landing-surface)] px-3.5 py-1.5 text-xs text-[var(--landing-text-tertiary)]"
                >
                  {tool}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-[var(--landing-text-tertiary)]">
              <span className="flex items-center gap-1.5">
                <svg
                  width="14"
                  height="14"
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
                Encrypted at rest
              </span>
              <span className="flex items-center gap-1.5">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                SOC 2 compliant
              </span>
              <span className="flex items-center gap-1.5">
                <svg
                  width="14"
                  height="14"
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
                Open source core
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[var(--landing-border)] bg-[var(--landing-code-bg)]">
        <div className="mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-3 px-6 py-6 text-xs text-[var(--landing-text-tertiary)] sm:flex-row lg:px-8">
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
      </footer>
    </div>
  );
}
