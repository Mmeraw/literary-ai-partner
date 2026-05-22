/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Phase A.5: Instrumentation enabled automatically in Next 15+
  // (instrumentation.ts in project root is auto-discovered)
  
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      {
        source: "/YourWriting",
        destination: "/your-writing",
        permanent: true,
      },
    ];
  },

  // Rewrite marketing entry points so the browser URL stays clean.
  // rewrites() (not redirects) serve the static HTML without changing
  // the URL bar — revisiongrade.com/ stays as / not /marketing-export/…
  async rewrites() {
    return [
      {
        source: "/",
        destination: "/marketing-export/main/index.html",
      },
      {
        source: "/revise",
        destination: "/marketing-export/revise/index.html",
      },
    ];
  },
};

// Keep Next config unwrapped until Vercel Workflows is fully production-wired.
export default nextConfig;
