import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { authRoutes } from './auth'

// Mock svix — we control verify() return
vi.mock('svix', () => ({
  Webhook: vi.fn().mockImplementation(() => ({
    verify: vi.fn(),
  })),
}))

// Mock prisma
vi.mock('@masjid/database', () => ({
  prisma: {
    user: {
      upsert: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({}),
    },
  },
}))

// Mock workers (imported transitively)
vi.mock('../workers/notification.worker', () => ({ notificationQueue: { add: vi.fn() } }))
vi.mock('../workers/mux-poller', () => ({}))

function buildApp() {
  const app = Fastify({ logger: false })
  // Raw body parser (mirrors server.ts)
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    ;(req as any).rawBody = body
    try { done(null, JSON.parse(body as string)) } catch (e) { done(e as Error) }
  })
  app.register(authRoutes, { prefix: '/auth' })
  return app
}

const VALID_SECRET = 'whsec_testsecretkey1234567890abcdef'
const WEBHOOK_BODY = JSON.stringify({
  type: 'user.created',
  data: {
    id: 'user_123',
    email_addresses: [{ email_address: 'test@test.com' }],
    first_name: 'Test',
    last_name: 'User',
    image_url: null,
  },
})

describe('Clerk webhook — auth.ts', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns 503 when CLERK_WEBHOOK_SECRET is not set', async () => {
    delete process.env.CLERK_WEBHOOK_SECRET
    const app = buildApp()
    const res = await app.inject({
      method: 'POST', url: '/auth/webhook',
      headers: { 'content-type': 'application/json' },
      body: WEBHOOK_BODY,
    })
    expect(res.statusCode).toBe(503)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'Webhook secret not configured' })
  })

  it('returns 503 when CLERK_WEBHOOK_SECRET is the placeholder value', async () => {
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_placeholder'
    const app = buildApp()
    const res = await app.inject({
      method: 'POST', url: '/auth/webhook',
      headers: { 'content-type': 'application/json' },
      body: WEBHOOK_BODY,
    })
    expect(res.statusCode).toBe(503)
  })

  it('returns 400 when signature headers are missing / invalid', async () => {
    process.env.CLERK_WEBHOOK_SECRET = VALID_SECRET
    const { Webhook } = await import('svix')
    vi.mocked(Webhook).mockImplementation(() => ({
      verify: vi.fn().mockImplementation(() => { throw new Error('Bad signature') }),
    }) as any)

    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/webhook',
      headers: { 'content-type': 'application/json' },
      body: WEBHOOK_BODY,
    })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'Invalid webhook signature' })
  })

  it('processes event when signature is valid', async () => {
    process.env.CLERK_WEBHOOK_SECRET = VALID_SECRET
    const parsedEvent = JSON.parse(WEBHOOK_BODY)
    const { Webhook } = await import('svix')
    vi.mocked(Webhook).mockImplementation(() => ({
      verify: vi.fn().mockReturnValue(parsedEvent),
    }) as any)

    const { prisma } = await import('@masjid/database')
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/webhook',
      headers: {
        'content-type': 'application/json',
        'svix-id': 'msg_123',
        'svix-timestamp': '1234567890',
        'svix-signature': 'v1,valid_sig',
      },
      body: WEBHOOK_BODY,
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toMatchObject({ received: true })
    expect(prisma.user.upsert).toHaveBeenCalled()
  })
})
