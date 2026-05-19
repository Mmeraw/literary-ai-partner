// Vercel Workflows SDK integration (spike: feat/vercel-workflows-spike)
// withWorkflow() enables 'use workflow' and 'use step' directive transforms.
// Safe to add now — has no effect until WORKFLOW_EVALUATION_ENABLED=true.
import { withWorkflow } from 'workflow/next';

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
};

export default withWorkflow(nextConfig);