import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        pathname: "/v0/b/**",
      },
    ],
  },

  async redirects() {
    return [
      {
        source: "/join",
        destination: "https://chat.whatsapp.com/DLIfCIdroyA5ciPokH13y1",
        permanent: false,
      },
      {
        source: "/personalize",
        destination: "/catalog/gold?sub=name",
        permanent: true,
      },
    ];
  },

  async rewrites() {
    return [
      {
        source: "/roseDayGifts",
        destination: "/search?query=roseDay",
      },
    ];
  },

  // ❌ output: 'export' removed as discussed
};

export default nextConfig;
