import Redis from 'ioredis'

export const redis = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
})

redis.on('error', (err) => {
  process.stderr.write(JSON.stringify({ level: 'error', msg: 'Redis error', err: String(err) }) + '\n')
})
