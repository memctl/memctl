"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Diagonal hatching */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[repeating-linear-gradient(-45deg,transparent,transparent_5px,var(--color-border)_5px,var(--color-border)_6px)] opacity-[0.4] [mask-image:radial-gradient(ellipse_40%_40%_at_50%_50%,black_50%,transparent_100%)]"
        aria-hidden="true"
      />
      {/* Red-tinted glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[350px] w-[350px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500/[0.05] blur-[100px]"
        aria-hidden="true"
      />
      <div className="text-center">
        <h1 className="text-destructive mb-2 font-mono text-6xl font-bold">
          500
        </h1>
        <p className="text-muted-foreground mb-6 font-mono text-sm">
          Something went wrong
        </p>
        <button
          onClick={reset}
          className="border-border hover:bg-muted border px-6 py-3 font-mono text-sm transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
