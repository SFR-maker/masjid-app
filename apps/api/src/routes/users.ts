import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@masjid/database'
import { requireAuth } from '../plugins/auth'

export async function userRoutes(app: FastifyInstance) {
  // GET /users/me
  app.get('/me', { preHandler: [requireAuth] }, async (req, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { id: true, email: true, name: true, avatarUrl: true, bio: true, madhabPreference: true, birthdate: true, gender: true, isOpenToVolunteer: true, createdAt: true },
    })
    // Fetch isOpenToMarriage via raw SQL until Prisma client is regenerated
    const extra = await prisma.$queryRaw<{ isOpenToMarriage: boolean }[]>`
      SELECT "isOpenToMarriage" FROM users WHERE id = ${req.userId!} LIMIT 1
    `
    return reply.send({ success: true, data: { ...user, isOpenToMarriage: extra[0]?.isOpenToMarriage ?? false } })
  })

  // PATCH /users/me — update profile preferences
  app.patch('/me', { preHandler: [requireAuth] }, async (req, reply) => {
    const body = z.object({
      madhabPreference: z.enum(['STANDARD', 'HANAFI']).optional(),
      bio: z.string().max(500).optional(),
      birthdate: z.string().datetime().optional().nullable(),
      gender: z.enum(['MALE', 'FEMALE', 'PREFER_NOT_TO_SAY']).optional().nullable(),
      isOpenToVolunteer: z.boolean().optional(),
      isOpenToMarriage: z.boolean().optional(),
    }).parse(req.body)
    // Build update data explicitly — only fields the generated Prisma client knows about
    const data: Record<string, unknown> = {}
    if (body.madhabPreference !== undefined) data.madhabPreference = body.madhabPreference
    if (body.bio !== undefined) data.bio = body.bio
    if (body.birthdate !== undefined) data.birthdate = body.birthdate ? new Date(body.birthdate) : null
    if (body.gender !== undefined) data.gender = body.gender
    if (body.isOpenToVolunteer !== undefined) data.isOpenToVolunteer = body.isOpenToVolunteer
    const user = await prisma.user.update({
      where: { id: req.userId! },
      data,
      select: { id: true, email: true, name: true, avatarUrl: true, bio: true, madhabPreference: true, birthdate: true, gender: true, isOpenToVolunteer: true },
    })
    // isOpenToMarriage is a new column — update via raw SQL until Prisma client is regenerated
    if (body.isOpenToMarriage !== undefined) {
      await prisma.$executeRaw`UPDATE users SET "isOpenToMarriage" = ${body.isOpenToMarriage} WHERE id = ${req.userId!}`
    }
    return reply.send({ success: true, data: user })
  })

  // GET /users/me/follows
  app.get('/me/follows', { preHandler: [requireAuth] }, async (req, reply) => {
    const follows = await prisma.userFollow.findMany({
      where: { userId: req.userId! },
      include: {
        mosque: {
          select: {
            id: true, name: true, city: true, state: true,
            logoUrl: true, isVerified: true,
            _count: { select: { follows: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return reply.send({
      success: true,
      data: {
        items: follows.map((f) => ({
          ...f.mosque,
          isFavorite: f.isFavorite,
          followersCount: f.mosque._count.follows,
          _count: undefined,
        })),
      },
    })
  })

  // GET /users/me/feed — activity feed from followed mosques
  app.get('/me/feed', { preHandler: [requireAuth] }, async (req, reply) => {
    const { before, limit: limitStr = '12' } = req.query as { before?: string; limit?: string }
    const limit = Math.min(Number(limitStr) || 12, 50)
    // Guard against invalid date strings that would produce 'Invalid Date' → Prisma crash
    const parsedBefore = before ? new Date(before) : undefined
    const beforeDate = parsedBefore && !isNaN(parsedBefore.getTime()) ? parsedBefore : undefined

    const follows = await prisma.userFollow.findMany({
      where: { userId: req.userId! },
      select: { mosqueId: true },
    })
    const mosqueIds = follows.map((f) => f.mosqueId)

    if (!mosqueIds.length) {
      return reply.send({ success: true, data: { items: [], hasMore: false } })
    }

    const userId = req.userId!
    // Fetch more than needed so we can slice after merging
    const fetchCount = limit * 2 + 5

    const [announcements, events, videos, polls] = await Promise.all([
      prisma.announcement.findMany({
        where: {
          mosqueId: { in: mosqueIds },
          isPublished: true,
          ...(beforeDate ? { createdAt: { lt: beforeDate } } : {}),
        },
        take: fetchCount,
        orderBy: { createdAt: 'desc' },
        include: {
          mosque: { select: { name: true, logoUrl: true } },
          _count: { select: { likes: true, comments: true } },
        },
      }),
      prisma.event.findMany({
        where: {
          mosqueId: { in: mosqueIds },
          isPublished: true,
          isCancelled: false,
          startTime: { gte: new Date() },
          ...(beforeDate ? { startTime: { lt: beforeDate } } : {}),
        },
        take: Math.ceil(fetchCount / 2),
        orderBy: { startTime: 'asc' },
        include: { mosque: { select: { name: true, logoUrl: true } } },
      }),
      prisma.video.findMany({
        where: {
          mosqueId: { in: mosqueIds },
          status: 'READY',
          ...(beforeDate ? { createdAt: { lt: beforeDate } } : {}),
        },
        take: Math.ceil(fetchCount / 2),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, title: true, description: true, category: true,
          thumbnailUrl: true, viewCount: true, createdAt: true, mosqueId: true,
          mosque: { select: { name: true, logoUrl: true } },
        },
      }),
      prisma.poll.findMany({
        where: {
          mosqueId: { in: mosqueIds },
          isPublished: true,
          ...(beforeDate ? { createdAt: { lt: beforeDate } } : {}),
        },
        take: Math.ceil(fetchCount / 2),
        orderBy: { createdAt: 'desc' },
        include: {
          mosque: { select: { name: true, logoUrl: true } },
          options: { orderBy: { order: 'asc' }, include: { _count: { select: { votes: true } } } },
          _count: { select: { votes: true } },
          votes: { where: { userId }, select: { optionId: true } },
        },
      }),
    ])

    // Check which announcements the user has liked
    const announcementIds = announcements.map((a) => a.id)
    const userLikes = announcementIds.length
      ? await prisma.announcementLike.findMany({
          where: { announcementId: { in: announcementIds }, userId },
          select: { announcementId: true },
        })
      : []
    const likedSet = new Set(userLikes.map((l) => l.announcementId))

    const merged = [
      ...announcements.map((a) => ({
        ...a,
        type: 'announcement',
        sortDate: a.createdAt,
        likeCount: a._count.likes,
        commentCount: a._count.comments,
        isLiked: likedSet.has(a.id),
        _count: undefined,
      })),
      ...events.map((e) => ({ ...e, type: 'event', sortDate: e.startTime })),
      ...videos.map((v) => ({ ...v, type: 'video', sortDate: v.createdAt })),
      ...polls.map((p) => ({
        ...p,
        type: 'poll',
        sortDate: p.createdAt,
        totalVotes: p._count.votes,
        userVote: p.votes?.[0]?.optionId ?? null,
        options: p.options.map(o => ({ id: o.id, text: o.text, order: o.order, voteCount: o._count.votes })),
        _count: undefined,
        votes: undefined,
      })),
    ].sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime())

    const page = merged.slice(0, limit)
    const hasMore = merged.length > limit
    const nextCursor = hasMore ? page[page.length - 1]?.sortDate.toISOString() : null

    return reply.send({ success: true, data: { items: page, hasMore, cursor: nextCursor } })
  })

  // GET /users/me/rsvps
  // Bug 3 fix: only return positive RSVPs (GOING/MAYBE) — NOT_GOING is excluded
  app.get('/me/rsvps', { preHandler: [requireAuth] }, async (req, reply) => {
    const rsvps = await prisma.eventRsvp.findMany({
      where: {
        userId: req.userId!,
        status: { in: ['GOING', 'MAYBE'] },
      },
      include: { event: { include: { mosque: { select: { name: true } } } } },
      orderBy: { event: { startTime: 'asc' } },
    })
    return reply.send({ success: true, data: { items: rsvps } })
  })

  // GET /users/me/messages — user's sent messages + replies
  app.get('/me/messages', { preHandler: [requireAuth] }, async (req, reply) => {
    const { cursor, limit: limitStr = '50' } = req.query as { cursor?: string; limit?: string }
    const limit = Math.min(Number(limitStr) || 50, 100)
    const messages = await prisma.directMessage.findMany({
      where: { fromUserId: req.userId! },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        mosque: { select: { id: true, name: true, logoUrl: true } },
        replies: { orderBy: { createdAt: 'asc' } },
      },
    })
    // A thread counts as unread if the most recent reply is from admin
    const unreadCount = messages.filter((m) => {
      const last = m.replies[m.replies.length - 1]
      return last?.fromAdmin === true
    }).length
    return reply.send({
      success: true,
      data: {
        items: messages,
        unreadCount,
        cursor: messages[messages.length - 1]?.id,
        hasMore: messages.length === limit,
      },
    })
  })

  // DELETE /users/me/messages/:messageId — user deletes their conversation
  app.delete('/me/messages/:messageId', { preHandler: [requireAuth] }, async (req, reply) => {
    const { messageId } = req.params as { messageId: string }
    // Verify the message belongs to this user before deleting
    const msg = await prisma.directMessage.findFirst({
      where: { id: messageId, fromUserId: req.userId! },
      select: { id: true },
    })
    if (!msg) return reply.status(404).send({ success: false, error: 'Not found' })
    await prisma.directMessage.delete({ where: { id: messageId } })
    return reply.send({ success: true })
  })
}
