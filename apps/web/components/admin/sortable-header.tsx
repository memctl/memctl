"use client";

import { TableHead } from "@/components/ui/table";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

interface SortableHeaderProps {
  label: string;
  field: string;
  currentSort: string;
  currentOrder: "asc" | "desc";
  onSort: (field: string) => void;
  className?: string;
}

export function SortableHeader({
  label,
  field,
  currentSort,
  currentOrder,
  onSort,
  className,
}: SortableHeaderProps) {
  const isActive = currentSort === field;

  return (
    <TableHead
      className={`group cursor-pointer font-mono text-[11px] tracking-wider text-[var(--landing-text-tertiary)] uppercase select-none ${className ?? ""}`}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {isActive ? (
          currentOrder === "asc" ? (
            <ChevronUp className="h-3.5 w-3.5 text-[#F97316]" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-[#F97316]" />
          )
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-0 group-hover:opacity-50" />
        )}
      </div>
    </TableHead>
  );
}
