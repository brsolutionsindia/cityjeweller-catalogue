import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  // ❌ remove or comment out "output: 'export'"
  // output: 'export',
};

export default nextConfig;
