import type { NextConfig } from "next";

// Export statique pour GitHub Pages. NEXT_PUBLIC_BASE_PATH vaut "/Business-plan"
// lors du déploiement (le site est servi sous https://<compte>.github.io/Business-plan/).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
