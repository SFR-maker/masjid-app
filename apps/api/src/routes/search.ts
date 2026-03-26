import { FastifyInstance } from 'fastify'
import { prisma } from '@masjid/database'

export async function searchRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    const { q, type } = req.query as { q: string; type?: string }

    if (!q || q.length < 2) {
      return reply.send({ success: true, data: { mosques: [], events: [], videos: [] } })
    }

    const [mosques, events, videos] = await Promise.all([
      !type || type === 'mosques'
        ? prisma.mosqueProfile.findMany({
            where: {
              isActive: true,
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { city: { contains: q, mode: 'insensitive' } },
                { imamName: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
              ],
            },
            take: 10,
            select: {
              id: true, name: true, city: true, state: true, logoUrl: true, isVerified: true,
            },
          })
        : [],

      !type || type === 'events'
        ? prisma.event.findMany({
            where: {
              isPublished: true,
              isCancelled: false,
              startTime: { gte: new Date() },
              OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
              ],
            },
            take: 10,
            include: { mosque: { select: { name: true } } },
          })
        : [],

      !type || type === 'videos'
        ? prisma.video.findMany({
            where: {
              isPublished: true,
              status: 'READY',
              OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
                { tags: { has: q.toLowerCase() } },
              ],
            },
            take: 10,
            include: { mosque: { select: { name: true } } },
          })
        : [],
    ])

    return reply.send({ success: true, data: { mosques, events, videos } })
  })
}
