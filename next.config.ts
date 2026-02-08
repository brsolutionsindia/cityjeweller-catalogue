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
      {
        source: "/roseDay",
        destination: "/search?query=valentine",
        permanent: false,
      },
      {
        source: "/roseday",
        destination: "/search?query=valentine",
        permanent: false,
      },
{
        source: "/proposeDay",
        destination: "/search?query=valentine",
        permanent: false,
      },
{
        source: "/proposeday",
        destination: "/search?query=valentine",
        permanent: false,
      },
{
        source: "/chocolateDay",
        destination: "/search?query=valentine",
        permanent: false,
      },
{
        source: "/chocolateday",
        destination: "/search?query=valentine",
        permanent: false,
      },
{
        source: "/teddyDay",
        destination: "/search?query=valentine",
        permanent: false,
      },
{
        source: "/teddyday",
        destination: "/search?query=valentine",
        permanent: false,
      },
{
        source: "/promiseDay",
        destination: "/search?query=valentine",
        permanent: false,
      },
{
        source: "/promiseday",
        destination: "/search?query=valentine",
        permanent: false,
      },
{
        source: "/hugDay",
        destination: "/search?query=valentine",
        permanent: false,
      },
{
        source: "/hugday",
        destination: "/search?query=valentine",
        permanent: false,
      },
{
        source: "/kissDay",
        destination: "/search?query=valentine",
        permanent: false,
      },
{
        source: "/kissday",
        destination: "/search?query=valentine",
        permanent: false,
      },
{
        source: "/valentineDay",
        destination: "/search?query=valentine",
        permanent: false,
      },
{
        source: "/valentineday",
        destination: "/search?query=valentine",
        permanent: false,
      },

    ];
  },

  // ❌ output: 'export' removed as discussed
};

export default nextConfig;
