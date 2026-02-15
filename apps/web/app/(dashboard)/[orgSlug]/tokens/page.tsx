"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";

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
        // Refresh list
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

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 font-mono text-2xl font-bold">API Tokens</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Create Token</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Token Name</Label>
            <Input
              value={newTokenName}
              onChange={(e) => setNewTokenName(e.target.value)}
              placeholder="e.g. Claude Code"
            />
          </div>
          <Button onClick={handleCreate} disabled={loading || !newTokenName}>
            {loading ? "Creating..." : "Create Token"}
          </Button>

          {createdToken && (
            <div className="mt-4 border border-primary bg-muted p-4">
              <p className="mb-2 font-mono text-xs text-primary">
                Copy this token now. It won&apos;t be shown again.
              </p>
              <code className="block break-all font-mono text-xs">
                {createdToken}
              </code>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="border border-border">
        <div className="border-b border-border bg-muted px-4 py-3">
          <span className="font-mono text-sm font-bold">Active Tokens</span>
        </div>
        {tokens.length === 0 ? (
          <div className="p-8 text-center font-mono text-sm text-muted-foreground">
            No tokens yet
          </div>
        ) : (
          tokens.map((token, i) => (
            <div
              key={token.id}
              className={`flex items-center justify-between p-4 ${i < tokens.length - 1 ? "border-b border-border" : ""}`}
            >
              <div>
                <div className="font-mono text-sm font-bold">{token.name}</div>
                <div className="font-mono text-xs text-muted-foreground">
                  Created {new Date(token.createdAt).toLocaleDateString()}
                  {token.lastUsedAt &&
                    ` · Last used ${new Date(token.lastUsedAt).toLocaleDateString()}`}
                </div>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleRevoke(token.id)}
              >
                Revoke
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
