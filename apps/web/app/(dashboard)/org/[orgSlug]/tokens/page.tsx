"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/dashboard/shared/page-header";
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
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="API Tokens"
        description="Manage tokens for MCP server authentication."
      />

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Label className="text-xs text-[var(--landing-text-secondary)]">
            Token name
          </Label>
          <Input
            value={newTokenName}
            onChange={(e) => setNewTokenName(e.target.value)}
            placeholder="e.g. Claude Code"
            className="mt-1.5 border-[var(--landing-border)] bg-[var(--landing-bg)] text-[var(--landing-text)]"
          />
        </div>
        <Button
          onClick={handleCreate}
          disabled={loading || !newTokenName}
          className="bg-[#F97316] text-white hover:bg-[#EA580C]"
        >
          {loading ? "Creating..." : "Create token"}
        </Button>
      </div>

      {createdToken && (
        <div className="mt-4 rounded-lg border border-[#F97316]/20 bg-[#F97316]/5 p-4">
          <p className="text-xs font-medium text-[#F97316]">
            Copy this token now. It won&apos;t be shown again.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 break-all text-xs text-[var(--landing-text)]">
              {createdToken}
            </code>
            <button
              onClick={handleCopy}
              className="shrink-0 rounded-md p-1.5 text-[var(--landing-text-tertiary)] transition-colors hover:text-[#F97316]"
            >
              {copied ? (
                <Check className="size-4 text-[#F97316]" />
              ) : (
                <Copy className="size-4" />
              )}
            </button>
          </div>
        </div>
      )}

      <div className="mt-10">
        <h2 className="text-sm font-medium text-[var(--landing-text)]">
          Active tokens
        </h2>
        {tokens.length === 0 ? (
          <div className="mt-6 flex flex-col items-center py-12 text-center">
            <Key className="mb-3 size-6 text-[var(--landing-text-tertiary)]" />
            <p className="text-sm text-[var(--landing-text-tertiary)]">
              No tokens yet
            </p>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-[var(--landing-border)]">
            {tokens.map((token) => (
              <div
                key={token.id}
                className="flex items-center justify-between py-4"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--landing-text)]">
                    {token.name}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--landing-text-tertiary)]">
                    Created{" "}
                    {new Date(token.createdAt).toLocaleDateString()}
                    {token.lastUsedAt
                      ? ` · Last used ${new Date(token.lastUsedAt).toLocaleDateString()}`
                      : " · Never used"}
                  </p>
                </div>
                <button
                  onClick={() => handleRevoke(token.id)}
                  className="text-xs text-[var(--landing-text-tertiary)] transition-colors hover:text-red-500"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
