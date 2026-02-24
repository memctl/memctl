"use client";

import { useState } from "react";
import Link from "next/link";
import { XIcon } from "lucide-react";

export function AnnouncementBanner() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="animate-slide-down relative z-50 flex items-center justify-center border-b border-[#F97316]/20 bg-gradient-to-r from-[#F97316] via-[#EA580C] to-[#F97316] px-12 py-2.5">
      <p className="text-[13px] font-medium text-white">
        {"memctl v1.0 \u2014 Public Beta is live. "}
        <Link
          href="/login"
          className="group inline-flex items-center font-semibold text-white underline decoration-white/40 underline-offset-2 transition-all hover:decoration-white"
        >
          Get started free
          <span className="ml-1 inline-block transition-transform group-hover:translate-x-1">
            {"\u2192"}
          </span>
        </Link>
      </p>
      <button
        onClick={() => setVisible(false)}
        className="absolute right-4 text-white/60 transition-all duration-200 hover:rotate-90 hover:text-white"
        aria-label="Close announcement"
      >
        <XIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
