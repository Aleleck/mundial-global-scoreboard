
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NO usar "output: export" en Vercel
  // NO usar "basePath" ni "assetPrefix"
  
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true, // Opcional: mejora el rendimiento
  },
};

export default nextConfig;