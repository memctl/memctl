"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { authClient } from "@/lib/auth-client";
import {
  User,
  Github,
  Monitor,
  Smartphone,
  Globe,
  Loader2,
  Shield,
  LogOut,
  AlertTriangle,
} from "lucide-react";

interface SessionInfo {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

interface AccountSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    name: string;
    email: string;
    image?: string | null;
  };
}

function parseUserAgent(ua: string | null): {
  browser: string;
  os: string;
  isMobile: boolean;
} {
  if (!ua) return { browser: "Unknown", os: "Unknown", isMobile: false };

  const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua);

  let browser = "Unknown";
  if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Safari")) browser = "Safari";
  else if (ua.includes("curl")) browser = "curl";

  let os = "Unknown";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

  return { browser, os, isMobile };
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export function AccountSettingsDialog({
  open,
  onOpenChange,
  user,
}: AccountSettingsDialogProps) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [saving, setSaving] = useState(false);
  const [sessionsList, setSessionsList] = useState<SessionInfo[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [revokingAll, setRevokingAll] = useState(false);

  const initials = user.name
    ? user.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user.email[0].toUpperCase();

  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const res = await fetch("/api/v1/user/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessionsList(data.sessions);
      }
    } catch {
      // silent
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setName(user.name);
      fetchSessions();
    }
  }, [open, user.name, fetchSessions]);

  const handleSaveName = async () => {
    if (name.trim() === user.name) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to update name");
      } else {
        toast.success("Name updated");
        router.refresh();
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeAll = async () => {
    setRevokingAll(true);
    try {
      const res = await fetch("/api/v1/user/sessions", { method: "DELETE" });
      if (res.ok) {
        const data = await res.json();
        const count = data.result?.revoked ?? 0;
        toast.success(
          count > 0
            ? `Revoked ${count} session${count === 1 ? "" : "s"}`
            : "No other sessions to revoke",
        );
        fetchSessions();
      } else {
        toast.error("Failed to revoke sessions");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setRevokingAll(false);
    }
  };

  const handleSignOutEverywhere = async () => {
    setRevokingAll(true);
    try {
      await fetch("/api/v1/user/sessions", { method: "DELETE" });
      await authClient.signOut();
      router.push("/");
    } catch {
      toast.error("Network error");
      setRevokingAll(false);
    }
  };

  const currentSession = sessionsList.find((s) => s.isCurrent);
  const otherSessions = sessionsList.filter((s) => !s.isCurrent);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[85vh] overflow-y-auto border-[var(--landing-border)] bg-[var(--landing-surface)] p-0 font-mono sm:max-w-lg"
        showCloseButton={false}
      >
        <DialogHeader className="border-b border-[var(--landing-border)] px-5 py-3.5">
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-[var(--landing-text)]">
            <User className="h-3.5 w-3.5 text-[#F97316]" />
            Account Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-0">
          {/* Profile Section */}
          <div className="border-b border-[var(--landing-border)] px-5 py-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-widest text-[var(--landing-text-tertiary)]">
                Profile
              </span>
            </div>

            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="shrink-0">
                <Avatar className="h-14 w-14 border-2 border-[var(--landing-border)]">
                  {user.image && (
                    <AvatarImage src={user.image} alt={user.name} />
                  )}
                  <AvatarFallback className="bg-[var(--landing-surface-2)] text-sm font-medium text-[var(--landing-text-secondary)]">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </div>

              <div className="min-w-0 flex-1 space-y-3">
                {/* Name field */}
                <div>
                  <label className="mb-1 block text-[11px] text-[var(--landing-text-tertiary)]">
                    Display name
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-8 border-[var(--landing-border)] bg-[var(--landing-bg)] text-xs text-[var(--landing-text)] placeholder:text-[var(--landing-text-tertiary)]"
                      placeholder="Your name"
                    />
                    <Button
                      onClick={handleSaveName}
                      disabled={saving || name.trim() === user.name}
                      size="sm"
                      className="h-8 shrink-0 bg-[#F97316] px-3 text-[11px] text-white hover:bg-[#EA580C] disabled:opacity-40"
                    >
                      {saving ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "Save"
                      )}
                    </Button>
                  </div>
                </div>

                {/* Email (read-only) */}
                <div>
                  <label className="mb-1 block text-[11px] text-[var(--landing-text-tertiary)]">
                    Email
                  </label>
                  <div className="flex h-8 items-center rounded-md border border-[var(--landing-border)] bg-[var(--landing-surface-2)] px-3 text-xs text-[var(--landing-text-tertiary)]">
                    {user.email}
                  </div>
                </div>
              </div>
            </div>

            {/* Avatar source info */}
            <div className="mt-3 flex items-center gap-1.5 rounded-md bg-[var(--landing-surface-2)] px-3 py-2">
              <Github className="h-3 w-3 shrink-0 text-[var(--landing-text-tertiary)]" />
              <span className="text-[11px] text-[var(--landing-text-tertiary)]">
                Avatar synced from your GitHub profile.{" "}
                <a
                  href="https://github.com/settings/profile"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#F97316] hover:underline"
                >
                  Change on GitHub
                </a>
              </span>
            </div>
          </div>

          {/* Sessions Section */}
          <div className="border-b border-[var(--landing-border)] px-5 py-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-3 w-3 text-[var(--landing-text-tertiary)]" />
                <span className="text-[11px] font-medium uppercase tracking-widest text-[var(--landing-text-tertiary)]">
                  Active Sessions
                </span>
              </div>
              {otherSessions.length > 0 && (
                <Button
                  onClick={handleRevokeAll}
                  disabled={revokingAll}
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px] text-red-400 hover:bg-red-500/10 hover:text-red-300"
                >
                  {revokingAll ? (
                    <Loader2 className="mr-1 h-2.5 w-2.5 animate-spin" />
                  ) : (
                    <LogOut className="mr-1 h-2.5 w-2.5" />
                  )}
                  Revoke all others
                </Button>
              )}
            </div>

            {loadingSessions ? (
              <div className="flex items-center justify-center py-6">
                <div className="flex items-center gap-2 text-[11px] text-[var(--landing-text-tertiary)]">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading sessions...
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <AnimatePresence mode="popLayout">
                  {/* Current session first */}
                  {currentSession && (
                    <SessionRow
                      key={currentSession.id}
                      session={currentSession}
                    />
                  )}
                  {otherSessions.map((session) => (
                    <SessionRow key={session.id} session={session} />
                  ))}
                </AnimatePresence>
                {sessionsList.length === 0 && !loadingSessions && (
                  <div className="py-4 text-center text-[11px] text-[var(--landing-text-tertiary)]">
                    No active sessions found
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Danger Zone */}
          <div className="px-5 py-4">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-3 w-3 text-red-400" />
              <span className="text-[11px] font-medium uppercase tracking-widest text-red-400">
                Danger Zone
              </span>
            </div>

            <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-[var(--landing-text)]">
                    Sign out everywhere
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--landing-text-tertiary)]">
                    Revoke all sessions and sign out of this device.
                  </p>
                </div>
                <Button
                  onClick={handleSignOutEverywhere}
                  disabled={revokingAll}
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 border border-red-500/30 bg-red-500/10 px-3 text-[11px] text-red-400 hover:bg-red-500/20 hover:text-red-300"
                >
                  {revokingAll ? (
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  ) : (
                    <LogOut className="mr-1.5 h-3 w-3" />
                  )}
                  Sign out all
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SessionRow({ session }: { session: SessionInfo }) {
  const parsed = parseUserAgent(session.userAgent);
  const DeviceIcon = parsed.isMobile ? Smartphone : Monitor;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.15 }}
      className="flex items-center gap-3 rounded-md bg-[var(--landing-surface-2)] px-3 py-2.5"
    >
      <DeviceIcon className="h-3.5 w-3.5 shrink-0 text-[var(--landing-text-tertiary)]" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-xs text-[var(--landing-text)]">
            {parsed.browser} on {parsed.os}
          </span>
          {session.isCurrent && (
            <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-medium text-emerald-400">
              current
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-[var(--landing-text-tertiary)]">
          {session.ipAddress && (
            <>
              <Globe className="h-2.5 w-2.5" />
              <span>{session.ipAddress}</span>
              <span className="h-2 w-px bg-[var(--landing-border)]" />
            </>
          )}
          <span>{formatRelativeTime(session.createdAt)}</span>
        </div>
      </div>
    </motion.div>
  );
}
