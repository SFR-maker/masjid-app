import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@masjid/database'
import { requireMosqueAdmin, requireAuth } from '../plugins/auth'

export async function verificationRoutes(app: FastifyInstance) {
  // POST /mosques/:mosqueId/verification — request verification
  app.post(
    '/mosques/:mosqueId/verification',
    { preHandler: [requireAuth, requireMosqueAdmin((req) => (req.params as any).mosqueId)] },
    async (req, reply) => {
      const { mosqueId } = req.params as { mosqueId: string }

      const body = z
        .object({
          notes: z.string().max(1000).optional(),
          websiteUrl: z.string().url().optional(),
          socialUrl: z.string().url().optional(),
        })
        .parse(req.body)

      // Check for existing pending request
      const existing = await prisma.verificationRequest.findFirst({
        where: { mosqueId, status: 'PENDING' },
      })

      if (existing) {
        return reply.status(409).send({ success: false, message: 'A verification request is already pending' })
      }

      const mosque = await prisma.mosqueProfile.findUnique({ where: { id: mosqueId } })
      if (!mosque) return reply.status(404).send({ success: false, message: 'Mosque not found' })
      if (mosque.isVerified) {
        return reply.status(409).send({ success: false, message: 'Mosque is already verified' })
      }

      const request = await prisma.verificationRequest.create({
        data: {
          mosqueId,
          requesterId: req.userId!,
          notes: body.notes,
          documents: {},
        },
      })

      return reply.status(201).send({ success: true, data: request })
    }
  )

  // GET /mosques/:mosqueId/verification — get verification status
  app.get(
    '/mosques/:mosqueId/verification',
    { preHandler: [requireAuth, requireMosqueAdmin((req) => (req.params as any).mosqueId)] },
    async (req, reply) => {
      const { mosqueId } = req.params as { mosqueId: string }
      const request = await prisma.verificationRequest.findFirst({
        where: { mosqueId },
        orderBy: { createdAt: 'desc' },
      })
      return reply.send({ success: true, data: request })
    }
  )
}
