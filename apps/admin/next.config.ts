import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  transpilePackages: ['@masjid/database', '@masjid/types'],
  outputFileTracingRoot: path.join(__dirname, '../../'),
  outputFileTracingIncludes: {
    '/**': [
      '../../node_modules/.pnpm/@prisma+client@*/**/*.node',
      '../../node_modules/.pnpm/@prisma+client@*/**/*.js',
      '../../node_modules/@prisma/client/**',
    ],
  },
}

export default nextConfig
