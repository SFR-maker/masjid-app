import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@masjid/database', '@masjid/types'],
  serverExternalPackages: ['@prisma/client', '.prisma/client'],
  outputFileTracingIncludes: {
    '**': [
      '../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/query_engine-windows.dll.node',
      '../../node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client/query_engine-windows.dll.node',
    ],
  },
}

export default nextConfig
