import { FastifyInstance } from 'fastify'
import { authRoutes } from './auth'
import { mosqueRoutes } from './mosques'
import { prayerRoutes } from './prayer'
import { eventRoutes } from './events'
import { announcementRoutes } from './announcements'
import { videoRoutes } from './videos'
import { notificationRoutes } from './notifications'
import { chatRoutes } from './chat'
import { userRoutes } from './users'
import { searchRoutes } from './search'
import { adminRoutes } from './admin'
import { donationRoutes } from './donations'
import { reportRoutes } from './reports'
import { verificationRoutes } from './verification'
import { messageRoutes } from './messages'
import { pollRoutes } from './polls'

export async function buildRoutes(app: FastifyInstance) {
  app.register(authRoutes, { prefix: '/auth' })
  app.register(userRoutes, { prefix: '/users' })
  app.register(mosqueRoutes, { prefix: '/mosques' })
  app.register(prayerRoutes, { prefix: '/mosques' })
  app.register(eventRoutes)
  app.register(announcementRoutes)
  app.register(videoRoutes)
  app.register(notificationRoutes, { prefix: '/notifications' })
  app.register(chatRoutes, { prefix: '/chat' })
  app.register(searchRoutes, { prefix: '/search' })
  app.register(adminRoutes, { prefix: '/admin' })
  app.register(donationRoutes)
  app.register(reportRoutes, { prefix: '/reports' })
  app.register(verificationRoutes)
  app.register(messageRoutes)
  app.register(pollRoutes)
}
