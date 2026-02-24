import Link from "next/link";

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Diagonal hatching */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[repeating-linear-gradient(-45deg,transparent,transparent_5px,var(--color-border)_5px,var(--color-border)_6px)] [mask-image:radial-gradient(ellipse_40%_40%_at_50%_50%,black_50%,transparent_100%)] opacity-[0.4]"
        aria-hidden="true"
      />
      {/* Indigo glow */}
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[350px] w-[350px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/[0.06] blur-[100px]"
        aria-hidden="true"
      />
      <div className="text-center">
        <h1 className="text-primary mb-2 font-mono text-6xl font-bold">404</h1>
        <p className="text-muted-foreground mb-6 font-mono text-sm">
          Page not found
        </p>
        <Link
          href="/"
          className="border-border hover:bg-muted border px-6 py-3 font-mono text-sm transition-colors"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
