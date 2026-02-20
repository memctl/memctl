import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  compress: true,
  transpilePackages: ["gsap", "@gsap/react"],
};

const withMDX = createMDX();

export default withMDX(nextConfig);
