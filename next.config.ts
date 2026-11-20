import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel gère nativement le build Next.js — pas besoin de standalone.
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  images: {
    // autorise l'affichage des PDF/images issus de Vercel Blob
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
