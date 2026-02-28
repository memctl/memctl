"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ExternalLink, Download, FileText } from "lucide-react";

interface Invoice {
  id: string;
  number: string | null;
  status: "draft" | "open" | "paid" | "uncollectible" | "void";
  amountDue: number;
  amountPaid: number;
  currency: string;
  created: number;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
  lines: string[];
}

const statusStyles: Record<string, string> = {
  paid: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  open: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  draft:
    "bg-[var(--landing-surface-2)] text-[var(--landing-text-secondary)] border-[var(--landing-border)]",
  void: "bg-red-500/10 text-red-400 border-red-500/20",
  uncollectible: "bg-red-500/10 text-red-400 border-red-500/20",
};

function formatAmount(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function formatDate(unix: number) {
  return new Date(unix * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function InvoiceHistory({ orgSlug }: { orgSlug: string }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInvoices() {
      try {
        const res = await fetch(`/api/v1/orgs/${orgSlug}/invoices`);
        if (!res.ok) {
          toast.error("Failed to load invoices");
          return;
        }
        const data = await res.json();
        setInvoices(data.invoices ?? []);
      } catch {
        toast.error("Failed to load invoices");
      } finally {
        setLoading(false);
      }
    }
    fetchInvoices();
  }, [orgSlug]);

  if (loading) {
    return (
      <div className="mt-6">
        <h3 className="text-sm font-medium text-[var(--landing-text)]">
          Invoices
        </h3>
        <div className="dash-card mt-3 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--landing-border)]">
                <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Date
                </th>
                <th className="hidden px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)] sm:table-cell">
                  Invoice #
                </th>
                <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Amount
                </th>
                <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Status
                </th>
                <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2].map((i) => (
                <tr
                  key={i}
                  className={
                    i < 2
                      ? "border-b border-[var(--landing-border)]"
                      : undefined
                  }
                >
                  <td className="px-4 py-3">
                    <div className="h-3 w-20 animate-pulse rounded bg-[var(--landing-surface-2)]" />
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <div className="h-3 w-24 animate-pulse rounded bg-[var(--landing-surface-2)]" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-3 w-16 animate-pulse rounded bg-[var(--landing-surface-2)]" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 w-12 animate-pulse rounded-full bg-[var(--landing-surface-2)]" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="ml-auto h-3 w-16 animate-pulse rounded bg-[var(--landing-surface-2)]" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="mt-6">
        <h3 className="text-sm font-medium text-[var(--landing-text)]">
          Invoices
        </h3>
        <div className="dash-card mt-3 flex flex-col items-center justify-center py-12">
          <FileText className="size-8 text-[var(--landing-text-tertiary)]" />
          <p className="mt-3 text-sm text-[var(--landing-text-secondary)]">
            No invoices yet
          </p>
          <p className="mt-1 text-xs text-[var(--landing-text-tertiary)]">
            Invoices will appear here after your first payment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <h3 className="text-sm font-medium text-[var(--landing-text)]">
        Invoices
      </h3>
      <div className="dash-card mt-3 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--landing-border)]">
              <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                Date
              </th>
              <th className="hidden px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)] sm:table-cell">
                Invoice #
              </th>
              <th className="hidden px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)] md:table-cell">
                Description
              </th>
              <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                Amount
              </th>
              <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                Status
              </th>
              <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv, i) => (
              <tr
                key={inv.id}
                className={
                  i < invoices.length - 1
                    ? "border-b border-[var(--landing-border)]"
                    : undefined
                }
              >
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-[var(--landing-text-secondary)]">
                  {formatDate(inv.created)}
                </td>
                <td className="hidden whitespace-nowrap px-4 py-3 font-mono text-xs text-[var(--landing-text-tertiary)] sm:table-cell">
                  {inv.number ?? "-"}
                </td>
                <td className="hidden max-w-[200px] truncate px-4 py-3 font-mono text-xs text-[var(--landing-text-tertiary)] md:table-cell">
                  {inv.lines[0] ?? "-"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-[var(--landing-text)]">
                  {formatAmount(inv.amountPaid, inv.currency)}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] capitalize ${statusStyles[inv.status] ?? statusStyles.draft}`}
                  >
                    {inv.status}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <span className="inline-flex items-center gap-3">
                    {inv.hostedInvoiceUrl && (
                      <a
                        href={inv.hostedInvoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-[11px] text-[#F97316] hover:underline"
                      >
                        View
                        <ExternalLink className="size-3" />
                      </a>
                    )}
                    {inv.invoicePdf && (
                      <a
                        href={inv.invoicePdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-[11px] text-[#F97316] hover:underline"
                      >
                        PDF
                        <Download className="size-3" />
                      </a>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
