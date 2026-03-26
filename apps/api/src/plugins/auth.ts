import fp from 'fastify-plugin'
import { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { verifyToken } from '@clerk/backend'
import { clerkClient } from '../lib/clerk'
import { prisma } from '@masjid/database'

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string
    clerkId?: string
    isSuperAdmin?: boolean
  }
}

const authPlugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest('userId', null)
  app.decorateRequest('clerkId', null)
  app.decorateRequest('isSuperAdmin', false)

  app.addHook('preHandler', async (req: FastifyRequest) => {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) return

    try {
      const token = authHeader.split(' ')[1]
      const { sub: clerkId } = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY!,
      })

      let user = await prisma.user.findUnique({
        where: { clerkId },
        select: { id: true, isSuperAdmin: true },
      })

      // Auto-create user on first login (fallback when webhook hasn't fired)
      if (!user) {
        const clerkUser = await clerkClient.users.getUser(clerkId)
        const email = clerkUser.emailAddresses[0]?.emailAddress ?? ''
        const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ')
        const avatarUrl = clerkUser.imageUrl ?? null
        user = await prisma.user.create({
          data: { clerkId, email, name, avatarUrl },
          select: { id: true, isSuperAdmin: true },
        })
      }

      req.userId = user.id
      req.clerkId = clerkId
      req.isSuperAdmin = user.isSuperAdmin
    } catch (err) {
      req.log.warn({ err }, 'Auth failed')
    }
  })
}

export const authenticationPlugin = fp(authPlugin)

export async function requireAuth(req: FastifyRequest, reply: any) {
  if (!req.userId) {
    return reply.status(401).send({ success: false, error: 'Authentication required' })
  }
}

export async function requireSuperAdmin(req: FastifyRequest, reply: any) {
  if (!req.userId || !req.isSuperAdmin) {
    return reply.status(403).send({ success: false, error: 'Super admin access required' })
  }
}

/** Passes if the user is an admin of ANY mosque (or super admin). Used for cross-mosque utilities like user search. */
export async function requireAnyMosqueAdmin(req: FastifyRequest, reply: any) {
  if (!req.userId) {
    return reply.status(401).send({ success: false, error: 'Authentication required' })
  }
  if (req.isSuperAdmin) return
  const admin = await prisma.mosqueAdmin.findFirst({ where: { userId: req.userId } })
  if (!admin) {
    return reply.status(403).send({ success: false, error: 'Mosque admin access required' })
  }
}

export function requireMosqueAdmin(getMosqueId: (req: FastifyRequest) => string | Promise<string>) {
  return async function (req: FastifyRequest, reply: any) {
    if (!req.userId) {
      return reply.status(401).send({ success: false, error: 'Authentication required' })
    }

    const mosqueId = await getMosqueId(req)
    const admin = await prisma.mosqueAdmin.findUnique({
      where: { userId_mosqueId: { userId: req.userId, mosqueId } },
    })

    if (!admin && !req.isSuperAdmin) {
      return reply.status(403).send({ success: false, error: 'Mosque admin access required' })
    }
  }
}
