import type { NextConfig } from "next";

// Site 100% estático: o GitHub Actions gera a pasta "out" e publica no GitHub Pages.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
};

export default nextConfig;
