import Link from "next/link";
import { PLANS } from "@memctl/shared/constants";

export const metadata = {
  title: "Pricing — mem/ctl",
  description: "Simple, transparent pricing for teams of all sizes",
};

export default function PricingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Diagonal hatching background */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[repeating-linear-gradient(-45deg,transparent,transparent_5px,var(--color-border)_5px,var(--color-border)_6px)] opacity-[0.35] [mask-image:linear-gradient(to_bottom,transparent,black_15%,black_40%,transparent)]"
        aria-hidden="true"
      />
      {/* Indigo glow */}
      <div
        className="pointer-events-none absolute left-[30%] top-[30%] -z-10 h-[400px] w-[500px] rounded-full bg-indigo-500/[0.04] blur-[120px]"
        aria-hidden="true"
      />
      <nav className="border-border flex items-center justify-between border-b px-6 py-4 md:px-12">
        <Link href="/" className="font-mono text-lg font-bold">
          mem<span className="text-primary">/</span>ctl
        </Link>
        <div className="flex gap-6 font-mono text-sm">
          <Link
            href="/docs"
            className="text-muted-foreground hover:text-foreground"
          >
            Docs
          </Link>
          <Link
            href="/login"
            className="text-muted-foreground hover:text-foreground"
          >
            Sign in
          </Link>
        </div>
      </nav>

      <section className="px-6 py-20 md:px-12 lg:px-24">
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-4 font-mono text-3xl font-bold">Pricing</h1>
          <p className="text-muted-foreground mb-12 font-mono text-sm">
            Start free. Upgrade when your team grows.
          </p>

          <div className="overflow-x-auto">
            <table className="border-border w-full border-collapse border font-mono text-sm">
              <thead>
                <tr className="border-border bg-muted border-b">
                  <th className="border-border border-r px-4 py-3 text-left">
                    Plan
                  </th>
                  <th className="border-border border-r px-4 py-3 text-right">
                    Price/mo
                  </th>
                  <th className="border-border border-r px-4 py-3 text-right">
                    Projects
                  </th>
                  <th className="border-border border-r px-4 py-3 text-right">
                    Members
                  </th>
                  <th className="border-border border-r px-4 py-3 text-right">
                    Memories/project
                  </th>
                  <th className="border-border border-r px-4 py-3 text-right">
                    API calls/mo
                  </th>
                  <th className="px-4 py-3 text-center" />
                </tr>
              </thead>
              <tbody>
                {Object.entries(PLANS).map(([id, plan]) => (
                  <tr key={id} className="border-border border-b">
                    <td className="border-border border-r px-4 py-3 font-bold">
                      {plan.name}
                    </td>
                    <td className="border-border text-muted-foreground border-r px-4 py-3 text-right">
                      {plan.price === -1
                        ? "Custom"
                        : plan.price === 0
                          ? "$0"
                          : `$${plan.price}`}
                    </td>
                    <td className="border-border text-muted-foreground border-r px-4 py-3 text-right">
                      {plan.projectLimit === Infinity
                        ? "Unlimited"
                        : plan.projectLimit}
                    </td>
                    <td className="border-border text-muted-foreground border-r px-4 py-3 text-right">
                      {plan.memberLimit === Infinity
                        ? "Unlimited"
                        : plan.memberLimit}
                    </td>
                    <td className="border-border text-muted-foreground border-r px-4 py-3 text-right">
                      {plan.memoryLimitPerProject === Infinity
                        ? "Unlimited"
                        : `${plan.memoryLimitPerProject.toLocaleString()} / project`}
                    </td>
                    <td className="border-border text-muted-foreground border-r px-4 py-3 text-right">
                      {plan.apiCallLimit === Infinity
                        ? "Unlimited"
                        : plan.apiCallLimit.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {id === "enterprise" ? (
                        <a
                          href="mailto:hello@memctl.com"
                          className="text-primary hover:underline"
                        >
                          Contact
                        </a>
                      ) : (
                        <Link
                          href="/login"
                          className="text-primary hover:underline"
                        >
                          {id === "free" ? "Start free" : "Upgrade"}
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
