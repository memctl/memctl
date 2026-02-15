import type { Metadata } from "next";
import { RootProvider } from "fumadocs-ui/provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "mem/ctl — Shared Memory for AI Coding Agents",
  description:
    "Cloud MCP server that gives AI coding agents shared, persistent memory scoped to projects and organizations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-mono text-foreground antialiased">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
