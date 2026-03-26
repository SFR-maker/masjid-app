// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  clerkId: string
  email: string
  name?: string
  avatarUrl?: string
  isSuperAdmin: boolean
}

// ─── API Response Shapes ──────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  cursor?: string
  hasMore: boolean
}

// ─── Mosque ───────────────────────────────────────────────────────────────────

export interface MosqueListItem {
  id: string
  name: string
  slug: string
  city: string
  state: string
  latitude: number
  longitude: number
  logoUrl?: string
  isVerified: boolean
  hasWomensPrayer: boolean
  hasYouthPrograms: boolean
  followersCount: number
  distanceKm?: number
  hasOwner?: boolean
}

export interface MosqueDetail extends MosqueListItem {
  description?: string
  address: string
  zipCode: string
  country: string
  phone?: string
  email?: string
  website?: string
  bannerUrl?: string
  imamName?: string
  hasParking: boolean
  isAccessible: boolean
  languages: string[]
  khutbahLanguages: string[]
  donationUrl?: string
  photos: { url: string; caption?: string }[]
  isFollowing?: boolean
}

// ─── Prayer Times ─────────────────────────────────────────────────────────────

export interface PrayerTimeEntry {
  name: string
  adhan: string
  iqamah?: string
}

export interface DayPrayerTimes {
  date: string
  fajr: PrayerTimeEntry
  sunrise?: string
  dhuhr: PrayerTimeEntry
  asr: PrayerTimeEntry
  maghrib: PrayerTimeEntry
  isha: PrayerTimeEntry
}

// ─── Events ───────────────────────────────────────────────────────────────────

export type EventCategory =
  | 'GENERAL'
  | 'HALAQA'
  | 'YOUTH'
  | 'SISTERS'
  | 'JUMU_AH'
  | 'EID'
  | 'RAMADAN'
  | 'FUNDRAISER'
  | 'JANAZAH'
  | 'COMMUNITY'
  | 'EDUCATIONAL'
  | 'OTHER'

export type RsvpStatus = 'GOING' | 'NOT_GOING' | 'MAYBE'

export interface EventListItem {
  id: string
  mosqueId: string
  mosqueName: string
  title: string
  category: EventCategory
  startTime: string
  endTime?: string
  location?: string
  imageUrl?: string
  isOnline: boolean
  rsvpCount: number
  userRsvp?: RsvpStatus
}

// ─── Videos ───────────────────────────────────────────────────────────────────

export interface VideoListItem {
  id: string
  mosqueId: string
  mosqueName: string
  title: string
  thumbnailUrl?: string
  duration?: number
  viewCount: number
  likeCount: number
  muxPlaybackId?: string
  createdAt: string
  userLiked?: boolean
}

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationType =
  | 'PRAYER_REMINDER'
  | 'EVENT_REMINDER'
  | 'ANNOUNCEMENT'
  | 'NEW_VIDEO'
  | 'RSVP_CONFIRMED'
  | 'MOSQUE_VERIFIED'
  | 'GENERAL'

export interface NotificationItem {
  id: string
  type: NotificationType
  title: string
  body: string
  mosqueName?: string
  mosqueLogoUrl?: string
  isRead: boolean
  createdAt: string
  data?: Record<string, string>
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatMessageItem {
  id: string
  role: 'USER' | 'ASSISTANT'
  content: string
  sources?: { title: string; reference: string }[]
  createdAt: string
}
