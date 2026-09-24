import type { NextConfig } from 'next';

const isCloudBaseHttpFunctionBuild =
  process.env.CLOUDBASE_HTTP_FUNCTION === '1';

const nextConfig: NextConfig = {
  ...(isCloudBaseHttpFunctionBuild ? {} : { output: 'standalone' as const }),
  outputFileTracingRoot: process.cwd(),
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
