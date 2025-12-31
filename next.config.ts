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
      {
        source: '/personalize',
        destination: '/catalog/gold?sub=name',
        permanent: true, // 301 redirect (SEO friendly)
      },
    ];
  },

  // ❌ output: 'export' removed as you said
};

export default nextConfig;
