import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@masjid/database'
import { requireAuth, requireSuperAdmin, requireAnyMosqueAdmin } from '../plugins/auth'

export async function adminRoutes(app: FastifyInstance) {
  // GET /admin/verification
  app.get('/verification', { preHandler: [requireSuperAdmin] }, async (req, reply) => {
    const requests = await prisma.verificationRequest.findMany({
      where: { status: 'PENDING' },
      include: {
        mosque: { select: { id: true, name: true, city: true, state: true } },
        requester: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    })
    return reply.send({ success: true, data: requests })
  })

  // PUT /admin/verification/:id
  app.put('/verification/:id', { preHandler: [requireSuperAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { action, adminNotes } = z
      .object({
        action: z.enum(['approve', 'reject']),
        adminNotes: z.string().optional(),
      })
      .parse(req.body)

    const request = await prisma.verificationRequest.update({
      where: { id },
      data: {
        status: action === 'approve' ? 'APPROVED' : 'REJECTED',
        adminNotes,
        reviewedAt: new Date(),
      },
    })

    if (action === 'approve') {
      await prisma.mosqueProfile.update({
        where: { id: request.mosqueId },
        data: { isVerified: true, verifiedAt: new Date() },
      })
    }

    return reply.send({ success: true, data: request })
  })

  // GET /admin/reports
  app.get('/reports', { preHandler: [requireSuperAdmin] }, async (req, reply) => {
    const { status = 'PENDING' } = req.query as { status?: string }
    const validStatus = z.enum(['PENDING', 'RESOLVED', 'DISMISSED']).safeParse(status)
    if (!validStatus.success) return reply.status(400).send({ success: false, error: 'Invalid status' })
    const reports = await prisma.report.findMany({
      where: { status: validStatus.data },
      include: { reporter: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    })
    return reply.send({ success: true, data: reports })
  })

  // PUT /admin/reports/:id
  app.put('/reports/:id', { preHandler: [requireSuperAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { status, notes } = z
      .object({
        status: z.enum(['RESOLVED', 'DISMISSED']),
        notes: z.string().optional(),
      })
      .parse(req.body)

    const report = await prisma.report.update({
      where: { id },
      data: { status, notes, resolvedAt: new Date() },
    })

    return reply.send({ success: true, data: report })
  })

  // GET /admin/stats — platform overview
  app.get('/stats', { preHandler: [requireSuperAdmin] }, async (req, reply) => {
    const [users, mosques, events, videos] = await Promise.all([
      prisma.user.count(),
      prisma.mosqueProfile.count({ where: { isActive: true } }),
      prisma.event.count({ where: { isPublished: true } }),
      prisma.video.count({ where: { isPublished: true, status: 'READY' } }),
    ])

    return reply.send({ success: true, data: { users, mosques, events, videos } })
  })

  // GET /admin/users/search?q= — search users (any mosque admin can use this)
  app.get('/users/search', { preHandler: [requireAnyMosqueAdmin] }, async (req, reply) => {
    const { q, limit = '10' } = req.query as { q?: string; limit?: string }
    if (!q || q.trim().length < 2) return reply.send({ success: true, data: { items: [] } })
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, email: true, avatarUrl: true },
      take: Math.min(50, parseInt(limit, 10)),
      orderBy: { name: 'asc' },
    })
    return reply.send({ success: true, data: { items: users } })
  })

  // ── Mosque Import (Google Places → local DB) ──────────────────────────────

  // POST /admin/mosque-import/search
  // Calls Google Places Text Search once, cross-checks against local DB,
  // returns status: 'new' | 'already_imported' | 'possible_duplicate'
  app.post('/mosque-import/search', { preHandler: [requireSuperAdmin] }, async (req, reply) => {
    const { query } = z.object({ query: z.string().min(2) }).parse(req.body)
    const apiKey = process.env.GOOGLE_PLACES_API_KEY
    if (!apiKey) {
      return reply.status(500).send({
        success: false,
        error: 'Google Places API key not configured. Add GOOGLE_PLACES_API_KEY to your Railway environment variables.',
      })
    }

    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query + ' mosque')}&type=mosque&key=${apiKey}`
    let gRes: Response
    try {
      gRes = await fetch(url)
    } catch {
      return reply.status(502).send({ success: false, error: 'Failed to reach Google Places API. Check your network.' })
    }
    const data: any = await gRes.json()

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      return reply.status(502).send({
        success: false,
        error: `Google Places error: ${data.status}${data.error_message ? ' — ' + data.error_message : ''}`,
      })
    }

    const places = (data.results ?? []).slice(0, 20)
    if (places.length === 0) return reply.send({ success: true, data: { items: [] } })

    const placeIds = places.map((p: any) => p.place_id as string)

    // Batch check: which placeIds are already in our DB
    const existingByPlaceId = await prisma.mosqueProfile.findMany({
      where: { googlePlaceId: { in: placeIds } },
      select: { googlePlaceId: true, id: true, name: true },
    })
    const placeIdMap = new Map<string, { id: string; name: string }>(existingByPlaceId.map((e) => [e.googlePlaceId!, e]))

    // Bounding-box query to find nearby mosques without a placeId (possible duplicates)
    const lats = places.map((p: any) => p.geometry?.location?.lat as number).filter((v: number) => v != null)
    const lngs = places.map((p: any) => p.geometry?.location?.lng as number).filter((v: number) => v != null)
    const nearbyMosques =
      lats.length > 0
        ? await prisma.mosqueProfile.findMany({
            where: {
              googlePlaceId: null,
              latitude: { gte: Math.min(...lats) - 0.02, lte: Math.max(...lats) + 0.02 },
              longitude: { gte: Math.min(...lngs) - 0.02, lte: Math.max(...lngs) + 0.02 },
            },
            select: { id: true, name: true, latitude: true, longitude: true },
          })
        : []

    const items = places.map((p: any) => {
      const lat: number | null = p.geometry?.location?.lat ?? null
      const lng: number | null = p.geometry?.location?.lng ?? null

      const alreadyImported = placeIdMap.get(p.place_id)
      if (alreadyImported) {
        return {
          placeId: p.place_id, name: p.name, address: p.formatted_address,
          latitude: lat, longitude: lng, rating: p.rating ?? null,
          status: 'already_imported' as const,
          existingMosqueId: alreadyImported.id,
          existingMosqueName: alreadyImported.name,
        }
      }

      const nearby =
        lat != null && lng != null
          ? nearbyMosques.find(
              (m) =>
                m.latitude != null &&
                m.longitude != null &&
                Math.abs(m.latitude - lat) < 0.001 &&
                Math.abs(m.longitude - lng) < 0.001,
            )
          : undefined

      return {
        placeId: p.place_id, name: p.name, address: p.formatted_address,
        latitude: lat, longitude: lng, rating: p.rating ?? null,
        status: nearby ? ('possible_duplicate' as const) : ('new' as const),
        existingMosqueId: nearby?.id ?? null,
        existingMosqueName: nearby?.name ?? null,
      }
    })

    return reply.send({ success: true, data: { items } })
  })

  // POST /admin/mosque-import/details
  // Fetch all enrichment fields from Google Place Details (called only once per mosque, at import time)
  // Fields fetched: phone, website, email, opening_hours — everything we can store locally so Google is never called again.
  app.post('/mosque-import/details', { preHandler: [requireSuperAdmin] }, async (req, reply) => {
    const { placeId } = z.object({ placeId: z.string() }).parse(req.body)
    const apiKey = process.env.GOOGLE_PLACES_API_KEY
    if (!apiKey) return reply.send({ success: true, data: { phone: null, website: null, email: null } })

    try {
      // Fetch every storable field in a single API call — no future Google calls needed for this mosque
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_phone_number,international_phone_number,website,editorial_summary&key=${apiKey}`
      const res = await fetch(url)
      const data: any = await res.json()
      const result = data.result ?? {}
      return reply.send({
        success: true,
        data: {
          phone: result.formatted_phone_number ?? result.international_phone_number ?? null,
          website: result.website ?? null,
          description: result.editorial_summary?.overview ?? null,
        },
      })
    } catch {
      return reply.send({ success: true, data: { phone: null, website: null, description: null } })
    }
  })

  // POST /admin/mosque-import/save
  // Save a Google Place result to local DB. After this, no Google calls needed for this mosque.
  app.post('/mosque-import/save', { preHandler: [requireSuperAdmin] }, async (req, reply) => {
    const body = z
      .object({
        placeId: z.string(),
        name: z.string().min(2),
        address: z.string().optional(),
        city: z.string().min(1),
        state: z.string().min(1),
        zipCode: z.string().optional(),
        country: z.string().default('US'),
        latitude: z.number().nullable().optional(),
        longitude: z.number().nullable().optional(),
        phone: z.string().optional(),
        website: z.string().optional(),
        description: z.string().optional(),
        forceImport: z.boolean().default(false),
      })
      .parse(req.body)

    // Exact dedup by placeId — never allow duplicate
    const existingByPlaceId = await prisma.mosqueProfile.findUnique({
      where: { googlePlaceId: body.placeId },
      select: { id: true, name: true },
    })
    if (existingByPlaceId) {
      return reply.status(409).send({
        success: false,
        error: `Already imported as "${existingByPlaceId.name}"`,
        data: { existingId: existingByPlaceId.id, existingName: existingByPlaceId.name },
      })
    }

    // Proximity dedup — warn admin unless they explicitly force it
    if (!body.forceImport && body.latitude != null && body.longitude != null) {
      const nearby = await prisma.mosqueProfile.findFirst({
        where: {
          latitude: { gte: body.latitude - 0.001, lte: body.latitude + 0.001 },
          longitude: { gte: body.longitude - 0.001, lte: body.longitude + 0.001 },
        },
        select: { id: true, name: true },
      })
      if (nearby) {
        return reply.status(409).send({
          success: false,
          error: `Possible duplicate: "${nearby.name}" already exists at this location.`,
          data: { existingId: nearby.id, existingName: nearby.name, isDuplicate: true },
        })
      }
    }

    // Generate unique slug
    const baseSlug = body.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 80)
    let slug = baseSlug
    let attempt = 0
    while (await prisma.mosqueProfile.findUnique({ where: { slug } })) slug = `${baseSlug}-${++attempt}`

    const now = new Date()
    const mosque = await prisma.mosqueProfile.create({
      data: {
        name: body.name,
        slug,
        description: body.description,
        address: body.address,
        city: body.city,
        state: body.state,
        zipCode: body.zipCode,
        country: body.country,
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        phone: body.phone,
        website: body.website,
        googlePlaceId: body.placeId,
        importedAt: now,
        lastSyncedAt: now,           // Mark data as fresh — no need to re-call Google
        importSource: 'google_places',
      },
    })

    return reply.status(201).send({ success: true, data: mosque })
  })

  // POST /admin/mosque-import/assign-admin
  // Assign a user as admin of a mosque (upserts — safe to call multiple times)
  app.post('/mosque-import/assign-admin', { preHandler: [requireSuperAdmin] }, async (req, reply) => {
    const { mosqueId, userId, role } = z
      .object({
        mosqueId: z.string(),
        userId: z.string(),
        role: z.enum(['OWNER', 'ADMIN', 'EDITOR']).default('OWNER'),
      })
      .parse(req.body)

    const [mosque, user] = await Promise.all([
      prisma.mosqueProfile.findUnique({ where: { id: mosqueId }, select: { id: true, name: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } }),
    ])
    if (!mosque) return reply.status(404).send({ success: false, error: 'Mosque not found' })
    if (!user) return reply.status(404).send({ success: false, error: 'User not found' })

    const admin = await prisma.mosqueAdmin.upsert({
      where: { userId_mosqueId: { userId, mosqueId } },
      create: { userId, mosqueId, role },
      update: { role },
    })

    return reply.send({ success: true, data: { admin, mosque, user } })
  })

  // POST /admin/mosque-import/resync/:mosqueId
  // Re-fetch phone/website/description from Google using the stored placeId.
  // This is the ONLY time Google is called after initial import — and only on demand.
  app.post('/mosque-import/resync/:mosqueId', { preHandler: [requireSuperAdmin] }, async (req, reply) => {
    const { mosqueId } = req.params as { mosqueId: string }
    const apiKey = process.env.GOOGLE_PLACES_API_KEY
    if (!apiKey) return reply.status(500).send({ success: false, error: 'GOOGLE_PLACES_API_KEY not configured' })

    const mosque = await prisma.mosqueProfile.findUnique({
      where: { id: mosqueId },
      select: { id: true, name: true, googlePlaceId: true },
    })
    if (!mosque) return reply.status(404).send({ success: false, error: 'Mosque not found' })
    if (!mosque.googlePlaceId) return reply.status(400).send({ success: false, error: 'This mosque has no Google Place ID stored — cannot resync.' })

    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${mosque.googlePlaceId}&fields=formatted_phone_number,international_phone_number,website,editorial_summary,formatted_address&key=${apiKey}`
      const res = await fetch(url)
      const data: any = await res.json()
      const result = data.result ?? {}

      const updated = await prisma.mosqueProfile.update({
        where: { id: mosqueId },
        data: {
          phone: result.formatted_phone_number ?? result.international_phone_number ?? undefined,
          website: result.website ?? undefined,
          description: result.editorial_summary?.overview ?? undefined,
          lastSyncedAt: new Date(),
        },
        select: { id: true, name: true, phone: true, website: true, description: true, lastSyncedAt: true },
      })
      return reply.send({ success: true, data: updated })
    } catch (err: any) {
      return reply.status(502).send({ success: false, error: `Google API error: ${err.message}` })
    }
  })

  // ── Bulk US Mosque Import ─────────────────────────────────────────────────────

  // In-memory job state (single-server; resets on restart)
  const bulkJob: {
    running: boolean
    total: number
    imported: number
    skipped: number
    errors: number
    currentQuery: string
    log: string[]
    finishedAt: string | null
  } = { running: false, total: 0, imported: 0, skipped: 0, errors: 0, currentQuery: '', log: [], finishedAt: null }

  // GET /admin/mosque-import/bulk-status
  app.get('/mosque-import/bulk-status', { preHandler: [requireSuperAdmin] }, async (_req, reply) => {
    return reply.send({ success: true, data: bulkJob })
  })

  // POST /admin/mosque-import/bulk-us — start background import of US mosques
  app.post('/mosque-import/bulk-us', { preHandler: [requireSuperAdmin] }, async (_req, reply) => {
    if (bulkJob.running) {
      return reply.status(409).send({ success: false, error: 'Bulk import already running' })
    }
    const apiKey = process.env.GOOGLE_PLACES_API_KEY
    if (!apiKey) {
      return reply.status(500).send({ success: false, error: 'GOOGLE_PLACES_API_KEY not configured' })
    }

    // Reset state
    Object.assign(bulkJob, { running: true, total: 0, imported: 0, skipped: 0, errors: 0, currentQuery: '', log: [], finishedAt: null })

    // Seed queries: all US states + major Muslim-population cities
    const queries = [
      'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
      'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
      'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
      'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
      'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
      'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
      'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
      'Wisconsin', 'Wyoming',
      // Major Muslim-population cities for denser coverage
      'New York City NY', 'Dearborn MI', 'Chicago IL', 'Houston TX', 'Los Angeles CA',
      'Philadelphia PA', 'Detroit MI', 'Washington DC', 'Dallas TX', 'Atlanta GA',
      'Minneapolis MN', 'Columbus OH', 'San Jose CA', 'San Diego CA', 'Tampa FL',
      'Paterson NJ', 'Jersey City NJ', 'Bridgeview IL', 'Sterling Heights MI', 'Fremont CA',
    ]

    // Fire-and-forget async job
    ;(async () => {
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

      for (const q of queries) {
        bulkJob.currentQuery = q
        let pageToken: string | undefined

        for (let page = 0; page < 3; page++) {
          try {
            let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent('mosque ' + q)}&type=mosque&key=${apiKey}`
            if (pageToken) url += `&pagetoken=${pageToken}`

            const res = await fetch(url)
            const data: any = await res.json()
            pageToken = data.next_page_token

            const places: any[] = data.results ?? []
            bulkJob.total += places.length

            for (const p of places) {
              const lat: number | null = p.geometry?.location?.lat ?? null
              const lng: number | null = p.geometry?.location?.lng ?? null

              // Skip if already imported
              const existing = await prisma.mosqueProfile.findFirst({
                where: {
                  OR: [
                    { googlePlaceId: p.place_id },
                    ...(lat != null && lng != null ? [{
                      latitude: { gte: lat - 0.001, lte: lat + 0.001 },
                      longitude: { gte: lng - 0.001, lte: lng + 0.001 },
                    }] : []),
                  ],
                },
                select: { id: true },
              })

              if (existing) {
                bulkJob.skipped++
                continue
              }

              // Parse city/state from formatted_address
              const parts = (p.formatted_address as string ?? '').split(',').map((s: string) => s.trim())
              const country = parts[parts.length - 1]?.trim() ?? ''
              if (!country.includes('USA') && !country.includes('United States')) {
                bulkJob.skipped++
                continue
              }
              const stateZip = parts[parts.length - 2]?.trim() ?? ''
              const stateMatch = stateZip.match(/^([A-Z]{2})\s*(\d{5})?$/)
              const state = stateMatch?.[1] ?? ''
              const zipCode = stateMatch?.[2]
              const city = parts[parts.length - 3]?.trim() ?? ''

              // Generate slug
              const baseSlug = p.name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').slice(0, 80)
              let slug = baseSlug
              let attempt = 0
              while (await prisma.mosqueProfile.findUnique({ where: { slug } })) slug = `${baseSlug}-${++attempt}`

              try {
                const bulkNow = new Date()
                await prisma.mosqueProfile.create({
                  data: {
                    name: p.name,
                    slug,
                    address: p.formatted_address,
                    city: city || q,
                    state: state || '',
                    zipCode,
                    country: 'US',
                    latitude: lat,
                    longitude: lng,
                    googlePlaceId: p.place_id,
                    importedAt: bulkNow,
                    lastSyncedAt: bulkNow,
                    importSource: 'google_places',
                  },
                })
                bulkJob.imported++
                bulkJob.log.push(`✓ ${p.name} (${city}, ${state})`)
              } catch {
                bulkJob.errors++
              }
            }

            if (!pageToken) break
            // Google requires 2s between paginated requests
            await sleep(2000)
          } catch (err: any) {
            bulkJob.log.push(`✗ Error on query "${q}": ${err.message}`)
            bulkJob.errors++
            break
          }
        }
      }

      bulkJob.running = false
      bulkJob.currentQuery = ''
      bulkJob.finishedAt = new Date().toISOString()
    })()

    return reply.send({ success: true, message: 'Bulk import started. Poll /admin/mosque-import/bulk-status for progress.' })
  })

  // GET /admin/mosque-import/unowned — mosques without an OWNER admin
  app.get('/mosque-import/unowned', { preHandler: [requireSuperAdmin] }, async (req, reply) => {
    const { cursor, limit = '50' } = req.query as { cursor?: string; limit?: string }
    const mosques = await prisma.mosqueProfile.findMany({
      where: {
        isActive: true,
        admins: { none: { role: 'OWNER' } },
      },
      select: { id: true, name: true, city: true, state: true, zipCode: true, googlePlaceId: true, importSource: true, importedAt: true },
      take: Number(limit),
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { name: 'asc' },
    })
    return reply.send({
      success: true,
      data: {
        items: mosques,
        cursor: mosques[mosques.length - 1]?.id,
        hasMore: mosques.length === Number(limit),
      },
    })
  })
}
