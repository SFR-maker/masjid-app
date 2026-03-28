import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { format } from 'date-fns'
import { api } from '../../lib/api'
import { useTheme } from '../../contexts/ThemeContext'

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number | string; color?: string }) {
  const { colors } = useTheme()
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, alignItems: 'center', gap: 6, minWidth: 80 }}>
      <Ionicons name={icon as any} size={22} color={color ?? colors.primary} />
      <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>{value}</Text>
      <Text style={{ fontSize: 11, color: colors.textSecondary, textAlign: 'center', fontWeight: '600' }}>{label}</Text>
    </View>
  )
}

export function DashboardHome({ mosqueId, mosqueName, onNavigate }: {
  mosqueId: string; mosqueName: string; onNavigate: (section: string) => void
}) {
  const { colors } = useTheme()
  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['dashboard-stats', mosqueId],
    queryFn: () => api.get(`/mosques/${mosqueId}/dashboard-stats`),
    staleTime: 30_000,
  })
  const stats = data?.data ?? {}

  if (isLoading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />

  const upcomingEvents: any[] = stats.upcomingEvents ?? []
  const recentAnnouncements: any[] = stats.recentAnnouncements ?? []
  const topAnnouncements: any[] = stats.topAnnouncements ?? []

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 100 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
    >
      {/* Stats grid — row 1: 2 cards */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <StatCard icon="people-outline" label="Followers" value={stats.followersCount ?? 0} />
        <StatCard icon="calendar-outline" label="Events" value={stats.upcomingEventsCount ?? 0} color="#059669" />
      </View>
      {/* Stats grid — row 2: 3 cards */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <StatCard icon="checkmark-circle-outline" label="RSVPs" value={stats.rsvpCount ?? 0} color="#7C3AED" />
        <StatCard icon="videocam-outline" label="Videos" value={stats.videosCount ?? 0} color="#D97706" />
        <StatCard icon="mail-outline" label="Messages" value={stats.unreadCount ?? 0} color={stats.unreadCount > 0 ? '#DC2626' : colors.textTertiary} />
      </View>

      {/* Upcoming Events */}
      <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>Upcoming Events</Text>
          <TouchableOpacity onPress={() => onNavigate('events')} activeOpacity={0.7}>
            <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '600' }}>View all →</Text>
          </TouchableOpacity>
        </View>
        {upcomingEvents.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <Ionicons name="calendar-outline" size={32} color={colors.textTertiary} />
            <Text style={{ color: colors.textTertiary, marginTop: 8, fontSize: 13 }}>No upcoming events</Text>
            <TouchableOpacity onPress={() => onNavigate('events')} activeOpacity={0.8} style={{ marginTop: 12, backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 }}>
              <Text style={{ color: colors.primaryContrast, fontWeight: '700', fontSize: 13 }}>+ Create Event</Text>
            </TouchableOpacity>
          </View>
        ) : upcomingEvents.map((e: any, i: number) => (
          <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: colors.border }}>
            <View style={{ width: 42, height: 42, backgroundColor: colors.primaryLight, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary }}>{format(new Date(e.startTime), 'MMM').toUpperCase()}</Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.primary, lineHeight: 18 }}>{format(new Date(e.startTime), 'd')}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }} numberOfLines={1}>{e.title}</Text>
              <Text style={{ fontSize: 11, color: colors.textTertiary }}>{format(new Date(e.startTime), 'h:mm a')}{e.location ? ` · ${e.location}` : ''}</Text>
            </View>
            <View style={{ backgroundColor: colors.primaryLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '700' }}>{e.rsvpCount} RSVPs</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Recent Announcements */}
      <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>Recent Announcements</Text>
          <TouchableOpacity onPress={() => onNavigate('announcements')} activeOpacity={0.7}>
            <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '600' }}>View all</Text>
          </TouchableOpacity>
        </View>
        {recentAnnouncements.length === 0 ? (
          <Text style={{ color: colors.textTertiary, fontSize: 13, textAlign: 'center', paddingVertical: 16 }}>No announcements yet</Text>
        ) : recentAnnouncements.map((a: any, i: number) => (
          <View key={a.id} style={{ paddingVertical: 10, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {a.priority === 'URGENT' && <Text style={{ fontSize: 10 }}>🚨</Text>}
              {a.priority === 'IMPORTANT' && <Text style={{ fontSize: 10 }}>⚡</Text>}
              {!a.isPublished && <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}><Text style={{ fontSize: 9, color: colors.textTertiary, fontWeight: '700' }}>DRAFT</Text></View>}
              <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: colors.text }} numberOfLines={1}>{a.title}</Text>
            </View>
            <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 2 }}>{format(new Date(a.createdAt), 'MMM d, yyyy')} · ❤️ {a.likeCount ?? 0}</Text>
          </View>
        ))}
      </View>

      {/* Top Content */}
      {topAnnouncements.length > 0 && (
        <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 12 }}>Top Posts by Likes</Text>
          {topAnnouncements.map((a: any, i: number) => (
            <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: colors.border }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textTertiary, width: 24 }}>#{i + 1}</Text>
              <Text style={{ flex: 1, fontSize: 13, color: colors.text }} numberOfLines={1}>{a.title}</Text>
              <Text style={{ fontSize: 12, color: '#EF4444', fontWeight: '700' }}>❤️ {a.likeCount}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Quick Actions */}
      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary }}>Quick Actions</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {[
          { label: 'New Post', icon: 'megaphone-outline', section: 'announcements' },
          { label: 'New Event', icon: 'calendar-outline', section: 'events' },
          { label: 'Prayer Times', icon: 'time-outline', section: 'prayer' },
          { label: 'Upload Video', icon: 'videocam-outline', section: 'videos' },
          { label: 'New Poll', icon: 'bar-chart-outline', section: 'polls' },
          { label: 'Messages', icon: 'mail-outline', section: 'messages' },
        ].map((a) => (
          <TouchableOpacity key={a.label} onPress={() => onNavigate(a.section)} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: colors.border }}>
            <Ionicons name={a.icon as any} size={15} color={colors.primary} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  )
}
