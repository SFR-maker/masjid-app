import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@masjid/database'
import { requireAuth } from '../plugins/auth'

export async function readingPlanRoutes(app: FastifyInstance) {
  // GET /reading-plan — get current user's plan
  app.get('/', { preHandler: [requireAuth] }, async (req, reply) => {
    const userId = req.userId!
    const plan = await prisma.quranReadingPlan.findUnique({ where: { userId } })
    return reply.send({ success: true, data: plan })
  })

  // POST /reading-plan — create or replace plan
  app.post('/', { preHandler: [requireAuth] }, async (req, reply) => {
    const userId = req.userId!
    const { type } = z
      .object({ type: z.enum(['MONTHLY', 'YEARLY']) })
      .parse(req.body)

    const today = new Date()
    const startDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))

    // Delete existing plan if any, then create new one atomically
    const [, plan] = await prisma.$transaction([
      prisma.quranReadingPlan.deleteMany({ where: { userId } }),
      prisma.quranReadingPlan.create({
        data: {
          userId,
          type,
          startDate,
          currentJuz: 1,
          completedJuzs: [],
          isCompleted: false,
        },
      }),
    ])

    return reply.status(201).send({ success: true, data: plan })
  })

  // PATCH /reading-plan/progress — mark juz as completed
  app.patch('/progress', { preHandler: [requireAuth] }, async (req, reply) => {
    const userId = req.userId!
    const { juz } = z
      .object({ juz: z.number().int().min(1).max(30) })
      .parse(req.body)

    const plan = await prisma.quranReadingPlan.findUnique({ where: { userId } })
    if (!plan) return reply.status(404).send({ success: false, error: 'No active reading plan' })

    const completedJuzs = plan.completedJuzs.includes(juz)
      ? plan.completedJuzs
      : [...plan.completedJuzs, juz].sort((a, b) => a - b)

    const nextJuz = Math.min(juz + 1, 30)
    const isCompleted = completedJuzs.length >= 30

    const updated = await prisma.quranReadingPlan.update({
      where: { userId },
      data: {
        completedJuzs,
        currentJuz: nextJuz,
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
      },
    })

    return reply.send({ success: true, data: updated })
  })

  // PATCH /reading-plan/reset — reset progress, keep plan type
  app.patch('/reset', { preHandler: [requireAuth] }, async (req, reply) => {
    const userId = req.userId!
    const plan = await prisma.quranReadingPlan.findUnique({ where: { userId } })
    if (!plan) return reply.status(404).send({ success: false, error: 'No active reading plan' })

    const today = new Date()
    const startDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))

    const updated = await prisma.quranReadingPlan.update({
      where: { userId },
      data: { completedJuzs: [], currentJuz: 1, isCompleted: false, completedAt: null, startDate },
    })

    return reply.send({ success: true, data: updated })
  })

  // DELETE /reading-plan — abandon plan
  app.delete('/', { preHandler: [requireAuth] }, async (req, reply) => {
    await prisma.quranReadingPlan.deleteMany({ where: { userId: req.userId! } })
    return reply.send({ success: true })
  })
}
