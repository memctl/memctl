"use client";

import Link from "next/link";
import { Navbar } from "@/components/landing/navbar";
import { ThemeSwitcher } from "@/components/landing/theme-switcher";

interface BlogLayoutProps {
  children: React.ReactNode;
}

export function BlogLayout({ children }: BlogLayoutProps) {
  return (
    <div className="min-h-screen bg-[var(--landing-bg)] text-[var(--landing-text)]">
      <Navbar />

      <div className="mx-auto max-w-[1600px] px-6 lg:px-8">{children}</div>

      {/* Compact footer */}
      <footer className="border-t border-[var(--landing-border)] bg-[var(--landing-code-bg)]">
        <div className="mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-4 px-6 py-8 text-xs text-[var(--landing-text-tertiary)] sm:flex-row lg:px-8">
          <div className="flex flex-col items-center gap-1 sm:items-start">
            <span>
              &copy; {new Date().getFullYear()} Mindroot Ltd. All rights
              reserved.
            </span>
            <span>
              Mindroot Ltd &middot; Company No. 16543299 &middot; England and
              Wales
            </span>
          </div>
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
            <Link
              href="/security"
              className="transition-colors hover:text-[var(--landing-text-secondary)]"
            >
              Security
            </Link>
            <ThemeSwitcher />
          </div>
        </div>
      </footer>
    </div>
  );
}
