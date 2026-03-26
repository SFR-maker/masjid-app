import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@masjid/database'
import { requireAuth, requireMosqueAdmin } from '../plugins/auth'

const DONATION_CATEGORIES = [
  'GENERAL','ZAKAT','SADAQAH','BUILDING_FUND','RAMADAN','EID',
  'YOUTH_PROGRAMS','EDUCATION','OTHER',
] as const

export async function donationRoutes(app: FastifyInstance) {
  // GET /mosques/:id/donations — list active campaigns
  app.get('/mosques/:id/donations', async (req, reply) => {
    const { id: mosqueId } = req.params as { id: string }

    const now = new Date()
    const campaigns = await prisma.donationCampaign.findMany({
      where: {
        mosqueId,
        isActive: true,
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      },
      include: {
        _count: { select: { donations: true } },
        donations: { select: { amount: true } },
      },
    })

    const result = campaigns.map((c) => ({
      ...c,
      totalRaised: c.donations.reduce((sum, d) => sum + Number(d.amount), 0),
      donorCount: c._count.donations,
      donations: undefined,
      _count: undefined,
    }))

    return reply.send({ success: true, data: result })
  })

  // POST /mosques/:id/donations/campaigns
  app.post(
    '/mosques/:id/donations/campaigns',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { id: mosqueId } = req.params as { id: string }
      const body = z
        .object({
          title: z.string().min(3),
          description: z.string().optional(),
          category: z.enum(DONATION_CATEGORIES).default('GENERAL'),
          goalAmount: z.number().positive().optional(),
          endsAt: z.string().datetime().optional(),
        })
        .parse(req.body)

      const campaign = await prisma.donationCampaign.create({
        data: { mosqueId, ...body },
      })

      return reply.status(201).send({ success: true, data: campaign })
    }
  )
}
