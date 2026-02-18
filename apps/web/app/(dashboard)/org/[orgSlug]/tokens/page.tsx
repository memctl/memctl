"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/dashboard/shared/page-header";
import { SectionLabel } from "@/components/dashboard/shared/section-label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Key, Copy, Check } from "lucide-react";

interface Token {
  id: string;
  name: string;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export default function TokensPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const [tokens, setTokens] = useState<Token[]>([]);
  const [newTokenName, setNewTokenName] = useState("");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/tokens?org=${orgSlug}`)
      .then((r) => r.json())
      .then((data) => setTokens(data.tokens ?? []));
  }, [orgSlug]);

  const handleCreate = async () => {
    if (!newTokenName) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/tokens?org=${orgSlug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTokenName }),
      });
      const data = await res.json();
      if (data.token) {
        setCreatedToken(data.token);
        setNewTokenName("");
        const listRes = await fetch(`/api/v1/tokens?org=${orgSlug}`);
        const listData = await listRes.json();
        setTokens(listData.tokens ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (id: string) => {
    await fetch(`/api/v1/tokens?id=${id}`, { method: "DELETE" });
    setTokens(tokens.filter((t) => t.id !== id));
  };

  const handleCopy = async () => {
    if (createdToken) {
      await navigator.clipboard.writeText(createdToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-3xl">
      <PageHeader
        badge="Authentication"
        title="API Tokens"
        description="Manage API tokens for MCP server authentication."
      />

      {/* Create Token */}
      <div className="dash-card glass-border relative mb-8 p-6">
        <h2 className="mb-4 font-mono text-sm font-bold text-[var(--landing-text)]">
          Create Token
        </h2>
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-[var(--landing-text-secondary)]">
              Token Name
            </Label>
            <Input
              value={newTokenName}
              onChange={(e) => setNewTokenName(e.target.value)}
              placeholder="e.g. Claude Code"
              className="mt-1 border-[var(--landing-border)] bg-[var(--landing-surface)] text-[var(--landing-text)] focus:border-[#F97316] focus:ring-[#F97316]"
            />
          </div>
          <Button
            onClick={handleCreate}
            disabled={loading || !newTokenName}
            className="bg-[#F97316] text-white hover:bg-[#FB923C]"
          >
            {loading ? "Creating..." : "Create Token"}
          </Button>

          {createdToken && (
            <div className="glass-border-always glow-orange relative overflow-hidden rounded-xl bg-[var(--landing-code-bg)] p-4">
              <p className="mb-2 font-mono text-xs font-medium text-[#F97316]">
                Copy this token now. It won&apos;t be shown again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all font-mono text-xs text-[var(--landing-text)]">
                  {createdToken}
                </code>
                <button
                  onClick={handleCopy}
                  className="shrink-0 rounded-md border border-[var(--landing-border)] p-1.5 text-[var(--landing-text-tertiary)] transition-colors hover:text-[#F97316]"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-[#F97316]" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active Tokens */}
      <SectionLabel>Active Tokens</SectionLabel>
      <div className="dash-card mt-3 overflow-hidden">
        {tokens.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Key className="mb-3 h-8 w-8 text-[var(--landing-text-tertiary)]" />
            <p className="font-mono text-sm text-[var(--landing-text-tertiary)]">
              No tokens yet
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-[var(--landing-border)] bg-[var(--landing-code-bg)] hover:bg-[var(--landing-code-bg)]">
                <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Name
                </TableHead>
                <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Created
                </TableHead>
                <TableHead className="font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Last Used
                </TableHead>
                <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.map((token) => (
                <TableRow
                  key={token.id}
                  className="border-[var(--landing-border)]"
                >
                  <TableCell className="font-mono text-sm font-medium text-[var(--landing-text)]">
                    {token.name}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-[var(--landing-text-tertiary)]">
                    {new Date(token.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-[var(--landing-text-tertiary)]">
                    {token.lastUsedAt
                      ? new Date(token.lastUsedAt).toLocaleDateString()
                      : "Never"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRevoke(token.id)}
                    >
                      Revoke
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
