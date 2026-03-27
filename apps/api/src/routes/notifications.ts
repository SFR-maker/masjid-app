import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@masjid/database'
import { requireAuth } from '../plugins/auth'

const NOTIFICATION_TYPES = [
  'PRAYER_REMINDER','EVENT_REMINDER','ANNOUNCEMENT','NEW_VIDEO',
  'RSVP_CONFIRMED','MOSQUE_VERIFIED','GENERAL',
  'JUMUAH_REMINDER','AYAH_OF_DAY','RSVP_REMINDER','NEAR_ME',
] as const

export async function notificationRoutes(app: FastifyInstance) {
  // GET /notifications
  app.get('/', { preHandler: [requireAuth] }, async (req, reply) => {
    const { limit = '30', cursor } = req.query as any

    const notifications = await prisma.notification.findMany({
      where: { userId: req.userId! },
      take: Math.min(100, Number(limit) || 20),
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: 'desc' },
      include: { mosque: { select: { name: true, logoUrl: true } } },
    })

    return reply.send({
      success: true,
      data: {
        items: notifications.map((n) => ({
          ...n,
          mosqueName: n.mosque?.name,
          mosqueLogoUrl: n.mosque?.logoUrl,
          mosque: undefined,
        })),
        cursor: notifications[notifications.length - 1]?.id,
        hasMore: notifications.length === Number(limit),
        unreadCount: notifications.filter((n) => !n.isRead).length,
      },
    })
  })

  // PUT /notifications/:id/read
  app.put('/:id/read', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await prisma.notification.updateMany({
      where: { id, userId: req.userId! },
      data: { isRead: true },
    })
    return reply.send({ success: true })
  })

  // PUT /notifications/read-all
  app.put('/read-all', { preHandler: [requireAuth] }, async (req, reply) => {
    await prisma.notification.updateMany({
      where: { userId: req.userId!, isRead: false },
      data: { isRead: true },
    })
    return reply.send({ success: true })
  })

  // DELETE /notifications/clear-all
  app.delete('/clear-all', { preHandler: [requireAuth] }, async (req, reply) => {
    await prisma.notification.deleteMany({ where: { userId: req.userId! } })
    return reply.send({ success: true })
  })

  // GET /notifications/preferences
  app.get('/preferences', { preHandler: [requireAuth] }, async (req, reply) => {
    const prefs = await prisma.notificationPreference.findMany({
      where: { userId: req.userId! },
    })
    return reply.send({ success: true, data: prefs })
  })

  // PUT /notifications/preferences
  app.put('/preferences', { preHandler: [requireAuth] }, async (req, reply) => {
    const body = z
      .object({
        type: z.enum(NOTIFICATION_TYPES),
        enabled: z.boolean(),
        mosqueId: z.string().optional(),
      })
      .parse(req.body)

    const pref = await prisma.notificationPreference.upsert({
      where: {
        userId_type_mosqueId: {
          userId: req.userId!,
          type: body.type,
          mosqueId: body.mosqueId ?? '',
        },
      },
      create: { userId: req.userId!, ...body },
      update: { enabled: body.enabled },
    })

    return reply.send({ success: true, data: pref })
  })

  // POST /notifications/push-token
  app.post('/push-token', { preHandler: [requireAuth] }, async (req, reply) => {
    const { token, platform } = z
      .object({ token: z.string(), platform: z.enum(['ios', 'android']) })
      .parse(req.body)

    await prisma.pushToken.upsert({
      where: { token },
      create: { userId: req.userId!, token, platform },
      update: { userId: req.userId! },
    })

    return reply.send({ success: true })
  })
}
