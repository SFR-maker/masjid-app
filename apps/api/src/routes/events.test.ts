import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

const mockPrisma = {
  event: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  userFollow: { findUnique: vi.fn() },
  mosqueAdmin: { findUnique: vi.fn() },
  eventRsvp: { upsert: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
}

vi.mock('@masjid/database', () => ({ prisma: mockPrisma }))
vi.mock('../workers/notification.worker', () => ({ notificationQueue: { add: vi.fn() } }))
vi.mock('../plugins/auth', () => ({
  requireAuth: vi.fn(async (req: any, reply: any) => {
    if (!req.headers['x-test-user']) return reply.status(401).send({ error: 'Unauthorized' })
    req.userId = req.headers['x-test-user']
  }),
  requireMosqueAdmin: vi.fn(() => async (_req: any, _reply: any) => {}),
}))

async function buildApp() {
  const { eventRoutes } = await import('./events')
  const app = Fastify({ logger: false })
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    ;(req as any).rawBody = body
    try { done(null, JSON.parse(body as string)) } catch (e) { done(e as Error) }
  })
  // Inject userId from test header
  app.addHook('preHandler', async (req: any) => {
    if (req.headers['x-test-user']) req.userId = req.headers['x-test-user']
  })
  app.register(eventRoutes)
  return app
}

const publicEvent = {
  id: 'evt_pub',
  mosqueId: 'mosque_1',
  isPrivate: false,
  isPublished: true,
  title: 'Public Event',
  _count: { rsvps: 0 },
  mosque: { id: 'mosque_1', name: 'Test Mosque', slug: 'test', logoUrl: null, isVerified: false },
}

const privateEvent = {
  id: 'evt_priv',
  mosqueId: 'mosque_1',
  isPrivate: true,
  isPublished: true,
  title: 'Private Event',
  _count: { rsvps: 0 },
  mosque: { id: 'mosque_1', name: 'Test Mosque', slug: 'test', logoUrl: null, isVerified: false },
}

describe('GET /events/:id — private event enforcement', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns public event to unauthenticated user', async () => {
    mockPrisma.event.findUnique.mockResolvedValue(publicEvent)
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/events/evt_pub' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).data.title).toBe('Public Event')
  })

  it('returns 403 for private event when unauthenticated', async () => {
    mockPrisma.event.findUnique.mockResolvedValue(privateEvent)
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/events/evt_priv' })
    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'This event is private' })
  })

  it('returns 403 for private event when authenticated but not a follower', async () => {
    mockPrisma.event.findUnique.mockResolvedValue(privateEvent)
    mockPrisma.userFollow.findUnique.mockResolvedValue(null) // not following
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/events/evt_priv',
      headers: { 'x-test-user': 'user_abc' },
    })
    expect(res.statusCode).toBe(403)
  })

  it('returns private event to authenticated follower', async () => {
    mockPrisma.event.findUnique.mockResolvedValue(privateEvent)
    mockPrisma.userFollow.findUnique.mockResolvedValue({ id: 'follow_1' }) // is following
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/events/evt_priv',
      headers: { 'x-test-user': 'user_abc' },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).data.title).toBe('Private Event')
  })

  it('returns 404 when event does not exist', async () => {
    mockPrisma.event.findUnique.mockResolvedValue(null)
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/events/no_such' })
    expect(res.statusCode).toBe(404)
  })
})
