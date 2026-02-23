"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
  expiresAt: string;
  createdAt: string;
}

interface InviteMemberDialogProps {
  orgSlug: string;
  pendingInvitations: PendingInvitation[];
  dailyUsed: number;
  dailyLimit: number | null; // null = unlimited (self-hosted)
}

function formatTimeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "expired";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 24) return `${hours}h left`;
  const days = Math.ceil(hours / 24);
  return `${days}d left`;
}

export function InviteMemberDialog({
  orgSlug,
  pendingInvitations: initialInvitations,
  dailyUsed: initialDailyUsed,
  dailyLimit,
}: InviteMemberDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingInvitations, setPendingInvitations] = useState(initialInvitations);
  const [dailyUsed, setDailyUsed] = useState(initialDailyUsed);

  const handleInvite = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/v1/orgs/${orgSlug}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role, expiresInDays }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to send invitation");
        return;
      }

      setDailyUsed((prev) => prev + 1);

      if (data.added) {
        // User already had an account and was directly added
        setSuccess(`${data.invitation.email} has been added to the organization.`);
      } else {
        // Pending invitation created
        setPendingInvitations((prev) => [
          ...prev,
          {
            id: data.invitation.id,
            email: data.invitation.email,
            role: data.invitation.role,
            expiresAt: data.invitation.expiresAt,
            createdAt: new Date().toISOString(),
          },
        ]);
        setSuccess(`Invitation sent to ${data.invitation.email}.`);
      }
      setEmail("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (invitationId: string) => {
    try {
      const res = await fetch(`/api/v1/orgs/${orgSlug}/invitations`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId }),
      });

      if (res.ok) {
        setPendingInvitations((prev) => prev.filter((i) => i.id !== invitationId));
        toast.success("Invitation revoked");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to revoke invitation");
      }
    } catch {
      toast.error("Network error");
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

          <div className="flex items-center gap-2">
            <label className="font-mono text-xs text-[var(--landing-text-secondary)]">
              Expires in
            </label>
            <select
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(Number(e.target.value))}
              className="rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg)] px-2 py-1 font-mono text-xs text-[var(--landing-text)]"
            >
              <option value={1}>1 day</option>
              <option value={2}>2 days</option>
              <option value={3}>3 days</option>
              <option value={5}>5 days</option>
              <option value={7}>7 days</option>
            </select>
          </div>

          {error && (
            <p className="font-mono text-xs text-red-500">{error}</p>
          )}

          {success && (
            <p className="font-mono text-xs text-green-500">{success}</p>
          )}

          <Button
            onClick={handleInvite}
            disabled={loading || !email.trim() || (dailyLimit !== null && dailyUsed >= dailyLimit)}
            className="w-full bg-[#F97316] text-white hover:bg-[#EA580C]"
          >
            {loading ? "Inviting..." : "Send invitation"}
          </Button>

          {dailyLimit !== null && (
            <p className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">
              {dailyUsed} / {dailyLimit} invitations used today
            </p>
          )}

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
                    <span className="shrink-0 font-mono text-[9px] text-[#F97316]">
                      <Clock className="mr-0.5 inline h-2.5 w-2.5" />
                      {formatTimeLeft(invite.expiresAt)}
                    </span>
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
