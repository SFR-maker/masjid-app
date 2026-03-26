import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  transpilePackages: ['@masjid/database', '@masjid/types'],
  outputFileTracingRoot: path.join(__dirname, '../../'),
  outputFileTracingIncludes: {
    '/**': [
      '../../node_modules/.prisma/client/**',
      '../../node_modules/@prisma/client/**',
    ],
  },
}

export default nextConfig
