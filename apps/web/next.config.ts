import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@gamingcouch/shared'],
  output: 'export',
  trailingSlash: true,
};

export default nextConfig;
