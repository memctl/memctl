"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Menu, XIcon } from "lucide-react";

const NAV_LINKS = [
  { label: "Product", href: "/#features" },
  { label: "Docs", href: "/docs" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Blog", href: "/blog" },
  { label: "Changelog", href: "/changelog" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navClass = scrolled
    ? "sticky top-0 z-50 border-b border-[var(--landing-border)] bg-[var(--landing-bg)]/80 backdrop-blur-2xl backdrop-saturate-[1.8] shadow-sm transition-all duration-500"
    : "sticky top-0 z-50 border-b border-transparent bg-[var(--landing-bg)]/30 backdrop-blur-xl transition-all duration-500";

  return (
    <nav className={navClass}>
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-4 lg:px-8">
        <Link
          href="/"
          className="font-mono text-base font-semibold text-[var(--landing-text)]"
        >
          <span className="text-[#F97316]">{">"}</span> memctl
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="group relative text-sm font-medium text-[var(--landing-text-secondary)] transition-colors hover:text-[var(--landing-text)]"
            >
              {link.label}
              <span className="absolute -bottom-1 left-0 h-px w-0 bg-[#F97316] transition-all group-hover:w-full" />
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <a
            href="https://github.com/memctl/memctl"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-1.5 rounded-md border border-[var(--landing-border-hover)] px-3 py-1.5 font-mono text-xs text-[var(--landing-text-tertiary)] transition-colors hover:border-[var(--landing-text-tertiary)] hover:text-[var(--landing-text-secondary)] sm:inline-flex"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            Star
          </a>
          <Link
            href="/login"
            className="hidden text-sm font-medium text-[var(--landing-text-secondary)] transition-colors hover:text-[var(--landing-text)] sm:block"
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="group inline-flex items-center gap-1.5 rounded-lg bg-[#F97316] px-5 py-2 text-sm font-medium text-white transition-all hover:bg-[#FB923C] hover:shadow-[0_0_20px_rgba(249,115,22,0.3)]"
          >
            Get Started
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="text-[var(--landing-text-secondary)] md:hidden"
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <XIcon className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-[var(--landing-border)] bg-[var(--landing-bg)] px-6 py-4 md:hidden">
          <div className="space-y-3">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="block text-sm font-medium text-[var(--landing-text-secondary)] transition-colors hover:text-[var(--landing-text)]"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
