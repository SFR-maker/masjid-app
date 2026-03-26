import { Worker, Queue } from 'bullmq'
import { Expo, ExpoPushMessage } from 'expo-server-sdk'
import { prisma } from '@masjid/database'
import { redis } from '../lib/redis'

export const notificationQueue = new Queue('notifications', { connection: redis as any })

const expo = new Expo()

export interface NotificationJob {
  type: 'mosque_announcement' | 'mosque_poll' | 'event_reminder' | 'event_rsvp_update' | 'prayer_reminder'
  mosqueId?: string
  eventId?: string
  userIds?: string[]
  title: string
  body: string
  data?: Record<string, string>
}

new Worker<NotificationJob>(
  'notifications',
  async (job) => {
    const { type, mosqueId, title, body, data } = job.data

    let userIds: string[] = []

    // Notification DB type mapping
    const notifType = (type === 'mosque_announcement' || type === 'mosque_poll')
      ? 'ANNOUNCEMENT' as const
      : 'EVENT_REMINDER' as const

    if ((type === 'mosque_announcement' || type === 'mosque_poll') && mosqueId) {
      // Respect notification preferences — exclude users who opted out
      const [follows, optedOut] = await Promise.all([
        prisma.userFollow.findMany({ where: { mosqueId }, select: { userId: true } }),
        prisma.notificationPreference.findMany({
          where: { mosqueId, type: notifType, enabled: false },
          select: { userId: true },
        }),
      ])
      const optedOutIds = new Set(optedOut.map((p) => p.userId))
      userIds = follows.map((f) => f.userId).filter((id) => !optedOutIds.has(id))
    }

    if (type === 'event_rsvp_update' && job.data.userIds?.length) {
      userIds = job.data.userIds
    }

    if (!userIds.length) return

    // Save in-app notifications
    await prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        mosqueId,
        type: notifType,
        title,
        body,
        data,
      })),
      skipDuplicates: true,
    })

    // Get push tokens
    const tokens = await prisma.pushToken.findMany({
      where: { userId: { in: userIds } },
      select: { token: true },
    })

    const messages: ExpoPushMessage[] = tokens
      .filter((t) => Expo.isExpoPushToken(t.token))
      .map((t) => ({
        to: t.token,
        sound: 'default',
        title,
        body,
        data: data ?? {},
      }))

    const chunks = expo.chunkPushNotifications(messages)
    for (const chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk)
      } catch (err) {
        console.error('Push notification delivery error:', err)
      }
    }
  },
  { connection: redis as any, concurrency: 5 }
)
