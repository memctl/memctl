"use client";

import { useEffect, useState } from "react";

export function TypingTagline({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, 45);
    return () => clearInterval(interval);
  }, [text]);

  return (
    <p className="font-mono text-sm text-[var(--landing-text-secondary)]">
      <span className="text-[#F97316]">$</span> <span>{displayed}</span>
      {!done && <span className="terminal-cursor" />}
    </p>
  );
}
