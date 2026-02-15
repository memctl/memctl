"use client";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm border border-border p-8">
        <h1 className="mb-2 font-mono text-2xl font-bold">
          mem<span className="text-primary">/</span>ctl
        </h1>
        <p className="mb-8 font-mono text-sm text-muted-foreground">
          Sign in to your account
        </p>
        <Button
          className="w-full"
          onClick={() =>
            authClient.signIn.social({
              provider: "github",
              callbackURL: "/onboarding",
            })
          }
        >
          Sign in with GitHub
        </Button>
        <p className="mt-4 font-mono text-xs text-muted-foreground">
          We only request your email address.
        </p>
      </div>
    </div>
  );
}
