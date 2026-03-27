import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@masjid/database'
import { requireMosqueAdmin } from '../plugins/auth'

const timeRegex = /^\d{2}:\d{2}$/

const prayerScheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fajrAdhan:     z.string().regex(timeRegex).nullish(),
  fajrIqamah:    z.string().regex(timeRegex).nullish(),
  sunriseTime:   z.string().regex(timeRegex).nullish(),
  dhuhrAdhan:    z.string().regex(timeRegex).nullish(),
  dhuhrIqamah:   z.string().regex(timeRegex).nullish(),
  asrAdhan:      z.string().regex(timeRegex).nullish(),
  asrIqamah:     z.string().regex(timeRegex).nullish(),
  maghribAdhan:  z.string().regex(timeRegex).nullish(),
  maghribIqamah: z.string().regex(timeRegex).nullish(),
  ishaAdhan:     z.string().regex(timeRegex).nullish(),
  ishaIqamah:    z.string().regex(timeRegex).nullish(),
})

export async function prayerRoutes(app: FastifyInstance) {
  // GET /mosques/:id/prayer-times
  app.get('/:id/prayer-times', async (req, reply) => {
    const { id: mosqueId } = req.params as { id: string }
    const { date, days = '7' } = req.query as { date?: string; days?: string }

    if (date) {
      // Validate date format before passing to Prisma to avoid 'Invalid Date' crash
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return reply.status(400).send({ success: false, error: 'Invalid date format. Use YYYY-MM-DD.' })
      }
      const [schedule, mosque] = await Promise.all([
        prisma.prayerSchedule.findUnique({
          where: { mosqueId_date: { mosqueId, date: new Date(date) } },
        }),
        prisma.mosqueProfile.findUnique({
          where: { id: mosqueId },
          select: { latitude: true, longitude: true },
        }),
      ])
      return reply.send({
        success: true,
        data: schedule ?? null,
        mosqueLocation: mosque?.latitude && mosque?.longitude
          ? { latitude: mosque.latitude, longitude: mosque.longitude }
          : null,
      })
    }

    // Return next N days
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const schedules = await prisma.prayerSchedule.findMany({
      where: {
        mosqueId,
        date: { gte: today },
      },
      take: Number(days),
      orderBy: { date: 'asc' },
    })
    return reply.send({ success: true, data: { items: schedules } })
  })

  // POST /mosques/:id/prayer-times — upsert single day
  app.post(
    '/:id/prayer-times',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { id: mosqueId } = req.params as { id: string }
      const body = prayerScheduleSchema.parse(req.body)
      const date = new Date(body.date)

      const schedule = await prisma.prayerSchedule.upsert({
        where: { mosqueId_date: { mosqueId, date } },
        create: { mosqueId, ...body, date },
        update: { ...body, date },
      })

      return reply.send({ success: true, data: schedule })
    }
  )

  // POST /mosques/:id/prayer-times/bulk — set multiple days at once
  app.post(
    '/:id/prayer-times/bulk',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { id: mosqueId } = req.params as { id: string }
      const schedules = z.array(prayerScheduleSchema).parse(req.body)

      const upserts = schedules.map((s) => {
        const date = new Date(s.date)
        return prisma.prayerSchedule.upsert({
          where: { mosqueId_date: { mosqueId, date } },
          create: { mosqueId, ...s, date },
          update: { ...s, date },
        })
      })

      await prisma.$transaction(upserts)
      return reply.send({ success: true, data: { count: schedules.length } })
    }
  )

  // DELETE /mosques/:id/prayer-times/bulk-delete — delete specific dates (clearing saved rows)
  app.delete(
    '/:id/prayer-times/bulk-delete',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { id: mosqueId } = req.params as { id: string }
      const { dates } = z.object({ dates: z.array(z.string()) }).parse(req.body)
      await prisma.prayerSchedule.deleteMany({
        where: { mosqueId, date: { in: dates.map((d) => new Date(d)) } },
      })
      return reply.send({ success: true, data: { deleted: dates.length } })
    }
  )

  // GET /mosques/:id/jumuah
  app.get('/:id/jumuah', async (req, reply) => {
    const { id } = req.params as { id: string }
    const items = await prisma.jumuahSchedule.findMany({
      where: { mosqueId: id, isActive: true },
      orderBy: { createdAt: 'asc' },
    })
    return reply.send({ success: true, data: { items } })
  })

  // PUT /mosques/:id/jumuah — replace all active schedules
  app.put(
    '/:id/jumuah',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { id: mosqueId } = req.params as { id: string }
      const { schedules } = z.object({
        schedules: z.array(z.object({
          khutbahTime: z.string(),
          iqamahTime: z.string(),
          language: z.string().default('English'),
          imam: z.string().optional(),
          notes: z.string().optional(),
        })),
      }).parse(req.body)

      await prisma.jumuahSchedule.deleteMany({ where: { mosqueId } })
      const created = await prisma.jumuahSchedule.createMany({
        data: schedules.map(s => ({ ...s, mosqueId })),
      })
      return reply.send({ success: true, data: { count: created.count } })
    }
  )

  // GET /mosques/:id/taraweeh
  app.get('/:id/taraweeh', async (req, reply) => {
    const { id } = req.params as { id: string }
    const items = await prisma.taraweehSchedule.findMany({
      where: { mosqueId: id, isActive: true },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    })
    return reply.send({ success: true, data: { items } })
  })

  // PUT /mosques/:id/taraweeh — replace all active schedules
  app.put(
    '/:id/taraweeh',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { id: mosqueId } = req.params as { id: string }
      const { schedules } = z.object({
        schedules: z.array(z.object({
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          startTime: z.string(),
          endTime: z.string().optional(),
          rakaat: z.number().int().optional(),
          imam: z.string().optional(),
          notes: z.string().optional(),
        })),
      }).parse(req.body)

      await prisma.taraweehSchedule.deleteMany({ where: { mosqueId } })
      const created = await prisma.taraweehSchedule.createMany({
        data: schedules.map(s => ({ ...s, mosqueId })),
      })
      return reply.send({ success: true, data: { count: created.count } })
    }
  )

  // GET /mosques/:id/prayer-times/widget — compact format for widget/lockscreen
  app.get('/:id/prayer-times/widget', async (req, reply) => {
    const { id: mosqueId } = req.params as { id: string }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)

    const [todaySchedule, tomorrowSchedule, mosque] = await Promise.all([
      prisma.prayerSchedule.findUnique({
        where: { mosqueId_date: { mosqueId, date: today } },
      }),
      prisma.prayerSchedule.findUnique({
        where: { mosqueId_date: { mosqueId, date: tomorrow } },
      }),
      prisma.mosqueProfile.findUnique({
        where: { id: mosqueId },
        select: { name: true, latitude: true, longitude: true },
      }),
    ])

    if (!mosque) return reply.status(404).send({ success: false, error: 'Mosque not found' })

    function compact(s: typeof todaySchedule) {
      if (!s) return null
      return {
        date: s.date,
        fajr: s.fajrAdhan,
        sunrise: s.sunriseTime,
        dhuhr: s.dhuhrAdhan,
        asr: s.asrAdhan,
        maghrib: s.maghribAdhan,
        isha: s.ishaAdhan,
      }
    }

    return reply.send({
      success: true,
      data: {
        mosqueName: mosque.name,
        location: mosque.latitude && mosque.longitude
          ? { lat: mosque.latitude, lng: mosque.longitude }
          : null,
        today: compact(todaySchedule),
        tomorrow: compact(tomorrowSchedule),
        fetchedAt: new Date().toISOString(),
      },
    })
  })
}
