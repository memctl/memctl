"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { AuthBackground } from "@/components/auth/auth-background";
import { Navbar } from "@/components/landing/navbar";
import { ThemeSwitcher } from "@/components/landing/theme-switcher";

const BLOCKED_PREFIXES = ["team@", "noreply@", "hello@", "info@", "support@"];

const TOOLS = [
  "Claude Code",
  "Cursor",
  "VS Code",
  "GitHub Copilot",
  "Windsurf",
  "Neovim",
];

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
    <div className="relative flex min-h-screen flex-col bg-[var(--landing-bg)]">
      <AuthBackground />
      <Navbar />

      <main className="relative z-10 flex flex-1 flex-col">
        {/* Login section — centers in remaining space above the bottom strip */}
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          {/* Branding */}
          <div className="mb-6 text-center">
            <div className="mb-1 flex items-center justify-center gap-3">
              <h1 className="text-2xl font-bold text-[var(--landing-text)]">
                <span className="text-[#F97316]">&#9656;</span> memctl
              </h1>
              <span className="rounded bg-[#F97316]/10 px-2.5 py-1 font-mono text-xs font-medium text-[#F97316]">
                Admin
              </span>
            </div>
            <p className="text-sm text-[var(--landing-text-tertiary)]">
              Give your agents a memory
            </p>
          </div>

          {/* Login card */}
          <div className="w-full max-w-sm">
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

                  <div className="mt-6 border-t border-[var(--landing-border)] pt-4 text-center">
                    <Link
                      href="/login"
                      className="text-sm text-[var(--landing-text-tertiary)] transition-colors hover:text-[var(--landing-text-secondary)]"
                    >
                      Not an admin?{" "}
                      <span className="text-[#F97316]">
                        Sign in with GitHub
                      </span>
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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
