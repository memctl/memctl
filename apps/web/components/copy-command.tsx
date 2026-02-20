"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyCommand() {
  const [copied, setCopied] = useState(false);
  const command = "npx memctl";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="inline-flex items-center gap-3 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface-2)] px-6 py-3.5">
      <span className="select-none font-mono text-sm text-[var(--landing-text-tertiary)]">$</span>
      <span className="font-mono text-sm text-[var(--landing-text)]">
        npx <span className="text-orange-500">memctl</span>
      </span>
      <button
        onClick={handleCopy}
        className="ml-2 text-[var(--landing-text-tertiary)] transition-colors hover:text-[var(--landing-text)]"
        aria-label="Copy install command"
      >
        {copied ? (
          <Check className="h-4 w-4 text-emerald-500" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
