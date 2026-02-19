"use client";

import { useEffect, useRef } from "react";

/**
 * Canvas-generated noise grain overlay with warm tint.
 * Generates a fine-grained tile, converts to data URL, tiles as CSS background.
 */
export function NoiseTexture({
  className = "",
  opacity = 0.18,
  size = 200,
}: {
  className?: string;
  opacity?: number;
  size?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.createImageData(size, size);
    const d = imageData.data;

    for (let i = 0; i < d.length; i += 4) {
      // Stronger contrast: push values harder toward black/white
      const raw = Math.random();
      const pushed = raw < 0.5 ? raw * 0.4 : 1 - (1 - raw) * 0.4;
      const v = pushed * 255;

      // Slight warm tint (adds 5-8% more to red channel)
      d[i] = Math.min(255, v * 1.06);
      d[i + 1] = v;
      d[i + 2] = v * 0.95;
      d[i + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
    el.style.backgroundImage = `url(${canvas.toDataURL("image/png")})`;
  }, [size]);

  return (
    <div
      ref={ref}
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{
        backgroundRepeat: "repeat",
        backgroundSize: `${size}px ${size}px`,
        opacity,
        mixBlendMode: "overlay",
      }}
      aria-hidden="true"
    />
  );
}
