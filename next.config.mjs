/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Phase A.5: Instrumentation enabled automatically in Next 15+
  // (instrumentation.ts in project root is auto-discovered)

  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],

  // Governance authority docs are read from disk at runtime via
  // readFileSync (lib/evaluation/dreamTemplateLoader.ts →
  // getConstitutionalAuthorityStatus, and lib/evaluation/reportRenderParity.ts).
  // Next.js output-file-tracing only bundles files reachable through a
  // statically-analyzable readFileSync path; the constitutional-authority
  // registry reads each file via a *runtime* path string, so several of them
  // (evaluation-output-mode-contract, RUNTIME_BENCHMARK_AUTHORITY_MAP,
  // DREAM_LONGFORM_BENCHMARK_INDEX) were never bundled into the serverless
  // functions. That made the DCIP author-exposure gate fail closed in
  // production (decision=blocked → reports 404) even though the docs exist in
  // the repo. Force-include the whole authority-doc surface for every route
  // that runs the evaluation pipeline or renders/checks the certification.
  outputFileTracingIncludes: {
    '/**': [
      './docs/governance/**/*.md',
      './docs/templates/evaluation/**/*.md',
      './docs/benchmarks/**/*.md',
    ],
  },

  
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

// Keep Next config unwrapped until Vercel Workflows is fully production-wired.
export default nextConfig;
