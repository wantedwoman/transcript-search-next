import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Keep @vercel/og external in server bundles. Next 16's own `next/og`
  // re-export is broken on serverless (it loads
  // `next/dist/compiled/@vercel/og/index.node.js`, which is not shipped to
  // the lambda), and Turbopack otherwise rewrites direct `@vercel/og`
  // imports to that broken `next/og` path. With the package external, the
  // lambda requires it from node_modules (where its own dist/index.node.js
  // is bundled as a dependency) and rendering works.
  serverExternalPackages: ['@vercel/og'],
};

export default nextConfig;
