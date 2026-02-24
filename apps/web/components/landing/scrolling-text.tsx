"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger);

export function ScrollingText() {
  const ref = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!textRef.current || !ref.current) return;

      gsap.fromTo(
        textRef.current,
        { xPercent: 5 },
        {
          xPercent: -15,
          ease: "none",
          scrollTrigger: {
            trigger: ref.current,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        },
      );
    },
    { scope: ref },
  );

  return (
    <div
      ref={ref}
      className="overflow-hidden border-y border-[var(--landing-border)] py-14 lg:py-20"
    >
      <div
        ref={textRef}
        className="font-mono text-[clamp(3rem,8vw,7rem)] leading-none font-bold whitespace-nowrap text-[var(--landing-border)] uppercase select-none"
        aria-hidden="true"
      >
        persistent context &middot; branch-aware &middot; github-synced &middot;
        team-shared &middot; mcp native &middot; persistent context &middot;
        branch-aware &middot; github-synced &middot; team-shared &middot;
      </div>
    </div>
  );
}
