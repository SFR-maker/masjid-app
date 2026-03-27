import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@masjid/database'
import { requireAuth } from '../plugins/auth'

export async function checkInRoutes(app: FastifyInstance) {
  // POST /checkins — check in at a mosque
  app.post('/', { preHandler: [requireAuth] }, async (req, reply) => {
    const userId = req.userId!
    const { mosqueId, type } = z
      .object({
        mosqueId: z.string(),
        type: z.enum(['JUMUAH', 'PRAYER']).default('JUMUAH'),
      })
      .parse(req.body)

    const today = new Date()
    const dateOnly = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))

    const checkIn = await prisma.mosqueCheckIn.upsert({
      where: { userId_mosqueId_type_date: { userId, mosqueId, type, date: dateOnly } },
      create: { userId, mosqueId, type, date: dateOnly },
      update: {},
    })

    // Count for today
    const count = await prisma.mosqueCheckIn.count({
      where: { mosqueId, type, date: dateOnly },
    })

    return reply.send({ success: true, data: { checkIn, count } })
  })

  // DELETE /checkins — remove today's check-in
  app.delete('/', { preHandler: [requireAuth] }, async (req, reply) => {
    const userId = req.userId!
    const { mosqueId, type } = z
      .object({ mosqueId: z.string(), type: z.enum(['JUMUAH', 'PRAYER']).default('JUMUAH') })
      .parse(req.query)

    const today = new Date()
    const dateOnly = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))

    await prisma.mosqueCheckIn.deleteMany({
      where: { userId, mosqueId, type, date: dateOnly },
    })

    const count = await prisma.mosqueCheckIn.count({
      where: { mosqueId, type, date: dateOnly },
    })

    return reply.send({ success: true, data: { count } })
  })

  // GET /checkins/:mosqueId — live count + whether current user is checked in
  app.get('/:mosqueId', async (req, reply) => {
    const { mosqueId } = req.params as { mosqueId: string }
    const { type = 'JUMUAH' } = req.query as any
    const userId = req.userId

    const today = new Date()
    const dateOnly = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))

    const [count, userCheckIn] = await Promise.all([
      prisma.mosqueCheckIn.count({ where: { mosqueId, type, date: dateOnly } }),
      userId
        ? prisma.mosqueCheckIn.findUnique({
            where: { userId_mosqueId_type_date: { userId, mosqueId, type, date: dateOnly } },
          })
        : null,
    ])

    return reply.send({
      success: true,
      data: { count, isCheckedIn: !!userCheckIn },
    })
  })
}
