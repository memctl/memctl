"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";

const BLOCKED_PREFIXES = ["team@", "noreply@", "hello@", "info@", "support@"];

function validateEmail(email: string): string | null {
  const lower = email.toLowerCase().trim();
  if (!lower.endsWith("@memctl.com")) {
    return "Only @memctl.com email addresses are allowed.";
  }
  for (const prefix of BLOCKED_PREFIXES) {
    if (lower === prefix + "memctl.com") {
      return "This service address cannot be used for admin login.";
    }
  }
  return null;
}

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const validationError = validateEmail(email);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const res = await authClient.signIn.magicLink({
        email: email.toLowerCase().trim(),
        callbackURL: "/admin",
      });
      if (res.error) {
        setError(res.error.message ?? "Failed to send magic link.");
      } else {
        setSent(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

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
        {sent ? (
          /* Success state */
          <div className="glass-border glow-orange animate-fade-in-up rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] p-8 text-center">
            {/* Envelope icon */}
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#F97316]/10">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#F97316"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </div>
            <h1 className="mb-2 text-xl font-bold text-[var(--landing-text)]">
              Check your email
            </h1>
            <p className="mb-1 text-sm text-[var(--landing-text-secondary)]">
              We sent a sign-in link to
            </p>
            <p className="mb-4 font-mono text-sm text-[#F97316]">{email}</p>
            <p className="text-xs text-[var(--landing-text-tertiary)]">
              The link expires in 5 minutes.
            </p>
          </div>
        ) : (
          /* Form state */
          <div className="glass-border glow-orange animate-fade-in-up rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] p-8">
            {/* Logo */}
            <div className="mb-1 flex items-center justify-center gap-2">
              <h1 className="text-2xl font-bold text-[var(--landing-text)]">
                <span className="text-[#F97316]">&#9656;</span> memctl
              </h1>
              <span className="rounded bg-[#F97316]/10 px-2 py-0.5 font-mono text-[11px] font-medium text-[#F97316]">
                Admin
              </span>
            </div>
            <p className="mb-6 text-center text-sm text-[var(--landing-text-tertiary)]">
              Sign in with your @memctl.com email
            </p>

            <form onSubmit={handleSubmit}>
              <label
                htmlFor="email"
                className="mb-1.5 block text-xs font-medium text-[var(--landing-text-secondary)]"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError("");
                }}
                placeholder="you@memctl.com"
                required
                className="mb-4 w-full rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg)] px-3 py-2.5 font-mono text-sm text-[var(--landing-text)] placeholder:text-[var(--landing-text-tertiary)] focus:border-[#F97316]/50 focus:outline-none focus:ring-1 focus:ring-[#F97316]/50"
              />

              {error && (
                <p className="mb-4 text-sm text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#EA580C] disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send magic link"}
              </button>
            </form>

            <div className="mt-6 border-t border-[var(--landing-border)] pt-4 text-center">
              <Link
                href="/login"
                className="text-sm text-[var(--landing-text-tertiary)] transition-colors hover:text-[var(--landing-text-secondary)]"
              >
                Not an admin?{" "}
                <span className="text-[#F97316]">Sign in with GitHub</span>
              </Link>
            </div>
          </div>
        )}

        {/* Company footer */}
        <p className="mt-6 text-center text-[11px] leading-relaxed text-[var(--landing-text-tertiary)]">
          Mindroot Ltd &middot; Company No. 16543299
          <br />
          71-75 Shelton Street, London, WC2H 9JQ
        </p>
      </div>
    </div>
  );
}
