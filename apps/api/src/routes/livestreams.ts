import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@masjid/database'
import { requireAuth, requireMosqueAdmin } from '../plugins/auth'
import { mux, getMuxStreamUrl, getMuxThumbnailUrl } from '../lib/mux'

export async function liveStreamRoutes(app: FastifyInstance) {
  // GET /livestreams — active live streams (public)
  app.get('/livestreams', async (req, reply) => {
    const streams = await prisma.liveStream.findMany({
      where: { status: 'LIVE' },
      orderBy: { startedAt: 'desc' },
      include: {
        mosque: { select: { id: true, name: true, logoUrl: true, isVerified: true } },
      },
    })

    return reply.send({
      success: true,
      data: {
        items: streams.map((s) => ({
          ...s,
          streamUrl: s.muxPlaybackId ? getMuxStreamUrl(s.muxPlaybackId) : null,
          thumbnailUrl: s.muxPlaybackId ? getMuxThumbnailUrl(s.muxPlaybackId) : null,
          muxStreamKey: undefined, // never expose stream key to public
        })),
      },
    })
  })

  // GET /mosques/:id/livestreams — mosque's stream history
  app.get('/mosques/:id/livestreams', async (req, reply) => {
    const { id: mosqueId } = req.params as { id: string }
    const streams = await prisma.liveStream.findMany({
      where: { mosqueId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    return reply.send({ success: true, data: { items: streams } })
  })

  // GET /livestreams/:id — single stream
  app.get('/livestreams/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const stream = await prisma.liveStream.findUnique({
      where: { id },
      include: { mosque: { select: { id: true, name: true, logoUrl: true } } },
    })
    if (!stream) return reply.status(404).send({ success: false, error: 'Not found' })

    return reply.send({
      success: true,
      data: {
        ...stream,
        streamUrl: stream.muxPlaybackId ? getMuxStreamUrl(stream.muxPlaybackId) : null,
        thumbnailUrl: stream.muxPlaybackId ? getMuxThumbnailUrl(stream.muxPlaybackId) : null,
        muxStreamKey: undefined,
      },
    })
  })

  // POST /mosques/:id/livestreams — create / go live (admin)
  app.post(
    '/mosques/:id/livestreams',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { id: mosqueId } = req.params as { id: string }
      const { title } = z.object({ title: z.string().min(3) }).parse(req.body)

      // Create Mux live stream
      const muxStream = await mux.video.liveStreams.create({
        playback_policy: ['public'],
        new_asset_settings: { playback_policy: ['public'] },
      })

      const playbackId = muxStream.playback_ids?.[0]?.id ?? null

      const stream = await prisma.liveStream.create({
        data: {
          mosqueId,
          title,
          muxLiveStreamId: muxStream.id,
          muxPlaybackId: playbackId,
          muxStreamKey: muxStream.stream_key ?? null,
          status: 'IDLE',
        },
      })

      return reply.status(201).send({
        success: true,
        data: {
          ...stream,
          streamKey: stream.muxStreamKey, // admin gets stream key
          rtmpUrl: 'rtmps://global-live.mux.com:443/app',
          streamUrl: playbackId ? getMuxStreamUrl(playbackId) : null,
        },
      })
    }
  )

  // POST /livestreams/:id/start — go live
  app.post(
    '/livestreams/:id/start',
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const stream = await prisma.liveStream.findUnique({ where: { id } })
      if (!stream) return reply.status(404).send({ success: false, error: 'Not found' })

      const admin = await prisma.mosqueAdmin.findUnique({
        where: { userId_mosqueId: { userId: req.userId!, mosqueId: stream.mosqueId } },
      })
      if (!admin && !req.isSuperAdmin) return reply.status(403).send({ success: false, error: 'Forbidden' })

      const updated = await prisma.liveStream.update({
        where: { id },
        data: { status: 'LIVE', startedAt: new Date() },
      })

      return reply.send({ success: true, data: updated })
    }
  )

  // POST /livestreams/:id/end — end stream
  app.post(
    '/livestreams/:id/end',
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const stream = await prisma.liveStream.findUnique({ where: { id } })
      if (!stream) return reply.status(404).send({ success: false, error: 'Not found' })

      const admin = await prisma.mosqueAdmin.findUnique({
        where: { userId_mosqueId: { userId: req.userId!, mosqueId: stream.mosqueId } },
      })
      if (!admin && !req.isSuperAdmin) return reply.status(403).send({ success: false, error: 'Forbidden' })

      // End on Mux too
      if (stream.muxLiveStreamId) {
        await mux.video.liveStreams.complete(stream.muxLiveStreamId).catch(() => {})
      }

      const updated = await prisma.liveStream.update({
        where: { id },
        data: { status: 'ENDED', endedAt: new Date() },
      })

      return reply.send({ success: true, data: updated })
    }
  )

  // POST /livestreams/:id/view-count — increment viewer count (call on join/leave)
  app.post('/livestreams/:id/view-count', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { delta } = z.object({ delta: z.number().int().min(-1).max(1) }).parse(req.body)

    await prisma.liveStream.update({
      where: { id },
      data: { viewerCount: { increment: delta } },
    }).catch(() => {})

    return reply.send({ success: true })
  })
}
