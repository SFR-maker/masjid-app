import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@masjid/database'
import { requireAuth } from '../plugins/auth'

const PRAYER_NAMES = ['FAJR', 'DHUHR', 'ASR', 'MAGHRIB', 'ISHA'] as const

function toDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86400000
  return Math.round(Math.abs(a.getTime() - b.getTime()) / msPerDay)
}

async function updateStreak(userId: string, type: 'PRAYER' | 'LOGIN'): Promise<void> {
  const today = toDateOnly(new Date())

  const existing = await prisma.userStreak.findUnique({
    where: { userId_type: { userId, type } },
  })

  if (!existing) {
    await prisma.userStreak.create({
      data: { userId, type, currentStreak: 1, longestStreak: 1, lastLoggedDate: today },
    })
    return
  }

  // Already logged today — no change
  if (existing.lastLoggedDate) {
    const last = toDateOnly(new Date(existing.lastLoggedDate))
    if (daysBetween(today, last) === 0) return
  }

  const gap = existing.lastLoggedDate
    ? daysBetween(today, toDateOnly(new Date(existing.lastLoggedDate)))
    : 999

  // Consecutive day: extend streak. Gap > 1: reset to 1.
  const newCurrent = gap === 1 ? existing.currentStreak + 1 : 1
  const newLongest = Math.max(existing.longestStreak, newCurrent)

  await prisma.userStreak.update({
    where: { userId_type: { userId, type } },
    data: { currentStreak: newCurrent, longestStreak: newLongest, lastLoggedDate: today },
  })
}

export async function streakRoutes(app: FastifyInstance) {
  // POST /streaks/prayer — mark a prayer as prayed today
  app.post('/prayer', { preHandler: [requireAuth] }, async (req, reply) => {
    const userId = req.userId!
    const { prayer } = z
      .object({ prayer: z.enum(PRAYER_NAMES) })
      .parse(req.body)

    const today = toDateOnly(new Date())

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

    // Prayer streak advances when all 5 are completed today
    if (todayCount >= 5) {
      await updateStreak(userId, 'PRAYER')
    }

    return reply.send({ success: true, todayCount })
  })

  // POST /streaks/login — record a daily login (call on app open)
  app.post('/login', { preHandler: [requireAuth] }, async (req, reply) => {
    const userId = req.userId!
    await updateStreak(userId, 'LOGIN')
    return reply.send({ success: true })
  })

  // GET /streaks/me — return streak data + today's prayed prayers
  app.get('/me', { preHandler: [requireAuth] }, async (req, reply) => {
    const userId = req.userId!
    const today = toDateOnly(new Date())

    const [streaks, todayLogs] = await Promise.all([
      prisma.userStreak.findMany({ where: { userId } }),
      prisma.prayerLog.findMany({
        where: { userId, date: today },
        select: { prayer: true },
      }),
    ])

    const prayer = streaks.find((s) => s.type === 'PRAYER')
    const login = streaks.find((s) => s.type === 'LOGIN')

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
        todayPrayed: todayLogs.map((l) => l.prayer),
      },
    })
  })
}
