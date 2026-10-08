import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Strict mode React (double-render en dev) -> détection précoce des effets de bord mal écrits
  reactStrictMode: true,

  images: {
    // Avatars + logos tenant servis depuis Clerk
    remotePatterns: [
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "images.clerk.dev" },
      // Fichiers uploadés (logos, produits) via Vercel Blob
      { protocol: "https", hostname: "**.blob.vercel-storage.com" },
      // Images distantes éventuelles (fournisseurs, marketplaces)
      { protocol: "https", hostname: "**.amazonaws.com" },
    ],
    // Formats modernes activés par défaut dans Next 15 (avif/webp)
  },

  experimental: {
    // Uploads (logos de tenant, images de produit) acceptés dans les Server Actions
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },

  // Évite les préfetch agressifs sur un dashboard avec beaucoup de routes dynamiques
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
