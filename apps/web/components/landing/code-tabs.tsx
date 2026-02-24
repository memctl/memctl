"use client";

import { useState, type ReactNode } from "react";

const LANGUAGES = {
  TypeScript: `import { Memctl } from '@memctl/sdk';

const mem = new Memctl({
  project: 'acme/frontend',
  token: process.env.MEMCTL_TOKEN,
});

// AI agents read context automatically via MCP
// But you can also query programmatically
const context = await mem.query('auth flow');
console.log(context.entries);`,

  Python: `from memctl import Memctl
import os

mem = Memctl(
    project="acme/frontend",
    token=os.environ["MEMCTL_TOKEN"],
)

# AI agents read context automatically via MCP
# But you can also query programmatically
context = mem.query("auth flow")
print(context.entries)`,

  Go: `package main

import "github.com/memctl/memctl-go"

func main() {
    client := memctl.New(memctl.Config{
        Project: "acme/frontend",
        Token:   os.Getenv("MEMCTL_TOKEN"),
    })

    // AI agents read context automatically via MCP
    // But you can also query programmatically
    context, _ := client.Query("auth flow")
    fmt.Println(context.Entries)
}`,

  CLI: `# Initialize memctl in your project
$ memctl init --project acme/frontend

# Query memories from the command line
$ memctl query "auth flow"

# List all memories
$ memctl list --limit 10

# Add a memory manually
$ memctl add "Uses NextAuth v5 with JWT"

# Start MCP server for AI agents
$ memctl serve --mcp`,
};

type Lang = keyof typeof LANGUAGES;

function highlightLine(line: string, lang: Lang): ReactNode[] {
  const parts: ReactNode[] = [];
  let remaining = line;
  let key = 0;

  // Handle full-line comments
  if (
    (lang !== "CLI" && remaining.trimStart().startsWith("//")) ||
    ((lang === "Python" || lang === "CLI") &&
      remaining.trimStart().startsWith("#"))
  ) {
    const indent = remaining.length - remaining.trimStart().length;
    return [
      <span key={0}>{remaining.slice(0, indent)}</span>,
      <span key={1} className="text-[var(--landing-text-tertiary)]">
        {remaining.slice(indent)}
      </span>,
    ];
  }

  // Handle CLI prompt lines
  if (lang === "CLI" && remaining.trimStart().startsWith("$")) {
    const indent = remaining.length - remaining.trimStart().length;
    return [
      <span key={0}>{remaining.slice(0, indent)}</span>,
      <span key={1} className="text-[#F97316]">
        $
      </span>,
      <span key={2}>{remaining.slice(indent + 1)}</span>,
    ];
  }

  while (remaining.length > 0) {
    // Strings
    const strMatch = remaining.match(/^(["'`])(?:(?!\1|\\).|\\.)*\1/);
    if (strMatch) {
      parts.push(
        <span key={key++} className="text-[#4ADE80]">
          {strMatch[0]}
        </span>,
      );
      remaining = remaining.slice(strMatch[0].length);
      continue;
    }

    // Keywords
    const kwMatch = remaining.match(
      /^(import|from|export|const|let|var|await|async|new|return|function|def|class|package|func|main|type|if|else|for|range|nil|true|false|null|undefined)\b/,
    );
    if (kwMatch) {
      parts.push(
        <span key={key++} className="text-[#F97316]">
          {kwMatch[0]}
        </span>,
      );
      remaining = remaining.slice(kwMatch[0].length);
      continue;
    }

    // Function-like calls
    const fnMatch = remaining.match(/^([A-Z]\w*|\w+)(?=\s*[({])/);
    if (
      fnMatch &&
      ![
        "if",
        "for",
        "while",
        "else",
        "import",
        "from",
        "new",
        "return",
        "package",
      ].includes(fnMatch[1])
    ) {
      parts.push(
        <span key={key++} className="text-[#60A5FA]">
          {fnMatch[0]}
        </span>,
      );
      remaining = remaining.slice(fnMatch[0].length);
      continue;
    }

    // Dot-access method
    const methodMatch = remaining.match(/^\.(\w+)(?=\s*\()/);
    if (methodMatch) {
      parts.push(<span key={key++}>.</span>);
      parts.push(
        <span key={key++} className="text-[#60A5FA]">
          {methodMatch[1]}
        </span>,
      );
      remaining = remaining.slice(methodMatch[0].length);
      continue;
    }

    // Default character
    parts.push(<span key={key++}>{remaining[0]}</span>);
    remaining = remaining.slice(1);
  }

  return parts;
}

export function CodeTabs() {
  const [active, setActive] = useState<Lang>("TypeScript");

  const lines = LANGUAGES[active].split("\n");

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 rounded-t-xl border border-b-0 border-[var(--landing-border)] bg-[var(--landing-surface)] px-2 pt-2">
        {(Object.keys(LANGUAGES) as Lang[]).map((lang) => (
          <button
            key={lang}
            onClick={() => setActive(lang)}
            className={`relative rounded-t-lg px-4 py-2.5 font-mono text-xs font-medium transition-colors ${
              active === lang
                ? "bg-[var(--landing-code-bg)] text-[var(--landing-text)]"
                : "text-[var(--landing-text-tertiary)] hover:text-[var(--landing-text-secondary)]"
            }`}
          >
            {lang}
            {active === lang && (
              <span className="absolute bottom-0 left-2 right-2 h-px bg-[#F97316]" />
            )}
          </button>
        ))}
      </div>

      {/* Code block */}
      <div className="overflow-hidden rounded-b-xl border border-[var(--landing-border)] bg-[var(--landing-code-bg)]">
        <div className="overflow-x-auto p-6">
          <pre className="font-mono text-[13px] leading-relaxed">
            {lines.map((line, i) => (
              <div key={`${active}-${i}`} className="flex">
                <span className="mr-6 inline-block w-5 shrink-0 select-none text-right tabular-nums text-[var(--landing-text-tertiary)]">
                  {i + 1}
                </span>
                <span className="text-[var(--landing-text)]">
                  {highlightLine(line, active)}
                </span>
              </div>
            ))}
          </pre>
        </div>
      </div>
    </div>
  );
}
