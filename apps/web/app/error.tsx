"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="mb-2 font-mono text-6xl font-bold text-destructive">
          500
        </h1>
        <p className="mb-6 font-mono text-sm text-muted-foreground">
          Something went wrong
        </p>
        <button
          onClick={reset}
          className="border border-border px-6 py-3 font-mono text-sm transition-colors hover:bg-muted"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
