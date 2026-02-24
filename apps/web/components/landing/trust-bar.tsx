import { Lock, Clock, Globe, Code } from "lucide-react";

const TRUST_ITEMS = [
  { icon: Lock, label: "Encrypted at rest" },
  { icon: Clock, label: "99.9% uptime SLA" },
  { icon: Globe, label: "GDPR compliant" },
  { icon: Code, label: "Open source core" },
];

export function TrustBar() {
  return (
    <>
      {/* ── Top divider with intersection dots ── */}
      <div className="relative flex items-center" aria-hidden="true">
        <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-[var(--landing-border)] to-transparent" />
        <div className="relative mx-auto flex w-full max-w-[1600px] justify-between px-6 lg:px-8">
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--landing-border)]" />
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--landing-border)]" />
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--landing-border)]" />
        </div>
      </div>
      <section className="relative bg-[var(--landing-code-bg)] py-10">
        {/* ── Structural frame lines ── */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
        >
          <div className="mx-auto flex h-full max-w-[1600px] justify-between px-6 lg:px-8">
            <div className="w-px bg-[var(--landing-border)] opacity-[0.12]" />
            <div className="w-px bg-[var(--landing-border)] opacity-[0.06]" />
            <div className="w-px bg-[var(--landing-border)] opacity-[0.12]" />
          </div>
        </div>
        {/* ── Diagonal hatching ── */}
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[repeating-linear-gradient(-45deg,transparent,transparent_6px,var(--landing-border)_6px,var(--landing-border)_7px)] opacity-[0.2] [mask-image:linear-gradient(to_bottom,black_20%,transparent_80%)]"
          aria-hidden="true"
        />
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-6 gap-y-4 px-6 sm:gap-x-8 lg:gap-x-12 lg:px-8">
          {TRUST_ITEMS.map((item) => (
            <div key={item.label} className="flex items-center gap-2.5">
              <item.icon className="h-4 w-4 text-[#F97316]" strokeWidth={1.5} />
              <span className="font-mono text-xs text-[var(--landing-text-tertiary)]">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </section>
      {/* ── Bottom divider with intersection dots ── */}
      <div className="relative flex items-center" aria-hidden="true">
        <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-[var(--landing-border)] to-transparent" />
        <div className="relative mx-auto flex w-full max-w-[1600px] justify-between px-6 lg:px-8">
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--landing-border)]" />
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--landing-border)]" />
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--landing-border)]" />
        </div>
      </div>
    </>
  );
}
