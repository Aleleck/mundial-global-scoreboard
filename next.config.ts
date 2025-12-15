import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export", // Cambia de "standalone" a "export"
  basePath: "/mundial-global-scoreboard", // Reemplaza con el nombre de tu repo
  assetPrefix: "/mundial-global-scoreboard", // Mismo nombre
  images: {
    unoptimized: true, // GitHub Pages no soporta optimización de imágenes
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;