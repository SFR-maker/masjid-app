import { FastifyInstance } from 'fastify'
import { Webhook } from 'svix'
import { prisma } from '@masjid/database'

export async function authRoutes(app: FastifyInstance) {
  // Clerk webhook — syncs users to our database
  app.post('/webhook', async (req, reply) => {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET

    if (!webhookSecret || webhookSecret === 'whsec_placeholder') {
      return reply.status(503).send({ error: 'Webhook secret not configured' })
    }

    const svix = new Webhook(webhookSecret)

    const headers = {
      'svix-id': req.headers['svix-id'] as string,
      'svix-timestamp': req.headers['svix-timestamp'] as string,
      'svix-signature': req.headers['svix-signature'] as string,
    }

    let event: any
    const rawBody = (req as any).rawBody ?? JSON.stringify(req.body)
    try {
      event = svix.verify(rawBody, headers)
    } catch {
      return reply.status(400).send({ error: 'Invalid webhook signature' })
    }

    const { type, data } = event

    if (type === 'user.created' || type === 'user.updated') {
      const email = data.email_addresses?.[0]?.email_address ?? ''
      const name = [data.first_name, data.last_name].filter(Boolean).join(' ')
      const avatarUrl = data.image_url ?? null

      await prisma.user.upsert({
        where: { clerkId: data.id },
        update: { email, name, avatarUrl },
        create: { clerkId: data.id, email, name, avatarUrl },
      })
    }

    if (type === 'user.deleted') {
      await prisma.user.deleteMany({ where: { clerkId: data.id } })
    }

    return reply.send({ received: true })
  })
}
