import { Worker, Queue } from 'bullmq'
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk'
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

    // prayer_reminder is handled on-device by useAdhanScheduler — skip silently
    if (type === 'prayer_reminder') {
      console.log('[Push] prayer_reminder skipped — scheduled on-device via useAdhanScheduler')
      return
    }

    let userIds: string[] = []

    // DB notification type mapping
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

    // FIX: event_reminder was missing — it now uses job.data.userIds just like event_rsvp_update
    if ((type === 'event_reminder' || type === 'event_rsvp_update') && job.data.userIds?.length) {
      userIds = job.data.userIds
    }

    if (!userIds.length) {
      console.log(`[Push] ${type} job has no recipients — skipping`)
      return
    }

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
    const tokenRows = await prisma.pushToken.findMany({
      where: { userId: { in: userIds } },
      select: { token: true },
    })

    const messages: ExpoPushMessage[] = tokenRows
      .filter((t) => Expo.isExpoPushToken(t.token))
      .map((t) => ({
        to: t.token,
        sound: 'default',
        title,
        body,
        data: data ?? {},
        // Route to the 'default' channel on Android so notifications use correct
        // importance/vibration settings defined in useNotifications.ts
        channelId: 'default',
      }))

    if (!messages.length) return

    const chunks = expo.chunkPushNotifications(messages)
    const allTickets: ExpoPushTicket[] = []

    // Build an ordered list of tokens matching messages so we can correlate tickets
    const orderedTokens = messages.map((m) => m.to as string)

    let offset = 0
    for (const chunk of chunks) {
      try {
        const tickets = await expo.sendPushNotificationsAsync(chunk)
        allTickets.push(...tickets)
      } catch (err) {
        console.error(`[Push] Chunk send error (offset ${offset}):`, err)
      }
      offset += chunk.length
    }

    // Remove stale tokens reported as DeviceNotRegistered
    const staleTokens: string[] = []
    allTickets.forEach((ticket, i) => {
      if (ticket.status === 'error') {
        const detail = (ticket as any).details?.error
        console.warn(`[Push] Ticket error for token ${i}: ${(ticket as any).message} (${detail})`)
        if (detail === 'DeviceNotRegistered' && orderedTokens[i]) {
          staleTokens.push(orderedTokens[i])
        }
      }
    })

    if (staleTokens.length > 0) {
      await prisma.pushToken.deleteMany({ where: { token: { in: staleTokens } } })
      console.log(`[Push] Removed ${staleTokens.length} stale token(s): ${staleTokens.join(', ')}`)
    }

    console.log(
      `[Push] ${type} delivered to ${allTickets.filter(t => t.status === 'ok').length}/${messages.length} devices` +
      (staleTokens.length ? ` (${staleTokens.length} stale removed)` : '')
    )
  },
  { connection: redis as any, concurrency: 5 }
)
