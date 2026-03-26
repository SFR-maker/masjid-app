import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@masjid/database'
import { requireAuth } from '../plugins/auth'

export async function reportRoutes(app: FastifyInstance) {
  // POST /reports — submit a content report
  app.post('/', { preHandler: [requireAuth] }, async (req, reply) => {
    const body = z
      .object({
        targetType: z.enum(['MOSQUE', 'EVENT', 'VIDEO', 'ANNOUNCEMENT', 'USER']),
        targetId: z.string().min(1),
        type: z.enum(['INAPPROPRIATE_CONTENT', 'MISINFORMATION', 'SPAM', 'FAKE_MOSQUE', 'OTHER']).default('INAPPROPRIATE_CONTENT'),
        reason: z.string().min(1).max(500),
      })
      .parse(req.body)

    const report = await prisma.report.create({
      data: {
        type: body.type,
        targetType: body.targetType,
        targetId: body.targetId,
        reason: body.reason,
        reporterId: req.userId!,
      },
    })

    return reply.status(201).send({ success: true, data: report })
  })
}
