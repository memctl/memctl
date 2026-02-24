"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/dashboard/shared/page-header";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Key, Copy, Check, AlertTriangle } from "lucide-react";

interface Token {
  id: string;
  name: string;
  userId: string;
  userName: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export default function TokensPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const [tokens, setTokens] = useState<Token[]>([]);
  const [role, setRole] = useState<string>("member");
  const [showAll, setShowAll] = useState(false);
  const [newTokenName, setNewTokenName] = useState("");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [configCopied, setConfigCopied] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<Token | null>(null);
  const [revoking, setRevoking] = useState(false);

  const fetchTokens = useCallback(async () => {
    try {
      const url = showAll
        ? `/api/v1/tokens?org=${orgSlug}&all=true`
        : `/api/v1/tokens?org=${orgSlug}`;
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to load tokens");
        return;
      }
      const data = await res.json();
      setTokens(data.tokens ?? []);
      if (data.role) setRole(data.role);
    } catch {
      toast.error("Network error loading tokens");
    }
  }, [orgSlug, showAll]);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

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
      if (!res.ok) {
        toast.error(data.error ?? "Failed to create token");
      } else if (data.token) {
        setCreatedToken(data.token);
        setNewTokenName("");
        toast.success("Token created");
        await fetchTokens();
      }
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      const res = await fetch(
        `/api/v1/tokens?id=${revokeTarget.id}&org=${orgSlug}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to revoke token");
      } else {
        setTokens(tokens.filter((t) => t.id !== revokeTarget.id));
        toast.success("Token revoked");
      }
      setRevokeTarget(null);
    } catch {
      toast.error("Network error");
    } finally {
      setRevoking(false);
    }
  };

  const handleCopy = async () => {
    if (createdToken) {
      await navigator.clipboard.writeText(createdToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const mcpConfig = JSON.stringify(
    {
      mcpServers: {
        memctl: {
          command: "npx",
          args: ["memctl"],
          env: {
            MEMCTL_TOKEN: "<your-token>",
            MEMCTL_ORG: orgSlug,
            MEMCTL_PROJECT: "<project-slug>",
          },
        },
      },
    },
    null,
    2,
  );

  const isOwner = role === "owner";

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="API Tokens"
        description="Manage tokens for MCP server authentication."
      />

      {/* Create token */}
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

      {/* Two-column: token list + quick start */}
      <div className="mt-10 grid gap-8 lg:grid-cols-5">
        {/* Token list — takes 3 cols */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-[var(--landing-text)]">
              {showAll ? "All organization tokens" : "Your tokens"}
            </h2>
            {isOwner && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="text-xs text-[#F97316] hover:underline"
              >
                {showAll ? "Show only mine" : "Show all tokens"}
              </button>
            )}
          </div>
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
                      {showAll && token.userName && (
                        <span className="text-[var(--landing-text-secondary)]">
                          {token.userName} &middot;{" "}
                        </span>
                      )}
                      Created {new Date(token.createdAt).toLocaleDateString()}
                      {token.lastUsedAt
                        ? ` · Last used ${new Date(token.lastUsedAt).toLocaleDateString()}`
                        : " · Never used"}
                    </p>
                  </div>
                  <button
                    onClick={() => setRevokeTarget(token)}
                    className="text-xs text-[var(--landing-text-tertiary)] transition-colors hover:text-red-500"
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Start — takes 2 cols */}
        <div className="lg:col-span-2">
          <h2 className="text-sm font-medium text-[var(--landing-text)]">
            Quick Start
          </h2>
          <div className="mt-4 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-5">
            <p className="text-xs text-[var(--landing-text-secondary)]">
              Add this to your MCP client configuration:
            </p>
            <div className="relative mt-3">
              <pre className="overflow-x-auto rounded-lg bg-[var(--landing-bg)] p-3 text-xs leading-relaxed text-[var(--landing-text)]">
                {mcpConfig}
              </pre>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(mcpConfig);
                  setConfigCopied(true);
                  setTimeout(() => setConfigCopied(false), 2000);
                }}
                className="absolute right-2 top-2 rounded-md p-1.5 text-[var(--landing-text-tertiary)] transition-colors hover:text-[#F97316]"
              >
                {configCopied ? (
                  <Check className="size-4 text-[#F97316]" />
                ) : (
                  <Copy className="size-4" />
                )}
              </button>
            </div>
            <div className="mt-3 rounded-lg border border-[var(--landing-border)] bg-[var(--landing-bg)] p-3">
              <p className="text-xs font-medium text-[var(--landing-text-secondary)]">
                Or authenticate via the CLI instead:
              </p>
              <pre className="mt-1.5 text-xs text-[#F97316]">
                npx memctl auth
              </pre>
              <p className="mt-1.5 text-[10px] text-[var(--landing-text-tertiary)]">
                This logs you in interactively and stores the token locally — no
                need to add it to your .mcp.json.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Revoke confirmation dialog */}
      <Dialog
        open={!!revokeTarget}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
      >
        <DialogContent className="border-[var(--landing-border)] bg-[var(--landing-surface)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[var(--landing-text)]">
              <AlertTriangle className="size-5 text-red-500" />
              Revoke token
            </DialogTitle>
            <DialogDescription className="text-[var(--landing-text-secondary)]">
              Are you sure you want to revoke{" "}
              <span className="font-medium text-[var(--landing-text)]">
                {revokeTarget?.name}
              </span>
              ? This action cannot be undone. Any integration using this token
              will immediately lose access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRevokeTarget(null)}
              className="border-[var(--landing-border)] text-[var(--landing-text-secondary)]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRevoke}
              disabled={revoking}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {revoking ? "Revoking..." : "Revoke token"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
