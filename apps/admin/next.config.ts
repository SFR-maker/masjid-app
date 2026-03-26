import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  transpilePackages: ['@masjid/database', '@masjid/types'],
  outputFileTracingRoot: path.join(__dirname, '../../'),
}

export default nextConfig
