/**
 * Cron worker — runs scheduled jobs:
 *   - Daily 7 AM UTC: Ayah of the Day push
 *   - Every Friday 11 AM UTC: Jumu'ah reminders (30 min before schedule)
 *   - Every 5 min: schedule RSVP reminders for upcoming events
 */

import { prisma } from '@masjid/database'
import { Expo, ExpoPushMessage } from 'expo-server-sdk'

const expo = new Expo()

// ── Ayah of the Day ─────────────────────────────────────────────────────────
// 6236 total ayahs in Quran — pick one per day of year deterministically
const TOTAL_AYAHS = 6236
// Surah lengths for index→(surah,ayah) mapping
const SURAH_LENGTHS = [
  7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,
  112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,
  59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,
  52,52,44,28,28,20,56,40,31,50,22,33,30,26,28,12,32,20,27,44,49,31,13,21,
  58,16,21,16,18,12,5,12,19,21,22,14,11,12,12,9,3,5,4,5,4,5,3,4,6,2,2,11,
  24,11,11,7,10,10,6,13,5,5,8,6,8,8,7,6,7,10,10,3,10,6,6,6,6,9,
]

function getAyahOfDay(date: Date): { surah: number; ayah: number; surahName: string } {
  const start = new Date(date.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86400000)
  const ayahIndex = dayOfYear % TOTAL_AYAHS

  let cumulative = 0
  for (let s = 0; s < SURAH_LENGTHS.length; s++) {
    if (ayahIndex < cumulative + SURAH_LENGTHS[s]) {
      return { surah: s + 1, ayah: ayahIndex - cumulative + 1, surahName: `Surah ${s + 1}` }
    }
    cumulative += SURAH_LENGTHS[s]
  }
  return { surah: 1, ayah: 1, surahName: 'Al-Fatiha' }
}

async function sendAyahOfDay() {
  const today = new Date()
  const { surah, ayah, surahName } = getAyahOfDay(today)

  // Get all users with push tokens
  const tokens = await prisma.pushToken.findMany({
    select: { token: true, userId: true },
  })

  if (!tokens.length) return

  // Save in-app notifications in bulk
  const userIds = [...new Set(tokens.map((t) => t.userId))]
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: 'AYAH_OF_DAY' as const,
      title: '📖 Ayah of the Day',
      body: `${surahName} ${surah}:${ayah} — Tap to read`,
      data: { surah: String(surah), ayah: String(ayah), type: 'ayah_of_day' },
    })),
    skipDuplicates: true,
  })

  const messages: ExpoPushMessage[] = tokens
    .filter((t) => Expo.isExpoPushToken(t.token))
    .map((t) => ({
      to: t.token,
      sound: 'default',
      title: '📖 Ayah of the Day',
      body: `${surahName} ${surah}:${ayah} — Tap to read`,
      data: { surah: String(surah), ayah: String(ayah), type: 'ayah_of_day' },
    }))

  const chunks = expo.chunkPushNotifications(messages)
  for (const chunk of chunks) {
    await expo.sendPushNotificationsAsync(chunk).catch(console.error)
  }

  console.log(`[cron] Ayah of the Day sent: ${surahName} ${surah}:${ayah} to ${tokens.length} devices`)
}

