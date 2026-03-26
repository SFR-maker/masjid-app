import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { videoRoutes } from './videos'

const mockVerify = vi.hoisted(() => vi.fn())

vi.mock('../lib/mux', () => ({
  mux: { webhooks: { verifySignature: mockVerify } },
  createMuxUploadUrl: vi.fn(),
  getMuxThumbnailUrl: vi.fn((id: string) => `https://image.mux.com/${id}/thumbnail.jpg`),
  getMuxStreamUrl: vi.fn((id: string) => `https://stream.mux.com/${id}.m3u8`),
}))
vi.mock('@masjid/database', () => ({
  prisma: {
    video: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({}),
    },
  },
}))
vi.mock('../plugins/auth', () => ({
  requireAuth: vi.fn((_req: any, _reply: any) => {}),
  requireMosqueAdmin: vi.fn(() => (_req: any, _reply: any) => {}),
}))
vi.mock('../workers/notification.worker', () => ({ notificationQueue: { add: vi.fn() } }))
vi.mock('../workers/mux-poller', () => ({}))

function buildApp() {
  const app = Fastify({ logger: false })
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    ;(req as any).rawBody = body
    try { done(null, JSON.parse(body as string)) } catch (e) { done(e as Error) }
  })
  app.register(videoRoutes)
  return app
}

const WEBHOOK_BODY = JSON.stringify({
  type: 'video.asset.ready',
  data: { upload_id: 'up_1', id: 'asset_1', playback_ids: [{ id: 'pb_1' }], duration: 120 },
})

describe('Mux webhook — videos.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const injectWebhook = (app: ReturnType<typeof buildApp>) =>
    app.inject({
      method: 'POST', url: '/videos/mux-webhook',
      headers: { 'content-type': 'application/json' },
      body: WEBHOOK_BODY,
    })

  it('returns 503 when MUX_WEBHOOK_SECRET is not set', async () => {
    delete process.env.MUX_WEBHOOK_SECRET
    const res = await injectWebhook(buildApp())
    expect(res.statusCode).toBe(503)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'Mux webhook secret not configured' })
  })

  it('returns 503 when MUX_WEBHOOK_SECRET is placeholder', async () => {
    process.env.MUX_WEBHOOK_SECRET = 'whsec_placeholder'
    const res = await injectWebhook(buildApp())
    expect(res.statusCode).toBe(503)
  })

  it('returns 401 when signature verification fails', async () => {
    process.env.MUX_WEBHOOK_SECRET = 'real_mux_secret'
    mockVerify.mockImplementation(() => { throw new Error('bad sig') })
    const res = await injectWebhook(buildApp())
    expect(res.statusCode).toBe(401)
    expect(JSON.parse(res.body)).toMatchObject({ error: 'Invalid Mux webhook signature' })
  })

  it('processes event when signature is valid', async () => {
    process.env.MUX_WEBHOOK_SECRET = 'real_mux_secret'
    mockVerify.mockReset() // reset throw implementation set in previous test
    const { prisma } = await import('@masjid/database')
    const res = await injectWebhook(buildApp())
    expect(res.statusCode).toBe(200)
    expect(prisma.video.updateMany).toHaveBeenCalled()
  })
})
