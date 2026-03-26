import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

const mockPrisma = {
  donationCampaign: { findMany: vi.fn(), create: vi.fn() },
  donation: { create: vi.fn() },
}

vi.mock('@masjid/database', () => ({ prisma: mockPrisma }))
vi.mock('../plugins/auth', () => ({
  requireAuth: vi.fn(async () => {}),
  requireMosqueAdmin: vi.fn(() => async () => {}),
}))

async function buildApp() {
  const { donationRoutes } = await import('./donations')
  const app = Fastify({ logger: false })
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    ;(req as any).rawBody = body
    try { done(null, JSON.parse(body as string)) } catch (e) { done(e as Error) }
  })
  app.register(donationRoutes)
  return app
}

describe('GET /mosques/:id/donations — expired campaign filter', () => {
  beforeEach(() => vi.clearAllMocks())

  it('queries with endsAt >= now filter', async () => {
    mockPrisma.donationCampaign.findMany.mockResolvedValue([])
    const app = await buildApp()
    await app.inject({ method: 'GET', url: '/mosques/mosque_1/donations' })

    expect(mockPrisma.donationCampaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          OR: expect.arrayContaining([
            { endsAt: null },
            expect.objectContaining({ endsAt: expect.objectContaining({ gte: expect.any(Date) }) }),
          ]),
        }),
      })
    )
  })

  it('returns only non-expired active campaigns', async () => {
    const future = new Date(Date.now() + 86400000).toISOString()
    const campaigns = [
      { id: '1', title: 'Active', isActive: true, endsAt: future, donations: [{ amount: 100 }], _count: { donations: 1 } },
    ]
    mockPrisma.donationCampaign.findMany.mockResolvedValue(campaigns)
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/mosques/mosque_1/donations' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].totalRaised).toBe(100)
  })
})
