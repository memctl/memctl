import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="mb-2 font-mono text-6xl font-bold text-primary">404</h1>
        <p className="mb-6 font-mono text-sm text-muted-foreground">
          Page not found
        </p>
        <Link
          href="/"
          className="border border-border px-6 py-3 font-mono text-sm transition-colors hover:bg-muted"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
