import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@masjid/database'
import { requireAuth, requireMosqueAdmin } from '../plugins/auth'
import { notificationQueue } from '../workers/notification.worker'

export async function pollRoutes(app: FastifyInstance) {
  // GET /mosques/:id/polls — list polls for a mosque (admins see all, users see published only)
  app.get('/mosques/:id/polls', async (req, reply) => {
    const { id: mosqueId } = req.params as { id: string }
    const userId = req.userId

    // Check if requester is admin of this mosque
    const isAdmin = userId
      ? !!(await prisma.mosqueAdmin.findUnique({ where: { userId_mosqueId: { userId, mosqueId } } })) || req.isSuperAdmin
      : false

    const polls = await prisma.poll.findMany({
      where: { mosqueId, ...(isAdmin ? {} : { isPublished: true }) },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        options: { orderBy: { order: 'asc' }, include: { _count: { select: { votes: true } } } },
        _count: { select: { votes: true } },
        ...(userId ? { votes: { where: { userId }, select: { optionId: true } } } : {}),
      },
    })

    return reply.send({
      success: true,
      data: {
        items: polls.map((p) => ({
          ...p,
          totalVotes: p._count.votes,
          userVote: (p as any).votes?.[0]?.optionId ?? null,
          options: p.options.map(o => ({ id: o.id, text: o.text, order: o.order, voteCount: o._count.votes })),
          _count: undefined,
          votes: undefined,
        })),
      },
    })
  })

  // POST /mosques/:id/polls — admin creates poll
  app.post(
    '/mosques/:id/polls',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { id: mosqueId } = req.params as { id: string }
      const body = z.object({
        question: z.string().min(5).max(300),
        options: z.array(z.string().min(1).max(200)).min(2).max(6),
        endsAt: z.string().datetime().optional(),
        sendNotification: z.boolean().default(true),
      }).parse(req.body)

      const poll = await prisma.poll.create({
        data: {
          mosqueId,
          question: body.question,
          endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
          options: {
            create: body.options.map((text, i) => ({ text, order: i })),
          },
        },
        include: { options: { orderBy: { order: 'asc' } } },
      })

      // Auto-create an announcement so the poll appears in the feed and admin posts list
      await prisma.announcement.create({
        data: {
          mosqueId,
          title: '📊 New Poll',
          body: body.question,
          priority: 'NORMAL',
        },
      }).catch(() => {}) // Non-fatal — poll still created if this fails

      // Notify mosque followers (unless silenced)
      const mosque = await prisma.mosqueProfile.findUnique({
        where: { id: mosqueId },
        select: { name: true },
      })
      if (body.sendNotification !== false) notificationQueue.add('mosque_poll', {
        type: 'mosque_poll',
        mosqueId,
        title: `New Poll — ${mosque?.name ?? 'Your Mosque'}`,
        body: body.question,
        data: { pollId: poll.id, mosqueId },
      }).catch(() => {})

      return reply.status(201).send({ success: true, data: poll })
    }
  )

  // GET /polls/:id — single poll with user vote status
  app.get('/polls/:id', async (req, reply) => {
    const { id: pollId } = req.params as { id: string }
    const userId = req.userId

    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: {
        mosque: { select: { name: true, logoUrl: true } },
        options: { orderBy: { order: 'asc' }, include: { _count: { select: { votes: true } } } },
        _count: { select: { votes: true } },
        ...(userId ? { votes: { where: { userId }, select: { optionId: true } } } : {}),
      },
    })

    if (!poll || !poll.isPublished) {
      return reply.status(404).send({ success: false, error: 'Not found' })
    }

    return reply.send({
      success: true,
      data: {
        ...poll,
        totalVotes: poll._count.votes,
        userVote: (poll as any).votes?.[0]?.optionId ?? null,
        options: poll.options.map(o => ({ id: o.id, text: o.text, order: o.order, voteCount: o._count.votes })),
        _count: undefined,
        votes: undefined,
      },
    })
  })

  // DELETE /polls/:id — admin
  app.delete('/polls/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const poll = await prisma.poll.findUnique({ where: { id }, select: { mosqueId: true } })
    if (!poll) return reply.status(404).send({ success: false, error: 'Not found' })
    const admin = await prisma.mosqueAdmin.findUnique({
      where: { userId_mosqueId: { userId: req.userId!, mosqueId: poll.mosqueId } },
    })
    if (!admin && !req.isSuperAdmin) return reply.status(403).send({ success: false, error: 'Forbidden' })
    await prisma.poll.delete({ where: { id } })
    return reply.send({ success: true })
  })

  // POST /polls/:id/vote
  app.post('/polls/:id/vote', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id: pollId } = req.params as { id: string }
    const { optionId } = z.object({ optionId: z.string() }).parse(req.body)

    // Verify option belongs to poll
    const option = await prisma.pollOption.findFirst({ where: { id: optionId, pollId } })
    if (!option) return reply.status(400).send({ success: false, error: 'Invalid option' })

    // Check poll not ended
    const poll = await prisma.poll.findUnique({ where: { id: pollId }, select: { endsAt: true } })
    if (poll?.endsAt && poll.endsAt < new Date()) {
      return reply.status(400).send({ success: false, error: 'Poll has ended' })
    }

    const updatedOptions = await prisma.$transaction(async (tx) => {
      await tx.pollVote.upsert({
        where: { pollId_userId: { pollId, userId: req.userId! } },
        create: { pollId, optionId, userId: req.userId! },
        update: { optionId },
      })
      return tx.pollOption.findMany({
        where: { pollId },
        orderBy: { order: 'asc' },
        include: { _count: { select: { votes: true } } },
      })
    })

    const totalVotes = updatedOptions.reduce((s, o) => s + o._count.votes, 0)

    return reply.send({
      success: true,
      data: {
        userVote: optionId,
        totalVotes,
        options: updatedOptions.map(o => ({ id: o.id, text: o.text, order: o.order, voteCount: o._count.votes })),
      },
    })
  })
}
