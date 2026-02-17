"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { AuthBackground } from "@/components/auth/auth-background";
import { TypingTagline } from "@/components/auth/typing-tagline";

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
    <div className="relative flex min-h-screen bg-[var(--landing-bg)]">
      <AuthBackground />

      {/* Left branding panel — desktop only */}
      <div className="relative z-10 hidden w-1/2 flex-col justify-center px-16 lg:flex">
        <div className="animate-fade-in-up max-w-md">
          <div className="mb-4 flex items-center gap-3">
            <h1 className="text-3xl font-bold text-[var(--landing-text)]">
              <span className="text-[#F97316]">&#9656;</span> memctl
            </h1>
            <span className="rounded bg-[#F97316]/10 px-2.5 py-1 font-mono text-xs font-medium text-[#F97316]">
              Admin
            </span>
          </div>
          <div className="mb-8" style={{ animationDelay: "100ms" }}>
            <TypingTagline text="admin access --memctl.com" />
          </div>

          {/* Admin terminal */}
          <div
            className="animate-fade-in-up mb-10 rounded-lg border border-[var(--landing-border)] bg-[var(--landing-code-bg)] p-4 font-mono text-xs"
            style={{ animationDelay: "200ms" }}
          >
            <p className="text-[var(--landing-text-tertiary)]">
              <span className="text-[#F97316]">$</span> memctl admin
              --authenticate
            </p>
            <p className="text-[var(--landing-text-tertiary)]">
              <span className="text-green-500">&#10003;</span> Magic link sent
            </p>
            <p className="text-[var(--landing-text-tertiary)]">
              <span className="text-yellow-500">&#9679;</span> Waiting for
              verification&hellip;
            </p>
          </div>

          {/* Admin feature badges */}
          <div
            className="animate-fade-in-up flex gap-3"
            style={{ animationDelay: "350ms" }}
          >
            {["User management", "Analytics", "System config"].map((feat) => (
              <span
                key={feat}
                className="rounded-full border border-[var(--landing-border)] bg-[var(--landing-surface)] px-3 py-1 text-xs text-[var(--landing-text-tertiary)]"
              >
                {feat}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form / success */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          {/* Mobile-only compact header */}
          <div className="mb-6 text-center lg:hidden">
            <div className="mb-1 flex items-center justify-center gap-2">
              <h1 className="text-2xl font-bold text-[var(--landing-text)]">
                <span className="text-[#F97316]">&#9656;</span> memctl
              </h1>
              <span className="rounded bg-[#F97316]/10 px-2 py-0.5 font-mono text-[11px] font-medium text-[#F97316]">
                Admin
              </span>
            </div>
            <p className="text-sm text-[var(--landing-text-tertiary)]">
              Admin access for @memctl.com
            </p>
          </div>

          <AnimatePresence mode="wait">
            {sent ? (
              /* ── Success state ── */
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="glass-border-always glow-orange relative rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-8 text-center"
              >
                {/* Envelope with float-in animation */}
                <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center">
                  {/* Pulsing ring */}
                  <div className="absolute inset-0 animate-pulse rounded-full bg-[#F97316]/10" />
                  <div className="animate-envelope-float-in flex h-14 w-14 items-center justify-center rounded-full bg-[#F97316]/10">
                    <svg
                      width="28"
                      height="28"
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
                </div>

                <motion.h2
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                  className="mb-2 text-xl font-bold text-[var(--landing-text)]"
                >
                  Check your email
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                  className="mb-1 text-sm text-[var(--landing-text-secondary)]"
                >
                  We sent a sign-in link to
                </motion.p>
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.4 }}
                  className="mb-4 font-mono text-sm text-[#F97316]"
                >
                  {email}
                </motion.p>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5, duration: 0.4 }}
                  className="text-xs text-[var(--landing-text-tertiary)]"
                >
                  The link expires in 5 minutes.
                </motion.p>
              </motion.div>
            ) : (
              /* ── Form state ── */
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="glass-border-always glow-orange relative rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-8"
              >
                <h2 className="mb-1 text-center text-lg font-semibold text-[var(--landing-text)]">
                  Admin sign in
                </h2>
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
                    className="mb-4 w-full rounded-lg border border-[var(--landing-border)] bg-[var(--landing-bg)] px-3 py-2.5 font-mono text-sm text-[var(--landing-text)] placeholder:text-[var(--landing-text-tertiary)] focus:border-[#F97316]/50 focus:outline-none focus:ring-2 focus:ring-[#F97316]/20"
                  />

                  <AnimatePresence>
                    {error && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-4 text-sm text-red-400"
                      >
                        {error}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <button
                    type="submit"
                    disabled={loading}
                    className="group w-full rounded-lg bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#EA580C] hover:shadow-[0_0_20px_rgba(249,115,22,0.25)] disabled:opacity-50"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg
                          className="animate-spin-slow h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <circle
                            cx="12"
                            cy="12"
                            r="10"
                            strokeOpacity="0.25"
                          />
                          <path d="M12 2a10 10 0 0 1 10 10" />
                        </svg>
                        Sending&hellip;
                      </span>
                    ) : (
                      "Send magic link"
                    )}
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
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer */}
          <p className="mt-6 text-center text-[11px] leading-relaxed text-[var(--landing-text-tertiary)]">
            Mindroot Ltd &middot; Company No. 16543299
            <br />
            71-75 Shelton Street, London, WC2H 9JQ
          </p>
        </div>
      </div>
    </div>
  );
}
