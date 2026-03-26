import { notFound } from 'next/navigation'
import { prisma } from '@masjid/database'
import Link from 'next/link'
import { format } from 'date-fns'

interface StatCardProps {
  label: string
  value: number
  sub?: string
  href?: string
  accentColor: string
  icon: React.ReactNode
}

function StatCard({ label, value, sub, href, accentColor, icon }: StatCardProps) {
  const inner = (
    <div>
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${accentColor}14`, color: accentColor }}
        >
          {icon}
        </div>
        {href && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cream-400 group-hover:text-forest-400 transition-colors mt-0.5">
            <path d="M7 17L17 7M17 7H7M17 7v10"/>
          </svg>
        )}
      </div>
      <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#8FA898' }}>
        {label}
      </p>
      <p className="font-fraunces text-4xl font-bold tracking-tight leading-none" style={{ color: '#1A2E22', fontFamily: 'Fraunces, Georgia, serif' }}>
        {value.toLocaleString()}
      </p>
      {sub && <p className="text-xs mt-1.5" style={{ color: '#A8BFB0' }}>{sub}</p>}
    </div>
  )

  const classes = 'bg-white rounded-2xl p-5 border transition-all duration-200 group'

  if (href) {
    return (
      <Link
        href={href}
        className={classes + ' hover:-translate-y-0.5 hover:border-forest-200 hover:shadow-md'}
        style={{ borderColor: '#EDE6D5', boxShadow: '0 1px 4px rgba(15,44,23,0.05)' }}
      >
        {inner}
      </Link>
    )
  }
  return (
    <div className={classes} style={{ borderColor: '#EDE6D5', boxShadow: '0 1px 4px rgba(15,44,23,0.05)' }}>
      {inner}
    </div>
  )
}

export default async function DashboardPage({ params }: { params: Promise<{ mosqueId: string }> }) {
  const { mosqueId } = await params
  // Admin Bug 4 fix: fetch unread DM count separately so we display unread, not total
  const [mosque, upcomingRsvps, recentAnnouncements, upcomingEvents, unreadMessagesCount] = await Promise.all([
    prisma.mosqueProfile.findUnique({
      where: { id: mosqueId },
      include: {
        _count: {
          select: {
            follows: true,
            events: { where: { startTime: { gte: new Date() } } },
            videos: true,
            announcements: true,
          },
        },
      },
    }),
    prisma.eventRsvp.count({
      where: { event: { mosqueId, startTime: { gte: new Date() } }, status: 'GOING' },
    }),
    prisma.announcement.findMany({
      where: { mosqueId, isPublished: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.event.findMany({
      where: { mosqueId, isPublished: true, isCancelled: false, startTime: { gte: new Date() } },
      orderBy: { startTime: 'asc' },
      take: 5,
    }),
    // Admin Bug 4 fix: count only UNREAD messages for the community inbox stat
    prisma.directMessage.count({
      where: { mosqueId, isRead: false },
    }),
  ])

  if (!mosque) notFound()

  return (
    <div className="p-8 max-w-6xl page-content">

      {/* ── Page header ── */}
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 flex-wrap mb-1.5">
            <h1
              className="text-3xl font-bold tracking-tight"
              style={{ fontFamily: 'Fraunces, Georgia, serif', color: '#0F2D1F' }}
            >
              {mosque.name}
            </h1>
            {mosque.isVerified && (
              <span className="badge-verified">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Verified
              </span>
            )}
          </div>
          <p className="text-sm font-medium" style={{ color: '#8FA898' }}>
            {mosque.city}, {mosque.state}
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            href={`/${mosqueId}/analytics`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150"
            style={{ border: '1px solid #EDE6D5', color: '#4A7B5E', background: '#FEFDFB' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
            Analytics
          </Link>
          <Link
            href={`/${mosqueId}/announcements`}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-150"
            style={{ background: 'linear-gradient(135deg, #155F31 0%, #0F4423 100%)', boxShadow: '0 2px 8px rgba(15,68,35,0.3)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Announcement
          </Link>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard
          label="Followers"
          value={mosque._count.follows}
          accentColor="#1B7A3E"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
        />
        <StatCard
          label="Upcoming Events"
          value={mosque._count.events}
          href={`/${mosqueId}/events`}
          accentColor="#C9963A"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
        />
        <StatCard
          label="Event RSVPs"
          value={upcomingRsvps}
          sub="for upcoming events"
          href={`/${mosqueId}/events`}
          accentColor="#0F4423"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>}
        />
        <StatCard
          label="Videos"
          value={mosque._count.videos}
          href={`/${mosqueId}/videos`}
          accentColor="#7C5CBF"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>}
        />
        {/* Admin Bug 4 fix: unread inbox count — clearly labelled as "unread" */}
        <StatCard
          label="Unread Messages"
          value={unreadMessagesCount}
          sub={unreadMessagesCount === 0 ? 'inbox clear' : 'need a reply'}
          href={`/${mosqueId}/messages`}
          accentColor="#0EA5E9"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}
        />
      </div>

      {/* ── Activity panels ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Upcoming events */}
        <div
          className="rounded-2xl p-6 text-white relative overflow-hidden"
          style={{ background: 'linear-gradient(145deg, #0F4423 0%, #0A2E17 60%, #061A0D 100%)' }}
        >
          {/* Subtle diamond pattern */}
          <div
            className="absolute inset-0 opacity-[0.035] pointer-events-none"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M16 0L32 16L16 32L0 16Z' fill='white'/%3E%3C/svg%3E\")" }}
          />
          <div className="relative">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-white text-base" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
                Upcoming Events
              </h2>
              <Link
                href={`/${mosqueId}/events`}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                style={{ color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.08)' }}
              >
                View all →
              </Link>
            </div>
            {upcomingEvents.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </div>
                <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>No upcoming events</p>
                <Link
                  href={`/${mosqueId}/events`}
                  className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold px-4 py-2 rounded-xl transition-colors"
                  style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)' }}
                >
                  + Create Event
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingEvents.map((e) => (
                  <Link
                    key={e.id}
                    href={`/${mosqueId}/events`}
                    className="flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-150 group hover:bg-white/[0.12]"
                    style={{ background: 'rgba(255,255,255,0.07)' }}
                  >
                    <div
                      className="text-center rounded-xl px-2.5 py-1.5 min-w-[44px] shrink-0"
                      style={{ background: 'rgba(201,150,58,0.25)' }}
                    >
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#E8C07A' }}>
                        {format(new Date(e.startTime), 'MMM')}
                      </p>
                      <p className="text-xl font-bold text-white leading-none" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
                        {format(new Date(e.startTime), 'd')}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{e.title}</p>
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        {format(new Date(e.startTime), 'h:mm a')}
                        {e.location ? ` · ${e.location}` : ''}
                      </p>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent announcements */}
        <div
          className="rounded-2xl p-6"
          style={{ background: '#FEFDFB', border: '1px solid #EDE6D5', boxShadow: '0 1px 4px rgba(15,44,23,0.05)' }}
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-base" style={{ fontFamily: 'Fraunces, Georgia, serif', color: '#0F2D1F' }}>
              Recent Announcements
            </h2>
            <Link
              href={`/${mosqueId}/announcements`}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: '#1B7A3E', background: '#F0F7F2' }}
            >
              View all
            </Link>
          </div>
          {recentAnnouncements.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: '#F0F7F2' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4A7B5E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 19-7z"/>
                </svg>
              </div>
              <p className="text-sm font-medium" style={{ color: '#8FA898' }}>No announcements yet</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: '#F4F0E6' }}>
              {recentAnnouncements.map((a) => (
                <div key={a.id} className="py-3.5 first:pt-0 last:pb-0">
                  <div className="flex items-start gap-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        {(a.priority as string) === 'URGENT' && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-red-50 text-red-600 border border-red-200 uppercase tracking-wide">
                            Urgent
                          </span>
                        )}
                        {(a.priority as string) === 'HIGH' && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600 border border-amber-200 uppercase tracking-wide">
                            High
                          </span>
                        )}
                        <p className="text-sm font-semibold" style={{ color: '#1A2E22' }}>{a.title}</p>
                      </div>
                      <p className="text-xs font-medium" style={{ color: '#A8BFB0' }}>
                        {format(new Date(a.createdAt), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
