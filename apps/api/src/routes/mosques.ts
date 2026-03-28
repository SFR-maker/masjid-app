import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma, Prisma } from '@masjid/database'
import { requireAuth, requireMosqueAdmin } from '../plugins/auth'
import { generateSignedUploadParams, generateSignedVideoUploadParams, generateSignedDownloadUrl, deleteCloudinaryResource } from '../lib/cloudinary'
import { notificationQueue } from '../workers/notification.worker'

const createMosqueSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z.string().optional(),
  description: z.string().optional(),
  address: z.string().optional(),
  city: z.string().min(2),
  state: z.string().min(2),
  zipCode: z.string().optional(),
  country: z.string().default('US'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
  imamName: z.string().optional(),
  hasWomensPrayer: z.boolean().default(false),
  hasYouthPrograms: z.boolean().default(false),
  hasParking: z.boolean().default(false),
  isAccessible: z.boolean().default(false),
  languages: z.array(z.string()).default([]),
  khutbahLanguages: z.array(z.string()).default([]),
  capacityMen: z.number().int().positive().optional(),
  capacityWomen: z.number().int().positive().optional(),
  parkingInfo: z.string().optional(),
  directions: z.string().optional(),
  amenities: z.array(z.string()).default([]).optional(),
  mainImageUrl: z.string().optional(),
  logoUrl: z.string().optional(),
  bannerUrl: z.string().optional(),
  facebookUrl: z.string().url().optional().or(z.literal('')),
  twitterUrl: z.string().url().optional().or(z.literal('')),
  instagramUrl: z.string().url().optional().or(z.literal('')),
  youtubeUrl: z.string().url().optional().or(z.literal('')),
})

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 80)
}

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function mosqueRoutes(app: FastifyInstance) {
  // GET /mosques — search and list
  app.get('/', async (req, reply) => {
    const { q, city, state, zip, lat, lng, radius = '25', limit = '20', cursor } =
      req.query as any
    const userId = req.userId

    const where: any = {}

    if (q) {
      const words = (q as string).trim().split(/\s+/).filter(Boolean)
      const searchFields = (term: string) => [
        { name: { contains: term, mode: 'insensitive' as const } },
        { city: { contains: term, mode: 'insensitive' as const } },
        { state: { contains: term, mode: 'insensitive' as const } },
        { zipCode: { contains: term, mode: 'insensitive' as const } },
        { address: { contains: term, mode: 'insensitive' as const } },
        { imamName: { contains: term, mode: 'insensitive' as const } },
      ]
      if (words.length > 1) {
        // All words must appear somewhere — enables "islamic irving" to match "Islamic Center of Irving"
        where.AND = words.map((word) => ({ OR: searchFields(word) }))
      } else {
        where.OR = searchFields(q as string)
      }
    }
    if (city) where.city = { contains: city, mode: 'insensitive' }
    if (state) where.state = { equals: state, mode: 'insensitive' }
    if (zip) where.zipCode = zip

    // For geo searches, fetch all mosques with coordinates (no alphabetical cutoff)
    const isGeoSearch = !!(lat && lng)
    if (isGeoSearch) {
      where.latitude = { not: null }
      where.longitude = { not: null }
    }

    const mosques = await prisma.mosqueProfile.findMany({
      where,
      ...(isGeoSearch ? {} : { take: Math.min(100, Number(limit) || 20) }),
      ...(cursor && !isGeoSearch ? { skip: 1, cursor: { id: cursor } } : {}),
      include: {
        _count: { select: { follows: true } },
        admins: { where: { role: 'OWNER' }, select: { id: true }, take: 1 },
        ...(userId ? { follows: { where: { userId }, select: { isFavorite: true } } } : {}),
      },
      orderBy: { name: 'asc' },
    })

    let results = mosques.map((m: any) => {
      const hasCoords = m.latitude != null && m.longitude != null
      const distanceKm =
        lat && lng && hasCoords
          ? Math.round(
              calculateDistanceKm(Number(lat), Number(lng), m.latitude!, m.longitude!) * 10
            ) / 10
          : undefined
      const userFollow = userId ? m.follows?.[0] ?? null : null
      return {
        id: m.id,
        name: m.name,
        slug: m.slug,
        city: m.city,
        state: m.state,
        latitude: m.latitude,
        longitude: m.longitude,
        logoUrl: m.logoUrl,
        isVerified: m.isVerified,
        hasWomensPrayer: m.hasWomensPrayer,
        hasYouthPrograms: m.hasYouthPrograms,
        followersCount: m._count.follows,
        distanceKm,
        hasOwner: m.admins.length > 0,
        isFollowing: userId ? userFollow !== null : undefined,
        isFavorite: userId ? (userFollow?.isFavorite ?? false) : undefined,
      }
    })

    if (lat && lng) {
      // Only include mosques with known coordinates within the radius, sorted by distance
      results = results
        .filter((m) => m.distanceKm !== undefined && m.distanceKm <= Number(radius))
        .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999))
    }

    return reply.send({
      success: true,
      data: {
        items: results,
        cursor: mosques[mosques.length - 1]?.id,
        hasMore: mosques.length === Number(limit),
      },
    })
  })

  // GET /mosques/:id — mosque detail
  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const userId = req.userId

    const mosque = await prisma.mosqueProfile.findFirst({
      where: { OR: [{ id }, { slug: id }], isActive: true },
      include: {
        _count: { select: { follows: true } },
        photos: { orderBy: { order: 'asc' } },
        jumuahSchedules: { where: { isActive: true } },
        services: { where: { isActive: true }, orderBy: { order: 'asc' } },
        admins: { where: { role: 'OWNER' }, select: { id: true }, take: 1 },
        ...(userId ? { follows: { where: { userId }, select: { id: true, isFavorite: true } } } : {}),
      },
    })

    if (!mosque) return reply.status(404).send({ success: false, error: 'Mosque not found' })

    const userFollow = userId ? (mosque as any).follows?.[0] : null
    const hasOwner = (mosque as any).admins?.length > 0

    return reply.send({
      success: true,
      data: {
        ...mosque,
        followersCount: mosque._count.follows,
        isFollowing: !!userFollow,
        isFavorite: userFollow?.isFavorite ?? false,
        hasOwner,
        follows: undefined,
        admins: undefined,
        _count: undefined,
      },
    })
  })

  // POST /mosques
  app.post('/', { preHandler: [requireAuth] }, async (req, reply) => {
    const body = createMosqueSchema.parse(req.body)

    const baseSlug = generateSlug(body.name)
    let slug = baseSlug
    let attempt = 0
    while (await prisma.mosqueProfile.findUnique({ where: { slug } })) {
      attempt++
      slug = `${baseSlug}-${attempt}`
    }

    const createData = {
      ...body,
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
      admins: { create: { userId: req.userId!, role: 'OWNER' as const } },
    }

    let mosque
    try {
      mosque = await prisma.mosqueProfile.create({ data: { ...createData, slug } })
    } catch (err: any) {
      // Concurrent request claimed the same slug — retry once with a random suffix
      if (err?.code === 'P2002') {
        slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`
        mosque = await prisma.mosqueProfile.create({ data: { ...createData, slug } })
      } else {
        throw err
      }
    }

    return reply.status(201).send({ success: true, data: mosque })
  })

  // PUT /mosques/:id
  app.put(
    '/:id',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const body = createMosqueSchema.partial().parse(req.body)
      const mosque = await prisma.mosqueProfile.update({ where: { id }, data: body })
      return reply.send({ success: true, data: mosque })
    }
  )

  // GET /mosques/:id/dashboard-stats — combined stats for admin dashboard
  app.get(
    '/:id/dashboard-stats',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { id: mosqueId } = req.params as { id: string }
      const now = new Date()

      const [
        followersCount, upcomingEventsCount, rsvpCount, videosCount,
        unreadCount, recentAnnouncements, upcomingEvents, topAnnouncements,
      ] = await Promise.all([
        prisma.userFollow.count({ where: { mosqueId } }),
        prisma.event.count({ where: { mosqueId, isPublished: true, isCancelled: false, startTime: { gte: now } } }),
        prisma.eventRsvp.count({ where: { event: { mosqueId, startTime: { gte: now } }, status: 'GOING' } }),
        prisma.video.count({ where: { mosqueId, isPublished: true } }),
        prisma.directMessage.count({ where: { mosqueId, isRead: false } }),
        prisma.announcement.findMany({
          where: { mosqueId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, title: true, priority: true, isPublished: true, createdAt: true, isPinned: true, _count: { select: { likes: true } } },
        }),
        prisma.event.findMany({
          where: { mosqueId, isPublished: true, isCancelled: false, startTime: { gte: now } },
          orderBy: { startTime: 'asc' },
          take: 5,
          select: { id: true, title: true, startTime: true, location: true, category: true, _count: { select: { rsvps: { where: { status: 'GOING' } } } } },
        }),
        prisma.announcement.findMany({
          where: { mosqueId, isPublished: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, title: true, createdAt: true, _count: { select: { likes: true, comments: true } } },
        }),
      ])

      return reply.send({
        success: true,
        data: {
          followersCount,
          upcomingEventsCount,
          rsvpCount,
          videosCount,
          unreadCount,
          recentAnnouncements: recentAnnouncements.map((a) => ({ ...a, likeCount: a._count.likes, _count: undefined })),
          upcomingEvents: upcomingEvents.map((e) => ({ ...e, rsvpCount: e._count.rsvps, _count: undefined })),
          topAnnouncements: topAnnouncements.map((a) => ({ ...a, likeCount: a._count.likes, commentCount: a._count.comments, _count: undefined })),
        },
      })
    }
  )

  // POST /mosques/:id/follow — allowed for both claimed and unclaimed mosques
  app.post('/:id/follow', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id: mosqueId } = req.params as { id: string }
    await prisma.userFollow.upsert({
      where: { userId_mosqueId: { userId: req.userId!, mosqueId } },
      create: { userId: req.userId!, mosqueId },
      update: {},
    })
    return reply.send({ success: true })
  })

  // DELETE /mosques/:id/follow
  app.delete('/:id/follow', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id: mosqueId } = req.params as { id: string }
    await prisma.userFollow.deleteMany({ where: { userId: req.userId!, mosqueId } })
    return reply.send({ success: true })
  })

  // POST /mosques/:id/favorite — set as favorite mosque
  app.post('/:id/favorite', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id: mosqueId } = req.params as { id: string }
    const userId = req.userId!
    const owner = await prisma.mosqueAdmin.findFirst({ where: { mosqueId, role: 'OWNER' }, select: { id: true } })
    if (!owner) {
      return reply.status(403).send({ success: false, error: 'This mosque has not been claimed by an owner yet.', code: 'MOSQUE_UNCLAIMED' })
    }
    // Ensure they follow the mosque
    await prisma.userFollow.upsert({
      where: { userId_mosqueId: { userId, mosqueId } },
      create: { userId, mosqueId, isFavorite: true },
      update: { isFavorite: true },
    })
    // Unset favorite on all other follows
    await prisma.userFollow.updateMany({
      where: { userId, NOT: { mosqueId } },
      data: { isFavorite: false },
    })
    return reply.send({ success: true })
  })

  // DELETE /mosques/:id/favorite — unset favorite
  app.delete('/:id/favorite', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id: mosqueId } = req.params as { id: string }
    await prisma.userFollow.updateMany({
      where: { userId: req.userId!, mosqueId },
      data: { isFavorite: false },
    })
    return reply.send({ success: true })
  })

  // GET /mosques/:id/services
  app.get('/:id/services', async (req, reply) => {
    const { id: mosqueId } = req.params as { id: string }
    const services = await prisma.mosqueService.findMany({
      where: { mosqueId, isActive: true },
      orderBy: { order: 'asc' },
    })
    return reply.send({ success: true, data: { items: services } })
  })

  // POST /mosques/:id/services
  app.post(
    '/:id/services',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { id: mosqueId } = req.params as { id: string }
      const body = z.object({
        type: z.enum(['QURAN_CLASSES','WOMENS_HALAQA','ISLAMIC_SCHOOL','SPECIAL_NEEDS','MARRIAGE_SERVICES','JANAZAH_SERVICES','FACILITY_RENTAL','YOUTH_PROGRAMS','OTHER']),
        name: z.string().min(2),
        description: z.string().optional(),
        schedule: z.string().optional(),
        contact: z.string().optional(),
        registration: z.string().optional(),
        notes: z.string().optional(),
        capacity: z.number().int().positive().optional(),
        pricing: z.string().optional(),
        order: z.number().int().default(0),
      }).parse(req.body)
      const service = await prisma.mosqueService.create({ data: { mosqueId, ...body } })
      return reply.status(201).send({ success: true, data: service })
    }
  )

  // PUT /mosques/:id/services/:serviceId
  app.put(
    '/:id/services/:serviceId',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { serviceId } = req.params as { id: string; serviceId: string }
      const body = z.object({
        name: z.string().min(2).optional(),
        description: z.string().optional(),
        schedule: z.string().optional(),
        contact: z.string().optional(),
        registration: z.string().optional(),
        notes: z.string().optional(),
        capacity: z.number().int().positive().optional(),
        pricing: z.string().optional(),
        isActive: z.boolean().optional(),
        order: z.number().int().optional(),
      }).parse(req.body)
      const service = await prisma.mosqueService.update({ where: { id: serviceId }, data: body })
      return reply.send({ success: true, data: service })
    }
  )

  // DELETE /mosques/:id/services/:serviceId
  app.delete(
    '/:id/services/:serviceId',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { serviceId } = req.params as { id: string; serviceId: string }
      await prisma.mosqueService.delete({ where: { id: serviceId } })
      return reply.send({ success: true })
    }
  )

  // POST /mosques/:id/services/:serviceId/requests — user submits a service request
  app.post('/:id/services/:serviceId/requests', async (req, reply) => {
    const { id: mosqueId, serviceId } = req.params as { id: string; serviceId: string }
    const body = z.object({
      name: z.string().min(2).max(100),
      phone: z.string().optional(),
      message: z.string().min(5).max(1000),
    }).parse(req.body)
    const request = await prisma.serviceRequest.create({
      data: { mosqueId, serviceId, userId: req.userId ?? null, ...body },
    })
    return reply.status(201).send({ success: true, data: request })
  })

  // GET /mosques/:id/service-requests — admin view
  app.get(
    '/:id/service-requests',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { id: mosqueId } = req.params as { id: string }
      const { status, cursor, limit = '20' } = req.query as any
      const requests = await prisma.serviceRequest.findMany({
        where: { mosqueId, ...(status ? { status } : {}) },
        take: Math.min(100, Number(limit) || 20),
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { createdAt: 'desc' },
        include: { service: { select: { name: true, type: true } } },
      })
      return reply.send({
        success: true,
        data: { items: requests, cursor: requests[requests.length - 1]?.id, hasMore: requests.length === Number(limit) },
      })
    }
  )

  // PUT /mosques/:id/service-requests/:requestId — admin updates status
  app.put(
    '/:id/service-requests/:requestId',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { requestId } = req.params as { id: string; requestId: string }
      const body = z.object({
        status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
        adminNote: z.string().optional(),
      }).parse(req.body)
      const updated = await prisma.serviceRequest.update({ where: { id: requestId }, data: body })
      return reply.send({ success: true, data: updated })
    }
  )

  // DELETE /mosques/:id/service-requests/:requestId — admin deletes request
  app.delete(
    '/:id/service-requests/:requestId',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { requestId } = req.params as { id: string; requestId: string }
      await prisma.serviceRequest.delete({ where: { id: requestId } })
      return reply.send({ success: true })
    }
  )

  // ── Followers list (admin) ─────────────────────────────────────────────────

  app.get(
    '/:id/followers',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      try {
      const { id: mosqueId } = req.params as { id: string }
      const q = req.query as Record<string, string | undefined>
      const { search, isFavorite, sortBy, page, limit, all, gender, isOpenToVolunteer, isOpenToMarriage, ageMin, ageMax } = q

      // Build user sub-filter incrementally to support multiple user-level conditions
      const userWhere: Record<string, any> = {}
      if (search) {
        userWhere.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ]
      }
      if (gender) userWhere.gender = gender
      if (isOpenToVolunteer === 'true') userWhere.isOpenToVolunteer = true
      if (isOpenToVolunteer === 'false') userWhere.isOpenToVolunteer = false
      if (isOpenToMarriage === 'true') userWhere.isOpenToMarriage = true
      if (isOpenToMarriage === 'false') userWhere.isOpenToMarriage = false
      if (ageMin) userWhere.birthdate = { ...userWhere.birthdate, lte: new Date(new Date().getFullYear() - parseInt(ageMin, 10), new Date().getMonth(), new Date().getDate()) }
      if (ageMax) userWhere.birthdate = { ...userWhere.birthdate, gte: new Date(new Date().getFullYear() - parseInt(ageMax, 10), new Date().getMonth(), new Date().getDate()) }

      const where: Record<string, any> = { mosqueId }
      if (isFavorite === 'true') where.isFavorite = true
      if (isFavorite === 'false') where.isFavorite = false
      if (Object.keys(userWhere).length > 0) where.user = userWhere

      let orderBy: any = { createdAt: 'desc' }
      if (sortBy === 'oldest') orderBy = { createdAt: 'asc' }
      else if (sortBy === 'name') orderBy = [{ user: { name: 'asc' } }]

      const pageNum = Math.max(1, parseInt(page ?? '1', 10))
      const pageSize = Math.min(100, parseInt(limit ?? '25', 10))
      const exportAll = all === 'true'

      const [followers, total] = await Promise.all([
        prisma.userFollow.findMany({
          where,
          include: {
            user: {
              select: {
                id: true, name: true, email: true, avatarUrl: true,
                gender: true, birthdate: true,
                isOpenToVolunteer: true, isOpenToMarriage: true,
              },
            },
          },
          orderBy,
          ...(exportAll ? {} : { skip: (pageNum - 1) * pageSize, take: pageSize }),
        }),
        prisma.userFollow.count({ where }),
      ])

      const now = new Date()
      const items = followers.map((f) => {
        const age = f.user.birthdate
          ? Math.floor((now.getTime() - new Date(f.user.birthdate).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
          : null
        return { id: f.id, isFavorite: f.isFavorite, followedAt: f.createdAt, user: { ...f.user, age } }
      })

      return reply.send({ success: true, data: { items, total, page: pageNum, pageSize } })
      } catch (err: any) {
        req.log.error({ err }, 'followers endpoint error')
        return reply.status(500).send({ success: false, error: 'Internal server error' })
      }
    }
  )

  // POST /:id/followers/notify — send push notification to filtered followers (admin)
  app.post(
    '/:id/followers/notify',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { id: mosqueId } = req.params as { id: string }
      const { title, body: message } = z.object({
        title: z.string().min(1).max(200),
        body: z.string().min(1).max(1000),
      }).parse(req.body)

      const mosque = await prisma.mosqueProfile.findUnique({ where: { id: mosqueId }, select: { name: true } })
      await notificationQueue.add('mosque_announcement', {
        type: 'mosque_announcement',
        mosqueId,
        title,
        body: message,
        data: { mosqueId },
      })

      return reply.send({ success: true, message: `Notification queued for followers of ${mosque?.name}` })
    }
  )

  // ── Documents ──────────────────────────────────────────────────────────────

  // GET /mosques/:id/documents — public list
  app.get('/:id/documents', async (req, reply) => {
    const { id: mosqueId } = req.params as { id: string }
    const docs = await prisma.mosqueDocument.findMany({
      where: { mosqueId },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send({ success: true, data: { items: docs } })
  })

  // GET /mosques/:id/documents/:docId/download — get signed download URL
  app.get('/:id/documents/:docId/download', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id: mosqueId, docId } = req.params as { id: string; docId: string }
    const doc = await prisma.mosqueDocument.findUnique({ where: { id: docId } })
    if (!doc || doc.mosqueId !== mosqueId) {
      return reply.status(404).send({ success: false, error: 'Document not found' })
    }
    // Extract public ID from Cloudinary URL
    // URL format: https://res.cloudinary.com/{cloud}/raw/upload/v{version}/{publicId}
    const urlMatch = doc.fileUrl.match(/\/(?:raw|image|video)\/upload\/(?:v\d+\/)?(.+)$/)
    const publicId = urlMatch ? urlMatch[1].replace(/\.[^/.]+$/, '') : null
    if (!publicId) return reply.send({ success: true, data: { url: doc.fileUrl } })
    const resourceType = doc.mimeType?.startsWith('image/') ? 'image' : 'raw'
    const signedUrl = generateSignedDownloadUrl(publicId, resourceType)
    return reply.send({ success: true, data: { url: signedUrl, name: doc.name, mimeType: doc.mimeType } })
  })

  // POST /mosques/:id/documents — admin upload
  app.post(
    '/:id/documents',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { id: mosqueId } = req.params as { id: string }
      const body = z.object({
        name: z.string().min(1).max(200),
        fileUrl: z.string().url(),
        fileSize: z.number().int().optional(),
        mimeType: z.string().optional(),
      }).parse(req.body)
      const doc = await prisma.mosqueDocument.create({ data: { mosqueId, ...body } })
      return reply.status(201).send({ success: true, data: doc })
    }
  )

  // PATCH /mosques/:id/documents/:docId — admin rename
  app.patch(
    '/:id/documents/:docId',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { docId } = req.params as { id: string; docId: string }
      const { name } = z.object({ name: z.string().min(1).max(200) }).parse(req.body)
      const doc = await prisma.mosqueDocument.update({ where: { id: docId }, data: { name } })
      return reply.send({ success: true, data: doc })
    }
  )

  // DELETE /mosques/:id/documents/:docId — admin delete
  app.delete(
    '/:id/documents/:docId',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { docId } = req.params as { id: string; docId: string }
      const doc = await prisma.mosqueDocument.findUnique({ where: { id: docId } })
      await prisma.mosqueDocument.delete({ where: { id: docId } })
      // Extract publicId from fileUrl and delete from Cloudinary
      const urlMatch = doc?.fileUrl.match(/\/(?:raw|image|video)\/upload\/(?:v\d+\/)?(.+)$/)
      const publicId = urlMatch ? urlMatch[1].replace(/\.[^/.]+$/, '') : null
      if (publicId) {
        const resourceType = doc?.mimeType?.startsWith('image/') ? 'image' : 'raw'
        deleteCloudinaryResource(publicId, resourceType).catch(() => {}) // best-effort
      }
      return reply.send({ success: true })
    }
  )

  // POST /mosques/:id/photos — add a photo
  app.post(
    '/:id/photos',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { id: mosqueId } = req.params as { id: string }
      const body = z.object({
        url: z.string().url(),
        caption: z.string().optional(),
        order: z.number().int().default(0),
      }).parse(req.body)
      const photo = await prisma.mosquePhoto.create({ data: { mosqueId, ...body } })
      return reply.status(201).send({ success: true, data: photo })
    }
  )

  // DELETE /mosques/:id/photos/:photoId
  app.delete(
    '/:id/photos/:photoId',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { photoId } = req.params as { id: string; photoId: string }
      await prisma.mosquePhoto.delete({ where: { id: photoId } })
      return reply.send({ success: true })
    }
  )

  // GET /mosques/:id/upload-params — signed Cloudinary image upload params
  app.get(
    '/:id/upload-params',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const params = await generateSignedUploadParams(`mosques/${id}`)
      return reply.send({ success: true, data: params })
    }
  )

  // GET /mosques/:id/upload-params/video — signed Cloudinary video upload params
  app.get(
    '/:id/upload-params/video',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const params = await generateSignedVideoUploadParams(`mosques/${id}/videos`)
      return reply.send({ success: true, data: params })
    }
  )

  // GET /mosques/:id/programs
  app.get('/:id/programs', async (req, reply) => {
    const { id: mosqueId } = req.params as { id: string }
    const programs = await prisma.mosqueProgram.findMany({
      where: { mosqueId, isActive: true },
      orderBy: { createdAt: 'asc' },
    })
    return reply.send({ success: true, data: { items: programs } })
  })

  // POST /mosques/:id/programs
  app.post('/:id/programs', { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] }, async (req, reply) => {
    const { id: mosqueId } = req.params as { id: string }
    const body = z.object({
      name: z.string().min(1).max(200),
      description: z.string().optional(),
      schedule: z.string().optional(),
      ageGroup: z.string().optional(),
    }).parse(req.body)
    const program = await prisma.mosqueProgram.create({ data: { mosqueId, ...body } })
    return reply.status(201).send({ success: true, data: program })
  })

  // PATCH /mosques/:id/programs/:programId
  app.patch('/:id/programs/:programId', { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] }, async (req, reply) => {
    const { programId } = req.params as { id: string; programId: string }
    const body = z.object({
      name: z.string().min(1).max(200).optional(),
      description: z.string().optional().nullable(),
      schedule: z.string().optional().nullable(),
      ageGroup: z.string().optional().nullable(),
      isActive: z.boolean().optional(),
    }).parse(req.body)
    const program = await prisma.mosqueProgram.update({ where: { id: programId }, data: body })
    return reply.send({ success: true, data: program })
  })

  // DELETE /mosques/:id/programs/:programId
  app.delete('/:id/programs/:programId', { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] }, async (req, reply) => {
    const { programId } = req.params as { id: string; programId: string }
    await prisma.mosqueProgram.delete({ where: { id: programId } })
    return reply.send({ success: true })
  })

  // ── Mosque Admin Management ────────────────────────────────────────────────

  // GET /mosques/:id/admins
  app.get(
    '/:id/admins',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { id: mosqueId } = req.params as { id: string }
      const admins = await prisma.mosqueAdmin.findMany({
        where: { mosqueId },
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        orderBy: { createdAt: 'asc' },
      })
      return reply.send({ success: true, data: { items: admins } })
    }
  )

  // POST /mosques/:id/admins — add or update admin (OWNER only)
  app.post(
    '/:id/admins',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { id: mosqueId } = req.params as { id: string }
      const requester = await prisma.mosqueAdmin.findUnique({
        where: { userId_mosqueId: { userId: req.userId!, mosqueId } },
      })
      if (!req.isSuperAdmin && requester?.role !== 'OWNER') {
        return reply.status(403).send({ success: false, error: 'Only mosque owners can manage admins' })
      }
      const { userId, role } = z.object({
        userId: z.string(),
        role: z.enum(['ADMIN', 'EDITOR']).default('ADMIN'),
      }).parse(req.body)
      const admin = await prisma.mosqueAdmin.upsert({
        where: { userId_mosqueId: { userId, mosqueId } },
        create: { userId, mosqueId, role },
        update: { role },
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      })
      return reply.status(201).send({ success: true, data: admin })
    }
  )

  // PATCH /mosques/:id/admins/:adminId — change role
  app.patch(
    '/:id/admins/:adminId',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { id: mosqueId, adminId } = req.params as { id: string; adminId: string }
      const requester = await prisma.mosqueAdmin.findUnique({
        where: { userId_mosqueId: { userId: req.userId!, mosqueId } },
      })
      if (!req.isSuperAdmin && requester?.role !== 'OWNER') {
        return reply.status(403).send({ success: false, error: 'Only mosque owners can manage admins' })
      }
      const { role } = z.object({ role: z.enum(['ADMIN', 'EDITOR']) }).parse(req.body)
      const updated = await prisma.mosqueAdmin.update({ where: { id: adminId }, data: { role } })
      return reply.send({ success: true, data: updated })
    }
  )

  // POST /mosques/:id/followers/group-message — create a named group chat, add all followers, send initial message + push notification
  app.post(
    '/:id/followers/group-message',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { id: mosqueId } = req.params as { id: string }
      const { groupName, message } = z.object({
        groupName: z.string().min(1).max(100),
        message: z.string().min(1).max(2000),
      }).parse(req.body)

      // Get all follower user IDs
      const followers = await prisma.userFollow.findMany({
        where: { mosqueId },
        select: { userId: true },
      })
      const memberIds = followers.map((f) => f.userId)

      if (memberIds.length === 0) {
        return reply.status(400).send({ success: false, error: 'This mosque has no followers to message' })
      }

      // Create group chat and initial message in a transaction
      const group = await prisma.$transaction(async (tx) => {
        const created = await tx.groupChat.create({
          data: {
            mosqueId,
            name: groupName,
            members: { create: memberIds.map((userId) => ({ userId })) },
          },
        })
        await tx.groupChatMessage.create({
          data: { groupChatId: created.id, body: message, fromAdmin: true },
        })
        return created
      })

      // Send push notifications to all followers
      notificationQueue.add('mosque_group_message', {
        type: 'mosque_group_message',
        userIds: memberIds,
        title: groupName,
        body: message,
        data: { groupId: group.id, mosqueId, type: 'group_message' },
      }).catch(() => {})

      return reply.status(201).send({ success: true, data: { groupId: group.id, memberCount: memberIds.length } })
    }
  )

  // DELETE /mosques/:id/admins/:adminId — remove admin
  app.delete(
    '/:id/admins/:adminId',
    { preHandler: [requireMosqueAdmin((req) => (req.params as any).id)] },
    async (req, reply) => {
      const { id: mosqueId, adminId } = req.params as { id: string; adminId: string }
      const requester = await prisma.mosqueAdmin.findUnique({
        where: { userId_mosqueId: { userId: req.userId!, mosqueId } },
      })
      if (!req.isSuperAdmin && requester?.role !== 'OWNER') {
        return reply.status(403).send({ success: false, error: 'Only mosque owners can manage admins' })
      }
      const target = await prisma.mosqueAdmin.findUnique({ where: { id: adminId } })
      if (target?.role === 'OWNER') {
        return reply.status(400).send({ success: false, error: 'Cannot remove the mosque owner' })
      }
      await prisma.mosqueAdmin.delete({ where: { id: adminId } })
      return reply.send({ success: true })
    }
  )
}
