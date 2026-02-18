"use client";

import { useEffect, useState } from "react";

interface Line {
  prefix: string;
  prefixColor: string;
  text: string;
}

export function TerminalLines({
  lines,
  lineDelay = 600,
  charSpeed = 35,
  pauseAfter = 3500,
}: {
  lines: Line[];
  lineDelay?: number;
  charSpeed?: number;
  pauseAfter?: number;
}) {
  const [lineIdx, setLineIdx] = useState(-1);
  const [charIdx, setCharIdx] = useState(0);
  const [done, setDone] = useState(false);

  // Initial delay before typing starts
  useEffect(() => {
    const t = setTimeout(() => setLineIdx(0), 800);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (lineIdx < 0) return;

    // All lines shown
    if (lineIdx >= lines.length) {
      setDone(true);
      const t = setTimeout(() => {
        setLineIdx(-1);
        setCharIdx(0);
        setDone(false);
        // Restart after brief reset
        setTimeout(() => setLineIdx(0), 400);
      }, pauseAfter);
      return () => clearTimeout(t);
    }

    const line = lines[lineIdx]!;

    // Typing current line
    if (charIdx < line.text.length) {
      const t = setTimeout(
        () => setCharIdx((c) => c + 1),
        charSpeed + Math.random() * 25,
      );
      return () => clearTimeout(t);
    }

    // Line complete, move to next after delay
    const t = setTimeout(() => {
      setLineIdx((l) => l + 1);
      setCharIdx(0);
    }, lineDelay);
    return () => clearTimeout(t);
  }, [lineIdx, charIdx, lines, lineDelay, charSpeed, pauseAfter]);

  return (
    <>
      {lines.map((line, i) => {
        if (i > lineIdx && !done) return null;

        const isTyping = i === lineIdx && !done;
        const displayText = isTyping
          ? line.text.slice(0, charIdx)
          : i < lineIdx || done
            ? line.text
            : "";

        return (
          <p key={i} className="text-[var(--landing-text-tertiary)]">
            <span className={line.prefixColor}>{line.prefix}</span>
            {displayText}
            {isTyping && <span className="terminal-cursor" />}
          </p>
        );
      })}
      {done && <span className="terminal-cursor" />}
    </>
  );
}
