import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
output: 'export', // ✅ Add this line
images: {
    unoptimized: true, // Disable Image Optimization for static export
  },
};

export default nextConfig;
