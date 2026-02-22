"use client";

import type { ReactNode } from "react";
import { RootProvider } from "fumadocs-ui/provider";

export function DocsProvider({ children }: { children: ReactNode }) {
  return (
    <RootProvider theme={{ enabled: true, defaultTheme: "system" }}>
      {children}
    </RootProvider>
  );
}
