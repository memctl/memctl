"use client";

import * as React from "react";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { type DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DateRangePickerProps {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
}

const PRESETS: Array<{ label: string; days: number }> = [
  { label: "24h", days: 1 },
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
];

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const hasValue = value?.from || value?.to;

  const applyPreset = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    onChange({ from, to });
    setOpen(false);
  };

  const formatLabel = () => {
    if (!value?.from) return "Date";
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (!value.to) return fmt(value.from);
    return `${fmt(value.from)} – ${fmt(value.to)}`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[10px] font-medium transition-all ${
            hasValue
              ? "bg-[#F97316]/10 text-[#F97316] ring-1 ring-[#F97316]/20"
              : "bg-[var(--landing-surface-2)]/50 text-[var(--landing-text-tertiary)] hover:bg-[var(--landing-surface-2)] hover:text-[var(--landing-text)]"
          }`}
        >
          <CalendarIcon className="h-3 w-3" />
          <span>{formatLabel()}</span>
          {hasValue && (
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(undefined);
              }}
              className="ml-0.5 rounded-full p-0.5 hover:bg-[#F97316]/20 transition-colors"
            >
              <X className="h-2.5 w-2.5" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto border-[var(--landing-border)] bg-[var(--landing-surface)] p-0"
        align="end"
      >
        <div className="flex items-center gap-1.5 border-b border-[var(--landing-border)] px-3 py-2">
          <span className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">Quick:</span>
          {PRESETS.map((preset) => (
            <button
              key={preset.days}
              onClick={() => applyPreset(preset.days)}
              className="rounded-md bg-[var(--landing-surface-2)] px-2 py-0.5 font-mono text-[10px] font-medium text-[var(--landing-text-tertiary)] transition-colors hover:bg-[var(--landing-surface-2)]/80 hover:text-[var(--landing-text)]"
            >
              {preset.label}
            </button>
          ))}
        </div>
        <Calendar
          mode="range"
          selected={value}
          onSelect={(range) => {
            onChange(range);
            if (range?.from && range?.to) setOpen(false);
          }}
          numberOfMonths={typeof window !== "undefined" && window.innerWidth >= 768 ? 2 : 1}
          disabled={{ after: new Date() }}
        />
      </PopoverContent>
    </Popover>
  );
}
