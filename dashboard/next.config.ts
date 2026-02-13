import type { NextConfig } from 'next';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Add parent node_modules to module resolution
      config.resolve.modules = [
        ...(config.resolve.modules || []),
        path.resolve(__dirname, '..', 'node_modules'),
      ];
    }
    return config;
  },
  outputFileTracingRoot: path.resolve(__dirname, '..'),
};

export default nextConfig;
