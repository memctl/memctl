"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Navbar } from "@/components/landing/navbar";
import { ThemeSwitcher } from "@/components/landing/theme-switcher";
import { ScrollReveal } from "@/components/landing/scroll-reveal";

interface Section {
  id: string;
  label: string;
  number: string;
}

interface LegalLayoutProps {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
  sections: Section[];
}

export function LegalLayout({
  title,
  lastUpdated,
  children,
  sections,
}: LegalLayoutProps) {
  const [activeId, setActiveId] = useState<string>("");
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const headings = sections
      .map((s) => document.getElementById(s.id))
      .filter(Boolean) as HTMLElement[];

    if (headings.length === 0) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Find the first heading that is intersecting from the top
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 },
    );

    headings.forEach((el) => observerRef.current!.observe(el));

    return () => observerRef.current?.disconnect();
  }, [sections]);

  // Set first section as active on mount if none is active
  useEffect(() => {
    if (!activeId && sections.length > 0) {
      setActiveId(sections[0].id);
    }
  }, [activeId, sections]);

  return (
    <div className="min-h-screen bg-[var(--landing-bg)] text-[var(--landing-text)]">
      <Navbar />

      <div className="mx-auto max-w-[1600px] px-6 lg:px-8">
        <div className="py-16 lg:py-24">
          {/* Header */}
          <ScrollReveal>
            <div className="mb-16">
              <span className="mb-4 inline-block font-mono text-[11px] font-medium text-[#F97316] uppercase">
                Legal
              </span>
              <h1 className="text-[clamp(2rem,5vw,3.5rem)] leading-[1.1] font-bold">
                {title}
              </h1>
              <p className="mt-4 text-sm text-[var(--landing-text-tertiary)]">
                Last updated: {lastUpdated}
              </p>
            </div>
          </ScrollReveal>

          {/* Layout: sidebar + content */}
          <div className="lg:grid lg:grid-cols-[240px_1fr] lg:gap-16 xl:grid-cols-[280px_1fr]">
            {/* TOC sidebar — desktop only */}
            <aside className="hidden lg:block">
              <nav className="sticky top-24">
                <ul className="space-y-1">
                  {sections.map((section) => (
                    <li key={section.id}>
                      <a
                        href={`#${section.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          const el = document.getElementById(section.id);
                          if (el) {
                            el.scrollIntoView({ behavior: "smooth" });
                            setActiveId(section.id);
                          }
                        }}
                        className={`group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all ${
                          activeId === section.id
                            ? "text-[#F97316]"
                            : "text-[var(--landing-text-tertiary)] hover:text-[var(--landing-text-secondary)]"
                        }`}
                      >
                        <span
                          className={`font-mono text-[10px] ${
                            activeId === section.id
                              ? "text-[#F97316]"
                              : "text-[var(--landing-text-tertiary)]"
                          }`}
                        >
                          {section.number}
                        </span>
                        <span className="relative">
                          {section.label}
                          <span
                            className={`absolute -bottom-0.5 left-0 h-px bg-[#F97316] transition-all ${
                              activeId === section.id
                                ? "w-full"
                                : "w-0 group-hover:w-full"
                            }`}
                          />
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </aside>

            {/* Content */}
            <div className="legal-content min-w-0">{children}</div>
          </div>
        </div>
      </div>

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

interface LegalSectionProps {
  id: string;
  number: string;
  title: string;
  children: React.ReactNode;
}

export function LegalSection({
  id,
  number,
  title,
  children,
}: LegalSectionProps) {
  return (
    <ScrollReveal>
      <section id={id} className="mb-16 scroll-mt-24">
        <div className="mb-6">
          <span className="mb-2 inline-block font-mono text-[11px] font-medium text-[#F97316] uppercase">
            {number}
          </span>
          <h2 className="text-2xl leading-tight font-bold">{title}</h2>
        </div>
        <div className="space-y-4 text-[15px] leading-relaxed text-[var(--landing-text-secondary)]">
          {children}
        </div>
      </section>
    </ScrollReveal>
  );
}
