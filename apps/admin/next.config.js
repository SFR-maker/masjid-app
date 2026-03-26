const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
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

module.exports = nextConfig
