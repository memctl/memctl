import { Shield, Lock, Clock, Globe, Code } from "lucide-react";

const TRUST_ITEMS = [
  { icon: Shield, label: "SOC 2 Type II" },
  { icon: Lock, label: "Encrypted at rest" },
  { icon: Clock, label: "99.9% uptime SLA" },
  { icon: Globe, label: "GDPR compliant" },
  { icon: Code, label: "Open source core" },
];

export function TrustBar() {
  return (
    <section className="border-y border-[var(--landing-border)] bg-[var(--landing-code-bg)] py-10">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-12 gap-y-4 px-6 lg:px-8">
        {TRUST_ITEMS.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-2.5"
          >
            <item.icon
              className="h-4 w-4 text-[#F97316]"
              strokeWidth={1.5}
            />
            <span className="font-mono text-xs text-[var(--landing-text-tertiary)]">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
