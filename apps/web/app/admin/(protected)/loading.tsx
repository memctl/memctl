import { Loader2 } from "lucide-react";

export default function AdminLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#F97316]" />
        <span className="font-mono text-xs text-[var(--landing-text-tertiary)]">
          Loading...
        </span>
      </div>
    </div>
  );
}
