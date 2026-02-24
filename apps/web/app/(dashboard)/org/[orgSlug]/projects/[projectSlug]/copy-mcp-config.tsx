"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface CopyMcpConfigProps {
  config: string;
}

export function CopyMcpConfig({ config }: CopyMcpConfigProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(config);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-3 right-3 rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] p-2 text-[var(--landing-text-tertiary)] transition-colors hover:text-[#F97316]"
    >
      {copied ? (
        <Check className="h-4 w-4 text-[#F97316]" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </button>
  );
}
