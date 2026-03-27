import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { SafeAreaView } from 'react-native-safe-area-context'
import { formatDistanceToNow } from 'date-fns'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { api } from '../../lib/api'
import { useTheme } from '../../contexts/ThemeContext'

const TYPE_ICONS: Record<string, string> = {
  PRAYER_REMINDER: '🕌',
  EVENT_REMINDER: '📅',
  ANNOUNCEMENT: '📢',
  NEW_VIDEO: '🎬',
  RSVP_CONFIRMED: '✅',
  MOSQUE_VERIFIED: '✓',
  mosque_poll: '📊',
  GENERAL: '🔔',
}

export default function NotificationsScreen() {
  const { colors } = useTheme()
  const queryClient = useQueryClient()

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications?limit=50'),
    staleTime: 15_000,
  })

  const readAllMutation = useMutation({
    mutationFn: () => api.put('/notifications/read-all', {}),
    onSuccess: () => {
      queryClient.setQueryData(['notifications-unread-count'], 0)
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const clearAllMutation = useMutation({
    mutationFn: () => api.delete('/notifications/clear-all'),
    onMutate: () => {
      // Immediately zero the badge — no waiting for the server round-trip
      queryClient.setQueryData(['notifications-unread-count'], 0)
      queryClient.setQueryData(['notifications'], (old: any) =>
        old ? { ...old, data: { ...old.data, items: [] } } : old
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const notifications = data?.data?.items ?? []
  const unreadCount = notifications.filter((n: any) => !n.isRead).length

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14 }}>
        <View>
          <Text style={{ fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.6 }}>
            Notifications
          </Text>
          {unreadCount > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary }} />
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>{unreadCount} unread</Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={() => readAllMutation.mutate()}
              style={{ backgroundColor: colors.primaryLight, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}
            >
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>Mark read</Text>
            </TouchableOpacity>
          )}
          {notifications.length > 0 && (
            <TouchableOpacity
              onPress={() => clearAllMutation.mutate()}
              style={{ backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: colors.border }}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 80, paddingHorizontal: 32 }}>
              <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Ionicons name="notifications-outline" size={32} color={colors.primary} />
              </View>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: 6 }}>All caught up</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>Follow mosques to get updates on events and announcements</Text>
            </View>
          }
          renderItem={({ item }: { item: any }) => (
            <TouchableOpacity
              onPress={() => {
                const d = item.data ?? {}
                // Bug 2 fix: admin message replies route to the messages screen
                if (d.messageId || item.type === 'MESSAGE_REPLY') router.push('/messages' as any)
                else if (d.type === 'ayah_of_day' || item.type === 'AYAH_OF_DAY') {
                  const params = d.surah && d.ayah ? `?surah=${d.surah}&ayah=${d.ayah}` : ''
                  router.push(`/quran${params}` as any)
                }
                else if (d.pollId) router.push(`/poll/${d.pollId}` as any)
                else if (d.announcementId) router.push(`/announcement/${d.announcementId}` as any)
                else if (d.eventId) router.push(`/event/${d.eventId}` as any)
                else if (item.mosqueId) router.push(`/mosque/${item.mosqueId}` as any)
              }}
              activeOpacity={0.75}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                backgroundColor: item.isRead
                  ? colors.surface
                  : colors.isDark ? '#0D2B1A' : '#F0FDF4',
                borderRadius: 16,
                marginBottom: 8,
                padding: 14,
                borderWidth: 1,
                borderColor: item.isRead
                  ? colors.border
                  : colors.isDark ? '#1A4731' : '#BBF7D0',
                shadowColor: colors.primary,
                shadowOpacity: item.isRead ? 0.03 : 0.07,
                shadowOffset: { width: 0, height: 2 },
                shadowRadius: 8,
                elevation: 1,
              }}
            >
              <View style={{ position: 'relative', marginRight: 12 }}>
                {item.mosqueLogoUrl ? (
                  <Image source={{ uri: item.mosqueLogoUrl }} style={{ width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: '#F0F0F0' }} contentFit="cover" />
                ) : (
                  <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 20 }}>{TYPE_ICONS[item.type] ?? '🔔'}</Text>
                  </View>
                )}
                {!item.isRead && (
                  <View style={{ position: 'absolute', top: -2, right: -2, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.isDark ? '#0D2B1A' : '#F0FDF4' }} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                {item.mosqueName && (
                  <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700', letterSpacing: 0.3, marginBottom: 3 }}>
                    {item.mosqueName.toUpperCase()}
                  </Text>
                )}
                <Text style={{ color: colors.text, fontWeight: item.isRead ? '500' : '700', fontSize: 14, lineHeight: 20 }}>
                  {item.title}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 3, lineHeight: 18 }} numberOfLines={2}>
                  {item.body}
                </Text>
                <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 5, fontWeight: '500' }}>
                  {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  )
}
