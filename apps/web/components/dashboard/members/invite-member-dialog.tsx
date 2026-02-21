"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserPlus, X, Mail, Clock } from "lucide-react";

interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}

interface InviteMemberDialogProps {
  orgSlug: string;
  pendingInvitations: PendingInvitation[];
}

export function InviteMemberDialog({
  orgSlug,
  pendingInvitations: initialInvitations,
}: InviteMemberDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingInvitations, setPendingInvitations] = useState(initialInvitations);

  const handleInvite = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/orgs/${orgSlug}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to send invitation");
        return;
      }

      setPendingInvitations((prev) => [
        ...prev,
        {
          id: data.invitation.id,
          email: data.invitation.email,
          role: data.invitation.role,
          createdAt: new Date().toISOString(),
        },
      ]);
      setEmail("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (invitationId: string) => {
    const res = await fetch(`/api/v1/orgs/${orgSlug}/invitations`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invitationId }),
    });

    if (res.ok) {
      setPendingInvitations((prev) => prev.filter((i) => i.id !== invitationId));
      router.refresh();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="gap-1.5 bg-[#F97316] text-white hover:bg-[#EA580C]"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Invite
        </Button>
      </DialogTrigger>
      <DialogContent className="border-[var(--landing-border)] bg-[var(--landing-surface)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono text-[var(--landing-text)]">
            Invite member
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              className="flex-1 border-[var(--landing-border)] bg-[var(--landing-bg)] font-mono text-sm text-[var(--landing-text)]"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "member" | "admin")}
              className="rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg)] px-2 font-mono text-xs text-[var(--landing-text)]"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {error && (
            <p className="font-mono text-xs text-red-500">{error}</p>
          )}

          <Button
            onClick={handleInvite}
            disabled={loading || !email.trim()}
            className="w-full bg-[#F97316] text-white hover:bg-[#EA580C]"
          >
            {loading ? "Inviting..." : "Send invitation"}
          </Button>

          {pendingInvitations.length > 0 && (
            <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[var(--landing-text-tertiary)]">
                Pending invitations
              </p>
              <div className="space-y-1.5">
                {pendingInvitations.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center gap-2 rounded-lg border border-[var(--landing-border)] bg-[var(--landing-bg)] px-3 py-2"
                  >
                    <Mail className="h-3.5 w-3.5 shrink-0 text-[var(--landing-text-tertiary)]" />
                    <span className="flex-1 truncate font-mono text-xs text-[var(--landing-text-secondary)]">
                      {invite.email}
                    </span>
                    <span className="shrink-0 rounded bg-[var(--landing-surface-2)] px-1.5 py-0.5 font-mono text-[9px] capitalize text-[var(--landing-text-tertiary)]">
                      {invite.role}
                    </span>
                    <Clock className="h-3 w-3 shrink-0 text-[#F97316]" />
                    <button
                      onClick={() => handleRevoke(invite.id)}
                      className="shrink-0 rounded p-0.5 text-[var(--landing-text-tertiary)] transition-colors hover:bg-red-500/10 hover:text-red-500"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">
            Invited users can sign in with GitHub. They&apos;ll be automatically added to this organization.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
