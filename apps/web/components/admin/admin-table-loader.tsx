import { Loader2 } from "lucide-react";
import { TableRow, TableCell } from "@/components/ui/table";

export function AdminTableLoader({ colSpan }: { colSpan: number }) {
  return (
    <TableRow className="border-[var(--landing-border)]">
      <TableCell colSpan={colSpan} className="py-12">
        <div className="flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-[#F97316]" />
          <span className="font-mono text-xs text-[var(--landing-text-tertiary)]">
            Loading...
          </span>
        </div>
      </TableCell>
    </TableRow>
  );
}
