"use client";

import { useEffect, useRef } from "react";

export function NoiseTexture({ opacity = 0.04 }: { opacity?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Generate a small noise tile, then use it as a repeating background
    const canvas = document.createElement("canvas");
    const size = 128;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.createImageData(size, size);
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.random() * 255;
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);

    el.style.backgroundImage = `url(${canvas.toDataURL("image/png")})`;
    el.style.backgroundRepeat = "repeat";
    el.style.backgroundSize = `${size}px ${size}px`;
  }, []);

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute inset-0"
      style={{ opacity, mixBlendMode: "overlay" }}
      aria-hidden="true"
    />
  );
}
