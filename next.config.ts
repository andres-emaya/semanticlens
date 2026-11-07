import type { NextConfig } from "next";

// Static build for GitHub Pages: plain HTML, the search engine runs in the browser.
// Run it with `npm run build:static` (see scripts/build-static.mjs).
const isStaticSite = process.env.NEXT_PUBLIC_STATIC_SITE === "true";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: isStaticSite,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com"
      }
    ]
  },
  ...(isStaticSite && {
    output: "export",
    trailingSlash: true,
    basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined
  })
};

export default nextConfig;
