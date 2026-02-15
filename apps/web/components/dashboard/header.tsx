"use client";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

interface HeaderProps {
  user: {
    name: string;
    email: string;
    image?: string | null;
  };
}

export function Header({ user }: HeaderProps) {
  const router = useRouter();

  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-6">
      <div />
      <div className="flex items-center gap-4">
        <span className="font-mono text-xs text-muted-foreground">
          {user.email}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await authClient.signOut();
            router.push("/");
          }}
        >
          Sign out
        </Button>
      </div>
    </header>
  );
}
