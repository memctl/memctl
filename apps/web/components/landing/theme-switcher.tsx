"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="h-8 w-16" />;

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="inline-flex items-center gap-2 rounded-full border border-[var(--landing-border)] bg-[var(--landing-surface)] px-3 py-1.5 text-xs font-medium text-[var(--landing-text-secondary)] transition-all hover:border-[var(--landing-border-hover)] hover:text-[var(--landing-text)]"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? (
        <>
          <Sun className="h-3.5 w-3.5" />
          Light
        </>
      ) : (
        <>
          <Moon className="h-3.5 w-3.5" />
          Dark
        </>
      )}
    </button>
  );
}
