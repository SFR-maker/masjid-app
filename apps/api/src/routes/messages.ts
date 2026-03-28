import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@masjid/database'
import { requireAuth, requireMosqueAdmin } from '../plugins/auth'
import { notificationQueue } from '../workers/notification.worker'

const repliesInclude = {
  replies: { orderBy: { createdAt: 'asc' as const } },
}

export async function messageRoutes(app: FastifyInstance) {
  // POST /mosques/:id/messages — user sends message to mosque
  app.post('/mosques/:id/messages', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id: mosqueId } = req.params as { id: string }
    const body = z.object({
      subject: z.string().max(200).optional(),
      body: z.string().min(5).max(2000),
      quranSurah: z.number().int().min(1).max(114).optional(),
      quranAyah: z.number().int().min(1).optional(),
      quranSurahName: z.string().optional(),
      quranArabic: z.string().optional(),
      quranEnglish: z.string().optional(),
    }).parse(req.body)

    const message = await prisma.directMessage.create({
      data: { mosqueId, fromUserId: req.userId!, ...body },
    })
    return reply.status(201).send({ success: true, data: message })
  })

  // POST /mosques/:id/messages/:messageId/user-reply — user adds to existing thread
  app.post(
    '/mosques/:id/messages/:messageId/user-reply',
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const { id: mosqueId, messageId } = req.params as { id: string; messageId: string }
      const { body } = z.object({ body: z.string().min(1).max(2000) }).parse(req.body)

      // Verify message belongs to this user AND this mosque
      const msg = await prisma.directMessage.findFirst({
        where: { id: messageId, fromUserId: req.userId!, mosqueId },
      })
      if (!msg) return reply.status(404).send({ success: false, error: 'Not found' })

      const r = await prisma.messageReply.create({
        data: { messageId, body, fromAdmin: false },
      })
      // Mark the thread as unread for admin again
      await prisma.directMessage.update({
        where: { id: messageId },
        data: { isRead: false },
      })
      return reply.status(201).send({ success: true, data: r })
    }
  )

  // GET /mosques/:id/messages — admin lists inbox
  app.get(
    '/mosques/:id/messages',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { id: mosqueId } = req.params as { id: string }
      const { limit = '30', cursor } = req.query as any

      const messages = await prisma.directMessage.findMany({
        where: { mosqueId },
        take: Math.min(100, Number(limit) || 30),
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { createdAt: 'desc' },
        include: {
          fromUser: { select: { id: true, name: true, email: true, avatarUrl: true } },
          replies: { orderBy: { createdAt: 'asc' } },
        },
      })

      return reply.send({
        success: true,
        data: {
          items: messages,
          cursor: messages[messages.length - 1]?.id,
          hasMore: messages.length === Number(limit),
          unreadCount: messages.filter((m) => !m.isRead).length,
        },
      })
    }
  )

  // GET /mosques/:id/messages/:messageId
  app.get(
    '/mosques/:id/messages/:messageId',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { id: mosqueId, messageId } = req.params as { id: string; messageId: string }
      // Verify message belongs to this mosque before marking as read
      const message = await prisma.directMessage.findFirst({
        where: { id: messageId, mosqueId },
        include: {
          fromUser: { select: { id: true, name: true, email: true, avatarUrl: true } },
          ...repliesInclude,
        },
      })
      if (!message) return reply.status(404).send({ success: false, error: 'Not found' })
      if (!message.isRead) {
        await prisma.directMessage.update({ where: { id: messageId }, data: { isRead: true } })
        message.isRead = true
      }
      return reply.send({ success: true, data: message })
    }
  )

  // DELETE /mosques/:id/messages/:messageId
  app.delete(
    '/mosques/:id/messages/:messageId',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { messageId } = req.params as { id: string; messageId: string }
      await prisma.directMessage.delete({ where: { id: messageId } })
      return reply.send({ success: true })
    }
  )

  // POST /mosques/:id/messages/:messageId/reply — admin sends reply
  app.post(
    '/mosques/:id/messages/:messageId/reply',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { messageId } = req.params as { id: string; messageId: string }
      const { replyBody } = z.object({ replyBody: z.string().min(1) }).parse(req.body)

      await prisma.messageReply.create({
        data: { messageId, body: replyBody, fromAdmin: true },
      })
      const message = await prisma.directMessage.update({
        where: { id: messageId },
        data: { replyBody, repliedAt: new Date(), isRead: true },
        include: {
          fromUser: { select: { id: true, name: true, email: true, avatarUrl: true } },
          mosque: { select: { name: true } },
          ...repliesInclude,
        },
      })

      // Bug 10 fix: push notification to the user when mosque replies to their message
      if (message.fromUserId) {
        const mosqueName = (message as any).mosque?.name ?? 'Mosque'
        notificationQueue.add('admin_message_reply', {
          type: 'event_rsvp_update', // reuse direct-user path
          userIds: [message.fromUserId],
          mosqueId: (req.params as any).id,
          title: `${mosqueName} replied to your message`,
          body: replyBody.length > 100 ? replyBody.slice(0, 97) + '…' : replyBody,
          data: { messageId, type: 'message_reply' },
        } as any).catch(() => {})
      }

      return reply.send({ success: true, data: message })
    }
  )

  // ── Group Chats ─────────────────────────────────────────────────────────────

  const groupMembersInclude = {
    members: {
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      orderBy: { joinedAt: 'asc' as const },
    },
  }

  // GET /mosques/:id/groups
  app.get(
    '/mosques/:id/groups',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { id: mosqueId } = req.params as { id: string }
      const groups = await prisma.groupChat.findMany({
        where: { mosqueId },
        include: {
          ...groupMembersInclude,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { fromUser: { select: { id: true, name: true } } },
          },
          _count: { select: { members: true, messages: true } },
        },
        orderBy: { updatedAt: 'desc' },
      })
      return reply.send({ success: true, data: { items: groups } })
    }
  )

  // POST /mosques/:id/groups — create group chat
  app.post(
    '/mosques/:id/groups',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { id: mosqueId } = req.params as { id: string }
      const { name, memberIds } = z.object({
        name: z.string().min(1).max(100),
        memberIds: z.array(z.string()).min(1),
      }).parse(req.body)

      const group = await prisma.groupChat.create({
        data: {
          mosqueId,
          name,
          members: {
            create: memberIds.map((userId) => ({ userId })),
          },
        },
        include: {
          ...groupMembersInclude,
          _count: { select: { members: true, messages: true } },
        },
      })
      return reply.status(201).send({ success: true, data: group })
    }
  )

  // GET /mosques/:id/groups/:groupId — fetch group + messages
  app.get(
    '/mosques/:id/groups/:groupId',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { groupId } = req.params as { id: string; groupId: string }
      const group = await prisma.groupChat.findUnique({
        where: { id: groupId },
        include: {
          ...groupMembersInclude,
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 50,
            include: { fromUser: { select: { id: true, name: true, avatarUrl: true } } },
          },
        },
      })
      if (!group) return reply.status(404).send({ success: false, error: 'Group not found' })
      return reply.send({ success: true, data: group })
    }
  )

  // POST /mosques/:id/groups/:groupId/messages — admin sends message
  app.post(
    '/mosques/:id/groups/:groupId/messages',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { groupId } = req.params as { id: string; groupId: string }
      const { body } = z.object({ body: z.string().min(1).max(2000) }).parse(req.body)
      const [msg] = await prisma.$transaction([
        prisma.groupChatMessage.create({
          data: { groupChatId: groupId, body, fromAdmin: true },
        }),
        prisma.groupChat.update({ where: { id: groupId }, data: { updatedAt: new Date() } }),
      ])
      return reply.status(201).send({ success: true, data: msg })
    }
  )

  // POST /mosques/:id/groups/:groupId/members — add members
  app.post(
    '/mosques/:id/groups/:groupId/members',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { groupId } = req.params as { id: string; groupId: string }
      const { userIds } = z.object({ userIds: z.array(z.string()).min(1) }).parse(req.body)
      await prisma.groupChatMember.createMany({
        data: userIds.map((userId) => ({ groupChatId: groupId, userId })),
        skipDuplicates: true,
      })
      return reply.send({ success: true })
    }
  )

  // DELETE /mosques/:id/groups/:groupId/members/:userId
  app.delete(
    '/mosques/:id/groups/:groupId/members/:userId',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { groupId, userId } = req.params as { id: string; groupId: string; userId: string }
      await prisma.groupChatMember.deleteMany({ where: { groupChatId: groupId, userId } })
      return reply.send({ success: true })
    }
  )

  // POST /mosques/:id/groups/:groupId/members/add — add multiple members by userId array
  app.post(
    '/mosques/:id/groups/:groupId/members/add',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { groupId } = req.params as { id: string; groupId: string }
      const { userIds } = z.object({ userIds: z.array(z.string()).min(1) }).parse(req.body)
      // Upsert each — skip duplicates
      await Promise.all(
        userIds.map(userId =>
          prisma.groupChatMember.upsert({
            where: { groupChatId_userId: { groupChatId: groupId, userId } },
            create: { groupChatId: groupId, userId },
            update: {},
          })
        )
      )
      return reply.send({ success: true })
    }
  )

  // POST /mosques/:id/groups/:groupId/invite-link — generate/get invite token
  app.post(
    '/mosques/:id/groups/:groupId/invite-link',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { groupId } = req.params as { id: string; groupId: string }
      const crypto = await import('crypto')
      const token = crypto.randomBytes(16).toString('hex')
      const group = await prisma.groupChat.update({
        where: { id: groupId },
        data: { inviteToken: token },
      })
      return reply.send({ success: true, data: { token: group.inviteToken } })
    }
  )

  // DELETE /mosques/:id/groups/:groupId/invite-link — revoke invite token
  app.delete(
    '/mosques/:id/groups/:groupId/invite-link',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { groupId } = req.params as { id: string; groupId: string }
      await prisma.groupChat.update({ where: { id: groupId }, data: { inviteToken: null } })
      return reply.send({ success: true })
    }
  )

  // POST /group-invite/:token/join — user joins group via invite link
  app.post('/group-invite/:token/join', { preHandler: [requireAuth] }, async (req, reply) => {
    const { token } = req.params as { token: string }
    const group = await prisma.groupChat.findUnique({ where: { inviteToken: token } })
    if (!group) return reply.status(404).send({ success: false, error: 'Invalid or expired invite link' })
    await prisma.groupChatMember.upsert({
      where: { groupChatId_userId: { groupChatId: group.id, userId: req.userId! } },
      create: { groupChatId: group.id, userId: req.userId! },
      update: {},
    })
    return reply.send({ success: true, data: { groupId: group.id, groupName: group.name } })
  })

  // DELETE /mosques/:id/groups/:groupId
  app.delete(
    '/mosques/:id/groups/:groupId',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { groupId } = req.params as { id: string; groupId: string }
      await prisma.groupChat.delete({ where: { id: groupId } })
      return reply.send({ success: true })
    }
  )

  // GET /mosques/:id/groups/:groupId/messages — user fetches group messages (mobile)
  app.get(
    '/mosques/:id/groups/:groupId/messages',
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const { groupId } = req.params as { id: string; groupId: string }
      // Verify user is a member
      const member = await prisma.groupChatMember.findFirst({
        where: { groupChatId: groupId, userId: req.userId! },
      })
      if (!member) return reply.status(403).send({ success: false, error: 'Not a member' })
      const { cursor, limit: limitStr = '50' } = req.query as { cursor?: string; limit?: string }
      const limit = Math.min(Number(limitStr) || 50, 100)
      const messages = await prisma.groupChatMessage.findMany({
        where: { groupChatId: groupId },
        take: limit,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { createdAt: 'desc' },
        include: { fromUser: { select: { id: true, name: true, avatarUrl: true } } },
      })
      return reply.send({
        success: true,
        data: {
          items: messages,
          cursor: messages[messages.length - 1]?.id,
          hasMore: messages.length === limit,
        },
      })
    }
  )

  // POST /mosques/:id/groups/:groupId/user-message — user sends to group chat
  app.post(
    '/mosques/:id/groups/:groupId/user-message',
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const { groupId } = req.params as { id: string; groupId: string }
      const member = await prisma.groupChatMember.findFirst({
        where: { groupChatId: groupId, userId: req.userId! },
      })
      if (!member) return reply.status(403).send({ success: false, error: 'Not a member' })
      const { body } = z.object({ body: z.string().min(1).max(2000) }).parse(req.body)
      const [msg] = await prisma.$transaction([
        prisma.groupChatMessage.create({
          data: { groupChatId: groupId, body, fromAdmin: false, fromUserId: req.userId! },
        }),
        prisma.groupChat.update({ where: { id: groupId }, data: { updatedAt: new Date() } }),
      ])
      return reply.status(201).send({ success: true, data: msg })
    }
  )

  // DELETE /users/me/groups/:groupId — user leaves a group chat
  app.delete('/users/me/groups/:groupId', { preHandler: [requireAuth] }, async (req, reply) => {
    const { groupId } = req.params as { groupId: string }
    await prisma.groupChatMember.deleteMany({
      where: { groupChatId: groupId, userId: req.userId! },
    })
    return reply.send({ success: true })
  })

  // GET /users/me/groups — user's group chats
  app.get('/users/me/groups', { preHandler: [requireAuth] }, async (req, reply) => {
    const memberships = await prisma.groupChatMember.findMany({
      where: { userId: req.userId! },
      include: {
        groupChat: {
          include: {
            mosque: { select: { id: true, name: true, logoUrl: true } },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { fromUser: { select: { id: true, name: true } } },
            },
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { groupChat: { updatedAt: 'desc' } },
    })
    return reply.send({ success: true, data: { items: memberships.map((m) => m.groupChat) } })
  })
}
