import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@gamingcouch/shared'],
  output: 'standalone',
};

export default nextConfig;
