"use client";

import * as React from "react";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerProps {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const formatLabel = () => {
    if (!value) return placeholder;
    return value.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          className={`inline-flex w-full items-center gap-2 rounded-md border border-[var(--landing-border)] bg-transparent px-3 py-1.5 font-mono text-[11px] transition-colors hover:bg-[var(--landing-surface-2)] ${
            value
              ? "text-[var(--landing-text)]"
              : "text-[var(--landing-text-tertiary)]"
          } ${className ?? ""}`}
        >
          <CalendarIcon className="h-3 w-3 shrink-0 text-[var(--landing-text-tertiary)]" />
          <span className="flex-1 text-left">{formatLabel()}</span>
          {value && (
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(undefined);
              }}
              className="rounded-full p-0.5 text-[var(--landing-text-tertiary)] hover:text-[var(--landing-text)] transition-colors"
            >
              <X className="h-2.5 w-2.5" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto border-[var(--landing-border)] bg-[var(--landing-surface)] p-0"
        align="start"
      >
        <Calendar
          mode="single"
          selected={value}
          onSelect={(date) => {
            onChange(date);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
