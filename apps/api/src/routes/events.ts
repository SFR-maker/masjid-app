import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@masjid/database'
import { requireAuth, requireMosqueAdmin } from '../plugins/auth'
import { notificationQueue } from '../workers/notification.worker'

function detectEventChanges(
  prev: { title: string; startTime: Date; endTime: Date | null; location: string | null; description: string | null; isCancelled: boolean },
  next: Partial<{ title: string; startTime: string; endTime: string; location: string; description: string; isCancelled: boolean }>
): string[] {
  const changes: string[] = []
  if (next.isCancelled != null && next.isCancelled !== prev.isCancelled) changes.push('cancellation')
  if (next.title != null && next.title !== prev.title) changes.push('title')
  if (next.startTime != null && new Date(next.startTime).getTime() !== new Date(prev.startTime).getTime()) changes.push('date/time')
  if (next.endTime != null && new Date(next.endTime).getTime() !== (prev.endTime ? new Date(prev.endTime).getTime() : 0)) changes.push('end time')
  if (next.location != null && next.location !== prev.location) changes.push('location')
  if (next.description != null && next.description !== prev.description) changes.push('description')
  return changes
}

const CATEGORIES = [
  'GENERAL','HALAQA','YOUTH','SISTERS','JUMU_AH','EID','RAMADAN',
  'FUNDRAISER','JANAZAH','COMMUNITY','EDUCATIONAL','OTHER',
] as const

const eventSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().optional(),
  category: z.enum(CATEGORIES).default('GENERAL'),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  location: z.string().optional(),
  imageUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
  isOnline: z.boolean().default(false),
  onlineUrl: z.string().url().optional(),
  maxAttendees: z.number().int().positive().optional(),
  requiresRsvp: z.boolean().default(true),
  isPrivate: z.boolean().default(false),
  isCancelled: z.boolean().optional(),
  quranSurah: z.number().int().min(1).max(114).nullable().optional(),
  quranAyah: z.number().int().min(1).nullable().optional(),
  quranAyahEnd: z.number().int().min(1).nullable().optional(),
  quranSurahName: z.string().nullable().optional(),
  quranArabic: z.string().nullable().optional(),
  quranEnglish: z.string().nullable().optional(),
})

