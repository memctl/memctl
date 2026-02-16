import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  transpilePackages: ["gsap", "@gsap/react"],
};

const withMDX = createMDX();

export default withMDX(nextConfig);
