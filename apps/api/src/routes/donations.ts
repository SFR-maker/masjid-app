import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import Stripe from 'stripe'
import { prisma } from '@masjid/database'
import { requireAuth, requireMosqueAdmin } from '../plugins/auth'

const DONATION_CATEGORIES = [
  'GENERAL','ZAKAT','SADAQAH','BUILDING_FUND','RAMADAN','EID',
  'YOUTH_PROGRAMS','EDUCATION','SPECIAL_EVENT','MOSQUE_MAINTENANCE',
  'MEMBERSHIP_DUES','SUBSCRIPTION','OTHER',
] as const

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured')
  return new Stripe(key)
}

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

  // POST /mosques/:id/donations/payment-intent
  // Creates a Stripe PaymentIntent and a pending Donation record
  app.post(
    '/mosques/:id/donations/payment-intent',
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const { id: mosqueId } = req.params as { id: string }
      const userId = (req as any).userId as string

      const body = z
        .object({
          amount: z.number().int().min(100), // cents
          currency: z.string().default('usd'),
          campaignId: z.string().optional(),
          category: z.enum(DONATION_CATEGORIES).default('GENERAL'),
          isAnonymous: z.boolean().default(false),
        })
        .parse(req.body)

      const mosque = await prisma.mosqueProfile.findUnique({
        where: { id: mosqueId },
        select: { id: true, name: true, stripeAccountId: true },
      })
      if (!mosque) return reply.status(404).send({ error: 'Mosque not found' })

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      })

      const stripe = getStripe()

      // Build transfer_data if mosque has a connected Stripe account
      const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
        amount: body.amount,
        currency: body.currency,
        automatic_payment_methods: { enabled: true },
        receipt_email: user?.email ?? undefined,
        metadata: {
          mosqueId,
          userId,
          campaignId: body.campaignId ?? '',
          category: body.category,
          isAnonymous: String(body.isAnonymous),
          app: 'masjid',
        },
        ...(mosque.stripeAccountId
          ? {
              transfer_data: {
                destination: mosque.stripeAccountId,
              },
            }
          : {}),
      }

      const intent = await stripe.paymentIntents.create(paymentIntentParams)

      // Create a pending Donation record
      await prisma.donation.create({
        data: {
          userId: body.isAnonymous ? null : userId,
          mosqueId,
          campaignId: body.campaignId,
          amount: body.amount / 100,
          currency: body.currency.toUpperCase(),
          category: body.category,
          isAnonymous: body.isAnonymous,
          stripePaymentIntentId: intent.id,
          status: 'pending',
        },
      })

      return reply.send({
        success: true,
        data: {
          clientSecret: intent.client_secret,
          paymentIntentId: intent.id,
          publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
        },
      })
    }
  )

  // POST /stripe/webhook — handle Stripe payment_intent.succeeded
  app.post(
    '/stripe/webhook',
    { config: { rawBody: true } },
    async (req, reply) => {
      const sig = req.headers['stripe-signature'] as string
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

      if (!webhookSecret) {
        app.log.error('STRIPE_WEBHOOK_SECRET is not configured — rejecting webhook to prevent forged events')
        return reply.status(500).send({ error: 'Webhook secret not configured' })
      }

      let event: Stripe.Event
      try {
        const stripe = getStripe()
        const rawBody = (req as any).rawBody ?? JSON.stringify(req.body)
        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
      } catch {
        return reply.status(400).send({ error: 'Webhook signature verification failed' })
      }

      if (event.type === 'payment_intent.succeeded') {
        const intent = event.data.object as Stripe.PaymentIntent
        await prisma.donation.updateMany({
          where: { stripePaymentIntentId: intent.id },
          data: { status: 'completed' },
        })
      }

      if (event.type === 'payment_intent.payment_failed') {
        const intent = event.data.object as Stripe.PaymentIntent
        await prisma.donation.updateMany({
          where: { stripePaymentIntentId: intent.id },
          data: { status: 'failed' },
        })
      }

      return reply.send({ received: true })
    }
  )

  // GET /users/me/donations — authenticated user's donation history
  app.get(
    '/users/me/donations',
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const userId = (req as any).userId as string

      const donations = await prisma.donation.findMany({
        where: { userId, status: 'completed' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          campaign: { select: { id: true, title: true } },
        },
      })

      // Attach mosque name for each donation
      const mosqueIds = [...new Set(donations.map((d) => d.mosqueId))]
      const mosques = await prisma.mosqueProfile.findMany({
        where: { id: { in: mosqueIds } },
        select: { id: true, name: true, logoUrl: true },
      })
      const mosqueMap = Object.fromEntries(mosques.map((m) => [m.id, m]))

      const result = donations.map((d) => ({
        id: d.id,
        amount: Number(d.amount),
        currency: d.currency,
        category: d.category,
        isAnonymous: d.isAnonymous,
        status: d.status,
        createdAt: d.createdAt,
        campaign: d.campaign,
        mosque: mosqueMap[d.mosqueId] ?? null,
      }))

      return reply.send({ success: true, data: result })
    }
  )
}