// ── Jumu'ah Reminders ────────────────────────────────────────────────────────
async function sendJumuahReminders() {
  const now = new Date()
  if (now.getUTCDay() !== 5) return // Only Friday UTC

  // Find all active Jumu'ah schedules
  const schedules = await prisma.jumuahSchedule.findMany({
    where: { isActive: true },
    include: {
      mosque: {
        select: {
          id: true,
          name: true,
          follows: {
            select: { userId: true },
            where: { isFavorite: false }, // all followers
          },
        },
      },
    },
  })

  for (const schedule of schedules) {
    // Parse khutbah time (HH:MM)
    const [h, m] = schedule.khutbahTime.split(':').map(Number)
    if (isNaN(h) || isNaN(m)) continue

    // Build a datetime for today's Jumu'ah
    const jumuahTime = new Date(now)
    jumuahTime.setUTCHours(h, m, 0, 0)

    const msUntil = jumuahTime.getTime() - now.getTime()
    const minutesUntil = msUntil / 60000

    // Send if 25-35 minutes away (cron runs every 10 min so 5 min window)
    if (minutesUntil < 25 || minutesUntil > 35) continue

    const userIds = schedule.mosque.follows.map((f) => f.userId)
    if (!userIds.length) continue

    const tokens = await prisma.pushToken.findMany({
      where: { userId: { in: userIds } },
      select: { token: true, userId: true },
    })

    await prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        mosqueId: schedule.mosque.id,
        type: 'JUMUAH_REMINDER' as const,
        title: `🕌 Jumu'ah in 30 min`,
        body: `${schedule.mosque.name} — Khutbah at ${schedule.khutbahTime}`,
        data: { mosqueId: schedule.mosque.id, type: 'jumuah_reminder' },
      })),
      skipDuplicates: true,
    })

    const messages: ExpoPushMessage[] = tokens
      .filter((t) => Expo.isExpoPushToken(t.token))
      .map((t) => ({
        to: t.token,
        sound: 'default',
        title: `🕌 Jumu'ah in 30 min`,
        body: `${schedule.mosque.name} — Khutbah at ${schedule.khutbahTime}`,
        data: { mosqueId: schedule.mosque.id, type: 'jumuah_reminder' },
      }))

    const chunks = expo.chunkPushNotifications(messages)
    for (const chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk).catch(console.error)
    }

    console.log(`[cron] Jumu'ah reminder sent for ${schedule.mosque.name} to ${tokens.length} devices`)
  }
}

// ── RSVP Reminders ───────────────────────────────────────────────────────────
// Check for events starting in 55-65 minutes and notify RSVP'd users
async function sendRsvpReminders() {
  const now = new Date()
  const soon = new Date(now.getTime() + 65 * 60 * 1000)
  const justOver = new Date(now.getTime() + 55 * 60 * 1000)

  const events = await prisma.event.findMany({
    where: {
      startTime: { gte: justOver, lte: soon },
      isPublished: true,
      isCancelled: false,
    },
    include: {
      mosque: { select: { id: true, name: true } },
      rsvps: {
        where: { status: { in: ['GOING', 'MAYBE'] } },
        select: { userId: true },
      },
    },
  })

  for (const event of events) {
    const userIds = event.rsvps.map((r) => r.userId)
    if (!userIds.length) continue

    const tokens = await prisma.pushToken.findMany({
      where: { userId: { in: userIds } },
      select: { token: true, userId: true },
    })

    await prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        mosqueId: event.mosque.id,
        type: 'RSVP_REMINDER' as const,
        title: `⏰ Starting in 1 hour`,
        body: `${event.title} at ${event.mosque.name}`,
        data: { eventId: event.id, type: 'rsvp_reminder' },
      })),
      skipDuplicates: true,
    })

    const messages: ExpoPushMessage[] = tokens
      .filter((t) => Expo.isExpoPushToken(t.token))
      .map((t) => ({
        to: t.token,
        sound: 'default',
        title: `⏰ Starting in 1 hour`,
        body: `${event.title} at ${event.mosque.name}`,
        data: { eventId: event.id, type: 'rsvp_reminder' },
      }))

    const chunks = expo.chunkPushNotifications(messages)
    for (const chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk).catch(console.error)
    }
  }
}

// ── Schedule ──────────────────────────────────────────────────────────────────
function scheduleDailyAt(hour: number, minute: number, fn: () => Promise<void>) {
  function getNextMs() {
    const now = new Date()
    const next = new Date(now)
    next.setUTCHours(hour, minute, 0, 0)
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1)
    return next.getTime() - now.getTime()
  }
  function schedule() {
    setTimeout(async () => {
      await fn().catch(console.error)
      schedule()
    }, getNextMs())
  }
  schedule()
}

// Ayah of the Day at 7:00 AM UTC
scheduleDailyAt(7, 0, sendAyahOfDay)

// Jumu'ah check every 10 minutes (only acts on Fridays near prayer time)
setInterval(() => sendJumuahReminders().catch(console.error), 10 * 60 * 1000)

// RSVP reminders every 10 minutes
setInterval(() => sendRsvpReminders().catch(console.error), 10 * 60 * 1000)

console.log('[cron] worker started')
