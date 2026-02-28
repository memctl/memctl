import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://memctl.com";

export const metadata: Metadata = {
  title: {
    template: "%s · memctl",
    default: "Shared Memory for AI Coding Agents · memctl",
  },
  description:
    "Give your team shared, branch-aware memory for AI coding agents. Context syncs across every IDE, machine, and tool so every session picks up where the last one left off.",
  metadataBase: new URL(siteUrl),
  keywords: [
    "AI coding agents",
    "shared memory",
    "MCP server",
    "Model Context Protocol",
    "AI context",
    "branch-aware memory",
    "coding assistant",
    "developer tools",
    "team collaboration",
    "IDE integration",
    "Claude",
    "Cursor",
    "Windsurf",
  ],
  authors: [{ name: "Memctl" }],
  creator: "Memctl",
  publisher: "Memctl",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    type: "website",
    siteName: "memctl",
    title: "Shared Memory for AI Coding Agents · memctl",
    description:
      "Give your team shared, branch-aware memory for AI coding agents. Context syncs across every IDE, machine, and tool so every session picks up where the last one left off.",
    url: siteUrl,
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: "memctl - Persistent context for every agent",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Shared Memory for AI Coding Agents · memctl",
    description:
      "Give your team shared, branch-aware memory for AI coding agents. Context syncs across every IDE, machine, and tool so every session picks up where the last one left off.",
    images: ["/twitter.jpg"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-[var(--landing-bg)] font-sans text-[var(--landing-text)] antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <Toaster position="bottom-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
