import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },

  async redirects() {
    return [
      {
        source: "/join",
        destination: "https://chat.whatsapp.com/DLIfCIdroyA5ciPokH13y1",
        permanent: false, // change to true if you want a permanent redirect
      },
    ];
  },

  // ❌ output: 'export' removed as you said
};

export default nextConfig;
