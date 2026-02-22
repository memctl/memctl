import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import { source } from "@/lib/source";
import { DocsProvider } from "@/components/docs/docs-provider";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsProvider>
      <DocsLayout
        tree={source.pageTree}
        nav={{
          title: (
            <span className="font-mono text-sm font-semibold tracking-tight">
              mem<span className="text-[#F97316]">/</span>ctl{" "}
              <span className="ml-1 text-xs font-normal opacity-50">docs</span>
            </span>
          ),
          url: "/",
        }}
        sidebar={{
          defaultOpenLevel: 1,
          collapsible: false,
        }}
      >
        {children}
      </DocsLayout>
    </DocsProvider>
  );
}
