import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@masjid/database'
import { requireAuth, requireMosqueAdmin } from '../plugins/auth'
import { mux, createMuxUploadUrl, getMuxThumbnailUrl, getMuxStreamUrl } from '../lib/mux'

export async function videoRoutes(app: FastifyInstance) {
  // GET /videos — public video feed
  app.get('/videos', async (req, reply) => {
    const { mosqueId, category, q, limit = '20', cursor } = req.query as any
    const userId = req.userId

    const videos = await prisma.video.findMany({
      where: {
        isPublished: true,
        status: 'READY',
        ...(mosqueId ? { mosqueId } : {}),
        ...(category ? { category } : {}),
        ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
      },
      take: Math.min(100, Number(limit) || 20),
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        mosque: { select: { id: true, name: true, logoUrl: true, isVerified: true } },
        ...(userId ? { likes: { where: { userId }, select: { id: true } } } : {}),
      },
    })

    return reply.send({
      success: true,
      data: {
        items: videos.map((v) => ({
          ...v,
          userLiked: userId ? (v as any).likes?.length > 0 : false,
          likes: undefined,
        })),
        cursor: videos[videos.length - 1]?.id,
        hasMore: videos.length === Number(limit),
      },
    })
  })

  // GET /mosques/:id/videos — admin list (includes non-published)
  app.get(
    '/mosques/:id/videos',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { id: mosqueId } = req.params as { id: string }
      const { limit = '50' } = req.query as any

      const videos = await prisma.video.findMany({
        where: { mosqueId },
        take: Math.min(100, Number(limit) || 20),
        orderBy: { createdAt: 'desc' },
      })

      return reply.send({ success: true, data: { items: videos } })
    }
  )

  // POST /mosques/:id/videos/upload — get Mux upload URL
  app.post(
    '/mosques/:id/videos/upload',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { id: mosqueId } = req.params as { id: string }
      const { title, description, category } = z
        .object({
          title: z.string().min(3),
          description: z.string().optional(),
          category: z.enum(['GENERAL','LECTURE','QURAN','DUA','KHUTBAH','EDUCATIONAL','EVENT','OTHER']).default('GENERAL'),
        })
        .parse(req.body)

      const { uploadUrl, uploadId } = await createMuxUploadUrl()

      const video = await prisma.video.create({
        data: { mosqueId, title, description, category, muxUploadId: uploadId, status: 'PROCESSING' },
      })

      return reply.send({ success: true, data: { uploadUrl, uploadId, videoId: video.id } })
    }
  )

  // GET /videos/:id
  app.get('/videos/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const userId = req.userId
    // Bug 8 fix: pass ?noView=1 when re-fetching after a like to avoid
    // incrementing the view count on every like tap.
    const { noView } = req.query as { noView?: string }

    const video = await prisma.video.findUnique({
      where: { id },
      include: {
        mosque: { select: { id: true, name: true, logoUrl: true, isVerified: true } },
        ...(userId ? { likes: { where: { userId }, select: { id: true } } } : {}),
      },
    })

    if (!video || !video.isPublished) {
      return reply.status(404).send({ success: false, error: 'Video not found' })
    }

    // Only increment view count when it's a real page visit, not a like-triggered refetch
    if (!noView) {
      prisma.video.update({ where: { id }, data: { viewCount: { increment: 1 } } }).catch(() => {})
    }

    return reply.send({
      success: true,
      data: {
        ...video,
        streamUrl: video.muxPlaybackId ? getMuxStreamUrl(video.muxPlaybackId) : null,
        userLiked: userId ? (video as any).likes?.length > 0 : false,
        likes: undefined,
      },
    })
  })

  // POST /videos/mux-webhook
  app.post('/videos/mux-webhook', async (req, reply) => {
    const webhookSecret = process.env.MUX_WEBHOOK_SECRET!

    if (!webhookSecret || webhookSecret === 'whsec_placeholder') {
      return reply.status(503).send({ error: 'Mux webhook secret not configured' })
    }
    try {
      const rawBody = (req as any).rawBody ?? JSON.stringify(req.body)
      mux.webhooks.verifySignature(rawBody, req.headers as any, webhookSecret)
    } catch {
      return reply.status(401).send({ error: 'Invalid Mux webhook signature' })
    }

    const { type, data } = req.body as any

    if (type === 'video.asset.ready') {
      const playbackId = data.playback_ids?.[0]?.id
      // Match by upload_id (set at creation) then store the resolved asset ID
      await prisma.video.updateMany({
        where: { muxUploadId: data.upload_id },
        data: {
          muxAssetId: data.id,
          status: 'READY',
          muxPlaybackId: playbackId,
          thumbnailUrl: playbackId ? getMuxThumbnailUrl(playbackId) : undefined,
          duration: Math.round(data.duration ?? 0),
          isPublished: true,
        },
      })
    }

    if (type === 'video.asset.errored') {
      await prisma.video.updateMany({
        where: { muxUploadId: data.upload_id },
        data: { muxAssetId: data.id, status: 'ERROR' },
      })
    }

    return reply.send({ received: true })
  })

  // PATCH /videos/:id — update title/description/category (admin)
  app.patch(
    '/videos/:id',
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const video = await prisma.video.findUnique({ where: { id }, select: { mosqueId: true } })
      if (!video) return reply.status(404).send({ success: false, error: 'Not found' })

      // Verify caller is admin of this mosque
      const userId = req.userId!
      const isAdmin = await prisma.mosqueAdmin.findUnique({
        where: { userId_mosqueId: { userId, mosqueId: video.mosqueId } },
      })
      if (!isAdmin) return reply.status(403).send({ success: false, error: 'Forbidden' })

      const body = z.object({
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        category: z.enum(['GENERAL','LECTURE','QURAN','DUA','KHUTBAH','EDUCATIONAL','EVENT','OTHER']).optional(),
      }).parse(req.body)

      const updated = await prisma.video.update({ where: { id }, data: body })
      return reply.send({ success: true, data: updated })
    }
  )

  // DELETE /videos/:id — delete video (admin)
  app.delete(
    '/videos/:id',
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const video = await prisma.video.findUnique({ where: { id }, select: { mosqueId: true, muxAssetId: true } })
      if (!video) return reply.status(404).send({ success: false, error: 'Not found' })

      const userId = req.userId!
      const isAdmin = await prisma.mosqueAdmin.findUnique({
        where: { userId_mosqueId: { userId, mosqueId: video.mosqueId } },
      })
      if (!isAdmin) return reply.status(403).send({ success: false, error: 'Forbidden' })

      await prisma.video.delete({ where: { id } })
      return reply.send({ success: true })
    }
  )

  // POST /videos/:id/like
  app.post('/videos/:id/like', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id: videoId } = req.params as { id: string }
    const userId = req.userId!

    const existing = await prisma.videoLike.findUnique({
      where: { videoId_userId: { videoId, userId } },
    })

    if (existing) {
      await prisma.videoLike.delete({ where: { videoId_userId: { videoId, userId } } })
      await prisma.video.update({ where: { id: videoId }, data: { likeCount: { decrement: 1 } } })
      return reply.send({ success: true, liked: false })
    }

    await prisma.videoLike.create({ data: { videoId, userId } })
    await prisma.video.update({ where: { id: videoId }, data: { likeCount: { increment: 1 } } })
    return reply.send({ success: true, liked: true })
  })

  // GET /videos/:id/comments — public, guests can read
  app.get('/videos/:id/comments', async (req, reply) => {
    const { id: videoId } = req.params as { id: string }
    const { limit = '50', cursor } = req.query as any

    const comments = await prisma.videoComment.findMany({
      where: { videoId },
      take: Math.min(100, Number(limit) || 50),
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    })

    return reply.send({
      success: true,
      data: {
        items: comments,
        cursor: comments[comments.length - 1]?.id,
        hasMore: comments.length === Number(limit),
      },
    })
  })

  // POST /videos/:id/comments — requires auth
  app.post('/videos/:id/comments', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id: videoId } = req.params as { id: string }
    const userId = req.userId!

    const { text } = z
      .object({ text: z.string().min(2).max(1000) })
      .parse(req.body)

    // Verify video exists
    const video = await prisma.video.findUnique({ where: { id: videoId }, select: { id: true, isPublished: true } })
    if (!video || !video.isPublished) {
      return reply.status(404).send({ success: false, error: 'Video not found' })
    }

    const comment = await prisma.videoComment.create({
      data: { videoId, userId, text: text.trim() },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    })

    return reply.status(201).send({ success: true, data: comment })
  })
}
