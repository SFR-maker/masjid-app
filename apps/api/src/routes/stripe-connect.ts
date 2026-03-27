import { FastifyInstance } from 'fastify'
import Stripe from 'stripe'
import { prisma } from '@masjid/database'
import { requireAuth, requireMosqueAdmin } from '../plugins/auth'

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  return new Stripe(key)
}

export async function stripeConnectRoutes(app: FastifyInstance) {
  // POST /mosques/:id/connect/onboard
  // Creates (or retrieves) a Stripe Express account and returns the onboarding URL
  app.post(
    '/mosques/:id/connect/onboard',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const stripe = getStripe()
      if (!stripe) {
        return reply.status(503).send({ error: 'Stripe payments are not configured on this server.' })
      }

      const { id: mosqueId } = req.params as { id: string }
      const { returnUrl, refreshUrl } = req.body as { returnUrl: string; refreshUrl: string }

      if (!returnUrl || !refreshUrl) {
        return reply.status(400).send({ error: 'returnUrl and refreshUrl are required' })
      }

      const mosque = await prisma.mosqueProfile.findUnique({
        where: { id: mosqueId },
        select: { id: true, name: true, email: true, stripeAccountId: true },
      })
      if (!mosque) return reply.status(404).send({ error: 'Mosque not found' })

      let accountId = mosque.stripeAccountId

      try {
        // Create a new Express account if not already linked
        if (!accountId) {
          const account = await stripe.accounts.create({
            type: 'express',
            business_type: 'non_profit',
            email: mosque.email ?? undefined,
            business_profile: {
              name: mosque.name,
              product_description: 'Islamic community mosque accepting donations',
              url: `https://masjid.app/mosque/${mosqueId}`,
            },
            metadata: { mosqueId },
          })
          accountId = account.id
          await prisma.mosqueProfile.update({
            where: { id: mosqueId },
            data: { stripeAccountId: accountId },
          })
        }

        // Generate an Account Link for the onboarding flow
        const accountLink = await stripe.accountLinks.create({
          account: accountId,
          refresh_url: refreshUrl,
          return_url: returnUrl,
          type: 'account_onboarding',
        })

        return reply.send({ success: true, data: { url: accountLink.url } })
      } catch (err: any) {
        const message = err?.raw?.message ?? err?.message ?? 'Stripe onboarding failed'
        return reply.status(502).send({ error: message })
      }
    }
  )

  // GET /mosques/:id/connect/status
  // Checks current connection status — calls Stripe to verify charges_enabled
  app.get(
    '/mosques/:id/connect/status',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { id: mosqueId } = req.params as { id: string }

      const mosque = await prisma.mosqueProfile.findUnique({
        where: { id: mosqueId },
        select: { stripeAccountId: true, stripeChargesEnabled: true },
      })
      if (!mosque) return reply.status(404).send({ error: 'Mosque not found' })

      if (!mosque.stripeAccountId) {
        return reply.send({ success: true, data: { connected: false, chargesEnabled: false } })
      }

      // Fetch live status from Stripe
      let chargesEnabled = mosque.stripeChargesEnabled
      let detailsSubmitted = false
      try {
        const stripe = getStripe()
        if (!stripe) throw new Error('Stripe not configured')
        const account = await stripe.accounts.retrieve(mosque.stripeAccountId)
        chargesEnabled = account.charges_enabled
        detailsSubmitted = account.details_submitted

        // Sync to DB if changed
        if (chargesEnabled !== mosque.stripeChargesEnabled) {
          await prisma.mosqueProfile.update({
            where: { id: mosqueId },
            data: { stripeChargesEnabled: chargesEnabled },
          })
        }
      } catch {
        // Stripe API error — fall back to cached value
      }

      return reply.send({
        success: true,
        data: {
          connected: true,
          chargesEnabled,
          detailsSubmitted,
          accountId: mosque.stripeAccountId,
        },
      })
    }
  )

  // GET /mosques/:id/connect/dashboard
  // Returns a Stripe Express dashboard login link (for the mosque admin to view payouts)
  app.get(
    '/mosques/:id/connect/dashboard',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { id: mosqueId } = req.params as { id: string }

      const mosque = await prisma.mosqueProfile.findUnique({
        where: { id: mosqueId },
        select: { stripeAccountId: true, stripeChargesEnabled: true },
      })
      if (!mosque?.stripeAccountId) {
        return reply.status(400).send({ error: 'Mosque has not connected Stripe' })
      }
      if (!mosque.stripeChargesEnabled) {
        return reply.status(400).send({ error: 'Stripe account setup is not complete' })
      }

      const stripe = getStripe()
      if (!stripe) {
        return reply.status(503).send({ error: 'Stripe payments are not configured on this server.' })
      }
      const loginLink = await stripe.accounts.createLoginLink(mosque.stripeAccountId)
      return reply.send({ success: true, data: { url: loginLink.url } })
    }
  )

  // DELETE /mosques/:id/connect
  // Disconnects the Stripe account from this mosque (does not delete the Stripe account)
  app.delete(
    '/mosques/:id/connect',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { id: mosqueId } = req.params as { id: string }

      await prisma.mosqueProfile.update({
        where: { id: mosqueId },
        data: { stripeAccountId: null, stripeChargesEnabled: false },
      })

      return reply.send({ success: true })
    }
  )
}