export async function eventRoutes(app: FastifyInstance) {
  // GET /mosques/:id/events
  app.get('/mosques/:id/events', async (req, reply) => {
    const { id: mosqueId } = req.params as { id: string }
    const { upcoming = 'true', limit = '20', cursor } = req.query as any
    const userId = req.userId

    const now = new Date()

    // Check if userId follows this mosque (for private event visibility)
    let isFollower = false
    if (userId) {
      const follow = await prisma.userFollow.findUnique({
        where: { userId_mosqueId: { userId, mosqueId } },
      })
      isFollower = !!follow
    }

    const events = await prisma.event.findMany({
      where: {
        mosqueId,
        isPublished: true,
        isCancelled: false,
        ...(upcoming === 'true' ? { startTime: { gte: now } } : {}),
        ...(!isFollower ? { isPrivate: false } : {}),
      },
      take: Math.min(100, Number(limit) || 20),
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { startTime: 'asc' },
      include: {
        _count: { select: { rsvps: { where: { status: 'GOING' } } } },
        mosque: { select: { id: true, name: true, logoUrl: true } },
        ...(userId ? { rsvps: { where: { userId }, select: { status: true } } } : {}),
      },
    })

    return reply.send({
      success: true,
      data: {
        items: events.map((e) => ({
          ...e,
          mosqueName: e.mosque.name,
          mosqueId: e.mosque.id,
          mosqueLogoUrl: (e.mosque as any).logoUrl,
          rsvpCount: e._count.rsvps,
          userRsvp: (e as any).rsvps?.[0]?.status ?? null,
          _count: undefined,
          rsvps: undefined,
          mosque: undefined,
        })),
        cursor: events[events.length - 1]?.id,
        hasMore: events.length === Number(limit),
      },
    })
  })

  // POST /mosques/:id/events
  app.post(
    '/mosques/:id/events',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { id: mosqueId } = req.params as { id: string }
      const body = eventSchema.parse(req.body)
      const event = await prisma.event.create({ data: { mosqueId, ...body } })
      return reply.status(201).send({ success: true, data: event })
    }
  )

  // GET /events/:id
  app.get('/events/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const userId = req.userId

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        mosque: { select: { id: true, name: true, slug: true, logoUrl: true, isVerified: true } },
        _count: { select: { rsvps: { where: { status: 'GOING' } } } },
        ...(userId ? { rsvps: { where: { userId }, select: { status: true } } } : {}),
      },
    })

    if (!event) return reply.status(404).send({ success: false, error: 'Event not found' })

    if (event.isPrivate) {
      const canView = userId
        ? !!(await prisma.userFollow.findUnique({
            where: { userId_mosqueId: { userId, mosqueId: event.mosqueId } },
          }))
        : false
      if (!canView) return reply.status(403).send({ success: false, error: 'This event is private' })
    }

    return reply.send({
      success: true,
      data: {
        ...event,
        rsvpCount: event._count.rsvps,
        userRsvp: (event as any).rsvps?.[0]?.status ?? null,
        _count: undefined,
        rsvps: undefined,
      },
    })
  })

  // PUT /events/:id
  app.put('/events/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const event = await prisma.event.findUnique({ where: { id } })
    if (!event) return reply.status(404).send({ success: false, error: 'Event not found' })

    const admin = await prisma.mosqueAdmin.findUnique({
      where: { userId_mosqueId: { userId: req.userId!, mosqueId: event.mosqueId } },
    })
    if (!admin && !req.isSuperAdmin) {
      return reply.status(403).send({ success: false, error: 'Forbidden' })
    }

    const body = eventSchema.partial().parse(req.body)
    const updated = await prisma.event.update({ where: { id }, data: body })

    // Notify RSVP'd users if meaningful fields changed
    const changed = detectEventChanges(event, body)
    if (changed.length > 0) {
      const rsvps = await prisma.eventRsvp.findMany({
        where: { eventId: id, status: { in: ['GOING', 'MAYBE'] } },
        select: { userId: true },
      })
      const userIds = rsvps.map((r) => r.userId)
      if (userIds.length > 0) {
        const isCancelled = body.isCancelled ?? false
        const title = isCancelled
          ? `❌ Event Cancelled: ${updated.title}`
          : `📅 Event Updated: ${updated.title}`
        const body2 = isCancelled
          ? `This event has been cancelled.`
          : `Changes: ${changed.join(', ')}.`
        await notificationQueue.add('event_rsvp_update', {
          type: 'event_rsvp_update',
          mosqueId: event.mosqueId,
          eventId: id,
          userIds,
          title,
          body: body2,
          data: { eventId: id, type: 'event_update' },
        })
      }
    }

    return reply.send({ success: true, data: updated })
  })

  // DELETE /events/:id
  app.delete('/events/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const event = await prisma.event.findUnique({ where: { id } })
    if (!event) return reply.status(404).send({ success: false, error: 'Event not found' })

    const admin = await prisma.mosqueAdmin.findUnique({
      where: { userId_mosqueId: { userId: req.userId!, mosqueId: event.mosqueId } },
    })
    if (!admin && !req.isSuperAdmin) {
      return reply.status(403).send({ success: false, error: 'Forbidden' })
    }

    await prisma.event.delete({ where: { id } })
    return reply.send({ success: true })
  })

  // POST /events/:id/rsvp
  app.post('/events/:id/rsvp', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id: eventId } = req.params as { id: string }
    const { status } = z
      .object({ status: z.enum(['GOING', 'NOT_GOING', 'MAYBE']) })
      .parse(req.body)

    const rsvp = await prisma.eventRsvp.upsert({
      where: { eventId_userId: { eventId, userId: req.userId! } },
      create: { eventId, userId: req.userId!, status },
      update: { status },
    })

    return reply.send({ success: true, data: rsvp })
  })

  // DELETE /events/:id/rsvp
  app.delete('/events/:id/rsvp', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id: eventId } = req.params as { id: string }
    await prisma.eventRsvp.deleteMany({ where: { eventId, userId: req.userId! } })
    return reply.send({ success: true })
  })

  // GET /events/:id/rsvps — admin only
  app.get('/events/:id/rsvps', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const event = await prisma.event.findUnique({ where: { id }, select: { mosqueId: true } })
    if (!event) return reply.status(404).send({ success: false, error: 'Not found' })
    const admin = await prisma.mosqueAdmin.findUnique({
      where: { userId_mosqueId: { userId: req.userId!, mosqueId: event.mosqueId } },
    })
    if (!admin && !req.isSuperAdmin) return reply.status(403).send({ success: false, error: 'Forbidden' })
    const rsvps = await prisma.eventRsvp.findMany({
      where: { eventId: id },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
    })
    const counts = { GOING: 0, MAYBE: 0, NOT_GOING: 0 }
    for (const r of rsvps) counts[r.status as keyof typeof counts]++
    return reply.send({ success: true, data: { items: rsvps, counts } })
  })
}
