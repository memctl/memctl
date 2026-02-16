"use client";

import { useRef, Children } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

type Animation = "fade-up" | "fade-in" | "scale-up" | "slide-left" | "slide-right";

interface ScrollRevealProps {
  children: React.ReactNode;
  animation?: Animation;
  delay?: number;
  duration?: number;
  once?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const FROM_VARS: Record<Animation, gsap.TweenVars> = {
  "fade-up": { autoAlpha: 0, y: 40 },
  "fade-in": { autoAlpha: 0 },
  "scale-up": { autoAlpha: 0, scale: 0.92 },
  "slide-left": { autoAlpha: 0, x: -60 },
  "slide-right": { autoAlpha: 0, x: 60 },
};

export function ScrollReveal({
  children,
  animation = "fade-up",
  delay = 0,
  duration = 800,
  once = true,
  className = "",
  style,
}: ScrollRevealProps) {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const el = container.current;
    if (!el) return;

    gsap.set(el, FROM_VARS[animation]);

    gsap.to(el, {
      autoAlpha: 1,
      x: 0,
      y: 0,
      scale: 1,
      duration: duration / 1000,
      delay: delay / 1000,
      ease: "power3.out",
      scrollTrigger: {
        trigger: el,
        start: "top 88%",
        toggleActions: once
          ? "play none none none"
          : "play reverse play reverse",
      },
    });
  }, { scope: container });

  return (
    <div ref={container} className={className} style={{ visibility: "hidden", ...style }}>
      {children}
    </div>
  );
}

interface StaggerGroupProps {
  children: React.ReactNode;
  animation?: Animation;
  staggerMs?: number;
  className?: string;
}

export function StaggerGroup({
  children,
  animation = "fade-up",
  staggerMs = 100,
  className = "",
}: StaggerGroupProps) {
  const items = Children.toArray(children);

  return (
    <div className={className}>
      {items.map((child, i) => (
        <ScrollReveal key={i} animation={animation} delay={i * staggerMs}>
          {child}
        </ScrollReveal>
      ))}
    </div>
  );
}

/* ---- Scroll-linked parallax (scrub-based, not trigger-based) ---- */

type ParallaxEffect = "scale-in" | "parallax-up" | "parallax-down" | "fade-scale";

interface ScrollParallaxProps {
  children: React.ReactNode;
  effect: ParallaxEffect;
  intensity?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function ScrollParallax({
  children,
  effect,
  intensity = 0.5,
  className = "",
  style,
}: ScrollParallaxProps) {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const el = container.current;
    if (!el) return;

    let fromVars: gsap.TweenVars = {};
    let toVars: gsap.TweenVars = {};

    switch (effect) {
      case "scale-in":
        fromVars = { scale: 1 - 0.15 * intensity, autoAlpha: 0.3 };
        toVars = { scale: 1, autoAlpha: 1 };
        break;
      case "parallax-up":
        fromVars = { y: 60 * intensity };
        toVars = { y: -60 * intensity };
        break;
      case "parallax-down":
        fromVars = { y: -60 * intensity };
        toVars = { y: 60 * intensity };
        break;
      case "fade-scale":
        fromVars = { scale: 1 - 0.08 * intensity, autoAlpha: 0.4 };
        toVars = { scale: 1, autoAlpha: 1 };
        break;
    }

    gsap.fromTo(el, fromVars, {
      ...toVars,
      ease: "none",
      scrollTrigger: {
        trigger: el,
        start: "top bottom",
        end: "top center",
        scrub: true,
      },
    });
  }, { scope: container });

  return (
    <div ref={container} className={className} style={style}>
      {children}
    </div>
  );
}
