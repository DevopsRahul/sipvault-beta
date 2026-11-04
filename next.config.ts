import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a small self-contained server in .next/standalone (used by the Dockerfile).
  output: "standalone",

  // BETA: empty -> Next.js serves its own /_next/static files.
  // PROD: set ASSET_PREFIX=https://cdn.yourdomain.com at BUILD time and upload
  //       .next/static to S3 so CloudFront serves JS/CSS. (See README section 10.)
  assetPrefix: process.env.ASSET_PREFIX || undefined,

  poweredByHeader: false,

  experimental: {
    // Allow image uploads (max 5 MB, validated in lib/uploads.ts) through server actions.
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
