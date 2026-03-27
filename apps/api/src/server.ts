import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import { buildRoutes } from './routes'
import { authenticationPlugin } from './plugins/auth'
import { redis } from './lib/redis'
import { ZodError } from 'zod'
import './workers/notification.worker'
import './workers/mux-poller'
import './workers/cron.worker'

const app = Fastify({
  logger: {
    transport:
      process.env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  },
})

// Attach rawBody for webhook signature verification (e.g. Clerk, Mux)
app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
  ;(req as any).rawBody = body
  try {
    done(null, JSON.parse(body as string))
  } catch (e) {
    done(e as Error)
  }
})

function validateEnv() {
  const required = ['CLERK_SECRET_KEY', 'CLERK_WEBHOOK_SECRET', 'DATABASE_URL']
  const missing = required.filter((k) => !process.env[k])
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}

async function start() {
  validateEnv()

  await app.register(helmet, { contentSecurityPolicy: false })

  const isDev = process.env.NODE_ENV !== 'production'
  await app.register(cors, {
    origin: [
      process.env.ADMIN_URL ?? 'http://localhost:3002',
      process.env.MOBILE_WEB_URL ?? 'http://localhost:8081',
      /^exp:\/\//,
      /^masjid:\/\//,
      ...(isDev ? [/^http:\/\/localhost:(3001|3002|8081|19000|19001|19006)$/] : []),
    ],
    credentials: true,
  })

  const isRealRedis =
    process.env.REDIS_URL &&
    !process.env.REDIS_URL.includes('localhost') &&
    !process.env.REDIS_URL.includes('.internal')
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    ...(isRealRedis ? { redis } : {}),
    keyGenerator: (req) => (req as any).userId ?? req.ip ?? 'unknown',
  })

  // Convert ZodError validation failures to 400 instead of 500
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        success: false,
        error: 'Validation error',
        issues: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      })
    }
    // Prisma known request error (e.g. invalid cursor, not found)
    if ((error as any).code === 'P2025') {
      return reply.status(404).send({ success: false, error: 'Record not found' })
    }
    app.log.error(error)
    return reply.status(error.statusCode ?? 500).send({
      success: false,
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
    })
  })

  await app.register(authenticationPlugin)
  await buildRoutes(app)

  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  const port = Number(process.env.PORT ?? 3001)
  await app.listen({ port, host: '0.0.0.0' })
  app.log.info(`API running on port ${port}`)
}

start().catch((err) => {
  process.stderr.write(`Fatal startup error: ${err}\n`)
  process.exit(1)
})

