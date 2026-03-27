import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@masjid/database'
import { requireAuth, requireMosqueAdmin } from '../plugins/auth'
import { notificationQueue } from '../workers/notification.worker'

export async function announcementRoutes(app: FastifyInstance) {
  // GET /mosques/:id/announcements
  app.get('/mosques/:id/announcements', async (req, reply) => {
    const { id: mosqueId } = req.params as { id: string }
    const { limit = '20', cursor } = req.query as any

    const announcements = await prisma.announcement.findMany({
      where: { mosqueId, isPublished: true },
      take: Number(limit),
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      include: { _count: { select: { likes: true, comments: true } } },
    })

    return reply.send({
      success: true,
      data: {
        items: announcements.map((a) => ({
          ...a,
          likeCount: a._count.likes,
          commentCount: a._count.comments,
        })),
        cursor: announcements[announcements.length - 1]?.id,
        hasMore: announcements.length === Number(limit),
      },
    })
  })

  // GET /announcements/:id
  app.get('/announcements/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const userId = req.userId
    const announcement = await prisma.announcement.findUnique({
      where: { id },
      include: {
        mosque: { select: { id: true, name: true, logoUrl: true } },
        _count: { select: { likes: true, comments: true } },
      },
    })
    if (!announcement || !announcement.isPublished) {
      return reply.status(404).send({ success: false, error: 'Not found' })
    }
    let isLiked = false
    if (userId) {
      const like = await prisma.announcementLike.findUnique({
        where: { announcementId_userId: { announcementId: id, userId } },
      })
      isLiked = !!like
    }
    return reply.send({
      success: true,
      data: {
        ...announcement,
        likeCount: announcement._count.likes,
        commentCount: announcement._count.comments,
        isLiked,
      },
    })
  })

  // POST /announcements/:id/likes — toggle like (atomic via transaction)
  app.post('/announcements/:id/likes', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const userId = req.userId!
    const existing = await prisma.announcementLike.findUnique({
      where: { announcementId_userId: { announcementId: id, userId } },
    })
    if (existing) {
      await prisma.$transaction([
        prisma.announcementLike.delete({ where: { id: existing.id } }),
      ])
      const count = await prisma.announcementLike.count({ where: { announcementId: id } })
      return reply.send({ success: true, data: { isLiked: false, likeCount: count } })
    }
    await prisma.$transaction([
      prisma.announcementLike.create({ data: { announcementId: id, userId } }),
    ])
    const count = await prisma.announcementLike.count({ where: { announcementId: id } })
    return reply.send({ success: true, data: { isLiked: true, likeCount: count } })
  })

  // GET /announcements/:id/comments
  app.get('/announcements/:id/comments', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { cursor, limit = '20' } = req.query as any
    const comments = await prisma.announcementComment.findMany({
      where: { announcementId: id },
      take: Number(limit),
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
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

  // POST /announcements/:id/comments
  app.post('/announcements/:id/comments', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const userId = req.userId!
    const { text, quranSurah, quranAyah, quranAyahEnd, quranSurahName, quranArabic, quranEnglish } = z.object({
      text: z.string().min(1).max(1000),
      quranSurah: z.number().int().min(1).max(114).optional(),
      quranAyah: z.number().int().min(1).optional(),
      quranAyahEnd: z.number().int().min(1).optional(),
      quranSurahName: z.string().optional(),
      quranArabic: z.string().optional(),
      quranEnglish: z.string().optional(),
    }).parse(req.body)
    const comment = await prisma.announcementComment.create({
      data: { announcementId: id, userId, text, quranSurah, quranAyah, quranSurahName, quranArabic, quranEnglish },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    })
    if (quranAyahEnd) {
      await prisma.$executeRaw`UPDATE announcement_comments SET "quranAyahEnd" = ${quranAyahEnd} WHERE id = ${comment.id}`
    }
    return reply.status(201).send({ success: true, data: { ...comment, quranAyahEnd: quranAyahEnd ?? null } })
  })

  // DELETE /announcements/comments/:commentId
  app.delete('/announcements/comments/:commentId', { preHandler: [requireAuth] }, async (req, reply) => {
    const { commentId } = req.params as { commentId: string }
    const userId = req.userId!
    const comment = await prisma.announcementComment.findUnique({
      where: { id: commentId },
      include: { announcement: { select: { mosqueId: true } } },
    })
    if (!comment) return reply.status(404).send({ success: false, error: 'Not found' })

    if (comment.userId !== userId && !req.isSuperAdmin) {
      const admin = await prisma.mosqueAdmin.findUnique({
        where: { userId_mosqueId: { userId, mosqueId: comment.announcement.mosqueId } },
      })
      if (!admin) return reply.status(403).send({ success: false, error: 'Forbidden' })
    }

    await prisma.announcementComment.delete({ where: { id: commentId } })
    return reply.send({ success: true })
  })

  // POST /mosques/:id/announcements
  app.post(
    '/mosques/:id/announcements',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { id: mosqueId } = req.params as { id: string }
      const body = z
        .object({
          title: z.string().min(3).max(200),
          body: z.string().min(5),
          priority: z.enum(['NORMAL', 'IMPORTANT', 'URGENT']).default('NORMAL'),
          isPinned: z.boolean().default(false),
          imageUrl: z.string().url().optional(),
          videoUrl: z.string().url().optional(),
          publishAt: z.string().datetime().optional(),
          expiresAt: z.string().datetime().optional(),
          quranSurah: z.number().int().min(1).max(114).optional(),
          quranAyah: z.number().int().min(1).optional(),
          quranAyahEnd: z.number().int().min(1).optional(),
          quranSurahName: z.string().optional(),
          quranArabic: z.string().optional(),
          quranEnglish: z.string().optional(),
        })
        .parse(req.body)

      const isScheduled = body.publishAt && new Date(body.publishAt) > new Date()
      const announcement = await prisma.announcement.create({
        data: {
          mosqueId,
          ...body,
          publishAt: body.publishAt ? new Date(body.publishAt) : undefined,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
          isPublished: !isScheduled,
        },
      })

      // Queue push notification only if publishing now (not scheduled)
      if (!isScheduled) {
        await notificationQueue.add('mosque-announcement', {
          type: 'mosque_announcement',
          mosqueId,
          title: body.title,
          body: body.body,
          data: { announcementId: announcement.id, mosqueId },
        })
      }

      return reply.status(201).send({ success: true, data: announcement })
    }
  )

  // PATCH /announcements/:id
  app.patch(
    '/announcements/:id',
    { preHandler: [requireMosqueAdmin(async (req) => { const ann = await prisma.announcement.findUnique({ where: { id: (req.params as any).id }, select: { mosqueId: true } }); return ann?.mosqueId ?? '' })] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const body = z.object({
        title: z.string().min(3).max(200).optional(),
        body: z.string().min(5).optional(),
        priority: z.enum(['NORMAL', 'IMPORTANT', 'URGENT']).optional(),
        isPinned: z.boolean().optional(),
        imageUrl: z.string().url().optional(),
        videoUrl: z.string().url().optional(),
        publishAt: z.string().datetime().optional(),
        expiresAt: z.string().datetime().optional(),
        quranSurah: z.number().int().min(1).max(114).nullable().optional(),
        quranAyah: z.number().int().min(1).nullable().optional(),
        quranAyahEnd: z.number().int().min(1).nullable().optional(),
        quranSurahName: z.string().nullable().optional(),
        quranArabic: z.string().nullable().optional(),
        quranEnglish: z.string().nullable().optional(),
      }).parse(req.body)

      const updated = await prisma.announcement.update({
        where: { id },
        data: {
          ...body,
          publishAt: body.publishAt ? new Date(body.publishAt) : undefined,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
        },
      })

      return reply.send({ success: true, data: updated })
    }
  )

  // DELETE /announcements/:id
  app.delete(
    '/announcements/:id',
    { preHandler: [requireMosqueAdmin(async (req) => {
      const ann = await prisma.announcement.findUnique({
        where: { id: (req.params as any).id },
        select: { mosqueId: true },
      })
      return ann?.mosqueId ?? ''
    })] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      await prisma.announcement.delete({ where: { id } })
      return reply.send({ success: true })
    }
  )
}
