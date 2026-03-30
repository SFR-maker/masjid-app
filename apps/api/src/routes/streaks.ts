import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@masjid/database'
import { requireAuth } from '../plugins/auth'

const PRAYER_NAMES = ['FAJR', 'DHUHR', 'ASR', 'MAGHRIB', 'ISHA'] as const

function toDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

// Parse a YYYY-MM-DD string (local date sent by the client) as UTC midnight
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86400000
  return Math.round(Math.abs(a.getTime() - b.getTime()) / msPerDay)
}

async function updateStreak(userId: string, type: 'PRAYER' | 'LOGIN', today: Date): Promise<number> {

  // Use upsert to avoid TOCTOU race when the same user has concurrent requests
  const existing = await prisma.userStreak.findUnique({
    where: { userId_type: { userId, type } },
  })

  if (!existing) {
    await prisma.userStreak.upsert({
      where: { userId_type: { userId, type } },
      create: { userId, type, currentStreak: 1, longestStreak: 1, lastLoggedDate: today },
      update: {},
    })
    return 1
  }

  // Already logged today — no change
  const lastRaw = existing.lastLoggedDate
  const last = lastRaw ? toDateOnly(new Date(lastRaw)) : null
  const gap = last ? daysBetween(today, last) : 999

  console.log('[streak] updateStreak', {
    type,
    today: today.toISOString(),
    lastRaw: lastRaw ? (lastRaw instanceof Date ? lastRaw.toISOString() : lastRaw) : null,
    lastNormalized: last ? last.toISOString() : null,
    gap,
    existingCurrent: existing.currentStreak,
  })

  if (gap === 0) return existing.currentStreak

  // Consecutive day: extend streak. Gap > 1: reset to 1.
  const newCurrent = gap === 1 ? existing.currentStreak + 1 : 1
  const newLongest = Math.max(existing.longestStreak, newCurrent)

  await prisma.userStreak.update({
    where: { userId_type: { userId, type } },
    data: { currentStreak: newCurrent, longestStreak: newLongest, lastLoggedDate: today },
  })

  return newCurrent
}

export async function streakRoutes(app: FastifyInstance) {
  // POST /streaks/prayer — mark a prayer as prayed today
  app.post('/prayer', { preHandler: [requireAuth] }, async (req, reply) => {
    const userId = req.userId!
    const { prayer, localDate } = z
      .object({ prayer: z.enum(PRAYER_NAMES), localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() })
      .parse(req.body)

    const today = localDate ? parseLocalDate(localDate) : toDateOnly(new Date())

    // Idempotent: upsert the prayer log for today
    await prisma.prayerLog.upsert({
      where: { userId_prayer_date: { userId, prayer, date: today } },
      create: { userId, prayer, date: today },
      update: {},
    })

    // Count how many prayers logged today
    const todayCount = await prisma.prayerLog.count({
      where: { userId, date: today },
    })

    console.log('[streak] prayer marked', { userId, prayer, localDate, today: today.toISOString(), todayCount })

    // Prayer streak advances when all 5 are completed today
    let prayerStreak: number | undefined
    if (todayCount >= 5) {
      prayerStreak = await updateStreak(userId, 'PRAYER', today)
      console.log('[streak] prayer streak updated', { userId, prayerStreak })
    }

    return reply.send({ success: true, todayCount, prayerStreak })
  })

  // DELETE /streaks/prayer?prayer=FAJR — unmark a prayer for today
  app.delete('/prayer', { preHandler: [requireAuth] }, async (req, reply) => {
    const userId = req.userId!
    const { prayer, localDate } = z
      .object({ prayer: z.enum(PRAYER_NAMES), localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() })
      .parse(req.query)

    const today = localDate ? parseLocalDate(localDate) : toDateOnly(new Date())

    await prisma.prayerLog.deleteMany({
      where: { userId, prayer, date: today },
    })

    // If today now has fewer than 5 prayers and the streak was earned today, revert it
    const todayCount = await prisma.prayerLog.count({ where: { userId, date: today } })
    if (todayCount < 5) {
      const streak = await prisma.userStreak.findUnique({
        where: { userId_type: { userId, type: 'PRAYER' } },
      })
      if (streak?.lastLoggedDate) {
        const lastLogged = toDateOnly(new Date(streak.lastLoggedDate))
        if (daysBetween(today, lastLogged) === 0) {
          // Recalculate streak from actual prayer log history (don't blindly subtract 1)
          const prevDates = await prisma.prayerLog.findMany({
            where: { userId, date: { lt: today } },
            distinct: ['date'],
            select: { date: true },
            orderBy: { date: 'desc' },
            take: 100,
          })

          let newStreak = 0
          let newLastLoggedDate: Date | null = null
          let chainDate: Date | null = null

          for (const { date } of prevDates) {
            const count = await prisma.prayerLog.count({ where: { userId, date } })
            if (count < 5) continue // partial day — skip but don't break chain yet

            const d = toDateOnly(new Date(date))
            if (!newLastLoggedDate) {
              newLastLoggedDate = d
              chainDate = d
              newStreak = 1
            } else if (chainDate && daysBetween(chainDate, d) === 1) {
              newStreak++
              chainDate = d
            } else {
              break // gap in the chain
            }
          }

          console.log('[streak] prayer unmark revert', { userId, newStreak, newLastLoggedDate })
          await prisma.userStreak.update({
            where: { userId_type: { userId, type: 'PRAYER' } },
            data: { currentStreak: newStreak, lastLoggedDate: newLastLoggedDate },
          })
        }
      }
    }

    return reply.send({ success: true, todayCount })
  })

  // POST /streaks/login — record a daily login (call on app open)
  app.post('/login', { preHandler: [requireAuth] }, async (req, reply) => {
    const userId = req.userId!
    const { localDate } = z
      .object({ localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() })
      .parse(req.body)
    const today = localDate ? parseLocalDate(localDate) : toDateOnly(new Date())
    await updateStreak(userId, 'LOGIN', today)
    return reply.send({ success: true })
  })

  // GET /streaks/me — return streak data + today's prayed prayers
  app.get('/me', { preHandler: [requireAuth] }, async (req, reply) => {
    const userId = req.userId!
    const { localDate } = z
      .object({ localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() })
      .parse(req.query)
    const today = localDate ? parseLocalDate(localDate) : toDateOnly(new Date())

    const [streaks, todayLogs] = await Promise.all([
      prisma.userStreak.findMany({ where: { userId } }),
      prisma.prayerLog.findMany({
        where: { userId, date: today },
        select: { prayer: true },
      }),
    ])

    const prayer = streaks.find((s) => s.type === 'PRAYER')
    const login = streaks.find((s) => s.type === 'LOGIN')

    const todayPrayed = todayLogs.map((l) => l.prayer)
    console.log('[streak] GET /me', { userId, todayPrayed, prayerStreak: prayer?.currentStreak ?? 0, loginStreak: login?.currentStreak ?? 0 })

    return reply.send({
      success: true,
      data: {
        prayer: {
          current: prayer?.currentStreak ?? 0,
          longest: prayer?.longestStreak ?? 0,
        },
        login: {
          current: login?.currentStreak ?? 0,
          longest: login?.longestStreak ?? 0,
        },
        todayPrayed,
      },
    })
  })
}
