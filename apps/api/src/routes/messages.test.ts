import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

const mockPrisma = {
  directMessage: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  messageReply: { create: vi.fn() },
  groupChat: {
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findUnique: vi.fn(),
  },
  groupChatMember: {
    createMany: vi.fn(),
    deleteMany: vi.fn(),
    findFirst: vi.fn(),
    upsert: vi.fn(),
  },
  groupChatMessage: { create: vi.fn(), findMany: vi.fn() },
  $transaction: vi.fn(async (ops: any[]) => ops),
}

vi.mock('@masjid/database', () => ({ prisma: mockPrisma }))
vi.mock('../plugins/auth', () => ({
  requireAuth: vi.fn(async (req: any, reply: any) => {
    if (!req.userId) return reply.status(401).send({ error: 'Unauthorized' })
  }),
  requireMosqueAdmin: vi.fn(() => async (_req: any, _reply: any) => {}),
}))

async function buildApp(userId?: string) {
  const { messageRoutes } = await import('./messages')
  const app = Fastify({ logger: false })
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    ;(req as any).rawBody = body
    try { done(null, JSON.parse(body as string)) } catch (e) { done(e as Error) }
  })
  app.addHook('preHandler', async (req: any) => {
    req.userId = userId ?? null
  })
  app.register(messageRoutes)
  return app
}

describe('POST /mosques/:id/messages/:messageId/user-reply — cross-mosque fix', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 when message belongs to a different mosque', async () => {
    // findFirst returns null because mosqueId in query won't match
    mockPrisma.directMessage.findFirst.mockResolvedValue(null)
    const app = await buildApp('user_abc')
    const res = await app.inject({
      method: 'POST',
      url: '/mosques/mosque_A/messages/msg_1/user-reply',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: 'Hello' }),
    })
    expect(res.statusCode).toBe(404)
    // Verify the DB query included mosqueId
    expect(mockPrisma.directMessage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ mosqueId: 'mosque_A', fromUserId: 'user_abc' }),
      })
    )
  })

  it('succeeds when message belongs to correct mosque and user', async () => {
    mockPrisma.directMessage.findFirst.mockResolvedValue({ id: 'msg_1', mosqueId: 'mosque_A' })
    mockPrisma.messageReply.create.mockResolvedValue({ id: 'reply_1', body: 'Hello' })
    mockPrisma.directMessage.update.mockResolvedValue({})
    const app = await buildApp('user_abc')
    const res = await app.inject({
      method: 'POST',
      url: '/mosques/mosque_A/messages/msg_1/user-reply',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: 'Hello' }),
    })
    expect(res.statusCode).toBe(201)
  })
})
