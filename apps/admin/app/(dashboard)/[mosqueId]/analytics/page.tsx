import { notFound } from 'next/navigation'
import { prisma } from '@masjid/database'
import { formatDistanceToNow } from 'date-fns'

function StatCard({ label, value, icon, sub }: { label: string; value: string | number; icon: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{typeof value === 'number' ? value.toLocaleString() : value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
    </div>
  )
}

function settled<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === 'fulfilled' ? result.value : fallback
}

function safe<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return fn()
  } catch {
    return Promise.reject(new Error('Model not available'))
  }
}

export default async function AnalyticsPage({ params }: { params: Promise<{ mosqueId: string }> }) {
  const { mosqueId } = await params

  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [
    mosqueResult,
    totalFollowersResult,
    newFollowersWeekResult,
    newFollowersMonthResult,
    topAnnouncementsResult,
    recentEventsResult,
    totalLikesResult,
    totalCommentsResult,
    pollVotesResult,
    pollCountResult,
  ] = await Promise.allSettled([
    safe(() => prisma.mosqueProfile.findUnique({ where: { id: mosqueId }, select: { name: true } })),
    safe(() => prisma.userFollow.count({ where: { mosqueId } })),
    safe(() => prisma.userFollow.count({ where: { mosqueId, createdAt: { gte: weekAgo } } })),
    safe(() => prisma.userFollow.count({ where: { mosqueId, createdAt: { gte: monthAgo } } })),

    safe(() => prisma.announcement.findMany({
      where: { mosqueId, isPublished: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true, title: true, createdAt: true,
        _count: { select: { likes: true, comments: true } },
      },
    })),

    safe(() => prisma.event.findMany({
      where: { mosqueId, startTime: { gte: monthAgo } },
      orderBy: { startTime: 'desc' },
      take: 5,
      select: {
        id: true, title: true, startTime: true,
        _count: { select: { rsvps: true } },
        rsvps: { where: { status: 'GOING' }, select: { id: true } },
      },
    })),

    safe(() => prisma.announcementLike.count({ where: { announcement: { mosqueId } } })),
    safe(() => prisma.announcementComment.count({ where: { announcement: { mosqueId } } })),
    safe(() => prisma.pollVote.count({ where: { poll: { mosqueId } } })),
    safe(() => prisma.poll.count({ where: { mosqueId } })),
  ])

  const mosque = settled(mosqueResult, null)
  if (!mosque) notFound()

  const totalFollowers = settled(totalFollowersResult, 0)
  const newFollowersWeek = settled(newFollowersWeekResult, 0)
  const newFollowersMonth = settled(newFollowersMonthResult, 0)
  const allAnnouncements = settled(topAnnouncementsResult, [])
  const recentEvents = settled(recentEventsResult, [])
  const totalLikes = settled(totalLikesResult, 0)
  const totalComments = settled(totalCommentsResult, 0)
  const pollVotes = settled(pollVotesResult, 0)
  const pollCount = settled(pollCountResult, 0)

  const topAnnouncements = allAnnouncements
    .sort((a, b) => b._count.likes - a._count.likes)
    .slice(0, 5)

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-500 text-sm mt-1">Insights for {mosque.name}</p>
      </div>

      {/* Follower Stats */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Followers</h2>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard label="Total Followers" value={totalFollowers} icon="👥" />
        <StatCard label="New This Week" value={newFollowersWeek} icon="📈" />
        <StatCard label="New This Month" value={newFollowersMonth} icon="📅" />
      </div>

      {/* Engagement Stats */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Engagement</h2>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard label="Total Likes" value={totalLikes} icon="❤️" sub="on announcements" />
        <StatCard label="Total Comments" value={totalComments} icon="💬" sub="on announcements" />
        <StatCard label="Poll Votes" value={pollVotes} icon="📊" sub={`across ${pollCount} poll${pollCount !== 1 ? 's' : ''}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Announcements */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Top Announcements</h2>
          {topAnnouncements.length === 0 ? (
            <p className="text-gray-400 text-sm py-4 text-center">No announcements yet</p>
          ) : (
            <div className="space-y-1">
              {topAnnouncements.map((a, i) => (
                <div key={a.id} className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
                  <span className="text-sm font-bold text-gray-200 w-4 shrink-0 mt-0.5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{a.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex gap-3 shrink-0 text-xs text-gray-400">
                    <span>❤️ {a._count.likes}</span>
                    <span>💬 {a._count.comments}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Event RSVP Breakdown */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Recent Event RSVPs <span className="text-gray-400 font-normal text-xs">(last 30 days)</span></h2>
          {recentEvents.length === 0 ? (
            <p className="text-gray-400 text-sm py-4 text-center">No events in the last 30 days</p>
          ) : (
            <div className="space-y-1">
              {recentEvents.map((e) => {
                const going = e.rsvps.length
                const total = e._count.rsvps
                const pct = total > 0 ? Math.round((going / total) * 100) : 0
                return (
                  <div key={e.id} className="py-2.5 border-b border-gray-50 last:border-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-medium text-gray-900 truncate flex-1 mr-2">{e.title}</p>
                      <span className="text-xs text-gray-400 shrink-0">{going} / {total} going</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="bg-green-600 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
