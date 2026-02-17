"use client";

import { authClient } from "@/lib/auth-client";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[var(--landing-bg)]">
      {/* Dot grid background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(circle, var(--landing-border) 0.8px, transparent 0.8px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative z-10 w-full max-w-sm px-6">
        <div className="glass-border glow-orange animate-fade-in-up rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] p-8">
          {/* Logo */}
          <h1 className="mb-1 text-center text-2xl font-bold text-[var(--landing-text)]">
            <span className="text-[#F97316]">&#9656;</span> memctl
          </h1>
          <p className="mb-8 text-center text-sm text-[var(--landing-text-tertiary)]">
            Sign in to your account
          </p>

          {/* GitHub OAuth button */}
          <button
            onClick={() =>
              authClient.signIn.social({
                provider: "github",
                callbackURL: "/onboarding",
              })
            }
            className="flex w-full items-center justify-center gap-2.5 rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg)] px-4 py-2.5 text-sm font-medium text-[var(--landing-text)] transition-colors hover:border-[var(--landing-text-tertiary)] hover:bg-[var(--landing-surface-2)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            Sign in with GitHub
          </button>

          <p className="mt-3 text-center text-xs text-[var(--landing-text-tertiary)]">
            We only request your email address.
          </p>

          {/* Admin link */}
          <div className="mt-6 border-t border-[var(--landing-border)] pt-4 text-center">
            <Link
              href="/admin/login"
              className="text-sm text-[var(--landing-text-tertiary)] transition-colors hover:text-[var(--landing-text-secondary)]"
            >
              Admin?{" "}
              <span className="text-[#F97316]">Sign in with magic link</span>
            </Link>
          </div>
        </div>

        {/* Company footer */}
        <div className="mt-6 text-center">
          <div className="mb-2 flex items-center justify-center gap-3 text-xs text-[var(--landing-text-tertiary)]">
            <Link
              href="/privacy"
              className="transition-colors hover:text-[var(--landing-text-secondary)]"
            >
              Privacy
            </Link>
            <span>&middot;</span>
            <Link
              href="/terms"
              className="transition-colors hover:text-[var(--landing-text-secondary)]"
            >
              Terms
            </Link>
          </div>
          <p className="text-[11px] leading-relaxed text-[var(--landing-text-tertiary)]">
            Mindroot Ltd &middot; Company No. 16543299
            <br />
            71-75 Shelton Street, London, WC2H 9JQ
          </p>
        </div>
      </div>
    </div>
  );
}
