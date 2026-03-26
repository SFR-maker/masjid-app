import { View, Text, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@clerk/clerk-expo'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { api } from '../../lib/api'
import { AnnouncementCard } from '../../components/AnnouncementCard'
import { EventCard } from '../../components/EventCard'
import { PollCard } from '../../components/PollCard'
import { PrayerTimesWidget } from '../../components/PrayerTimesWidget'
import { useTheme } from '../../contexts/ThemeContext'

const VIDEO_CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  LECTURE:     { bg: '#EDE9FE', text: '#6D28D9' },
  QURAN:       { bg: '#D1FAE5', text: '#065F46' },
  KHUTBAH:     { bg: '#DBEAFE', text: '#1D4ED8' },
  EDUCATIONAL: { bg: '#FEF3C7', text: '#92400E' },
  DUA:         { bg: '#FCE7F3', text: '#BE185D' },
}

function VideoFeedCard({ item }: { item: any }) {
  const { colors } = useTheme()
  const categoryStyle = VIDEO_CATEGORY_COLORS[item.category] ?? { bg: '#F3F4F6', text: '#4B5563' }

  return (
    <TouchableOpacity
      onPress={() => router.push(`/video/${item.id}`)}
      activeOpacity={0.9}
      style={{
        marginHorizontal: 16, marginBottom: 14,
        backgroundColor: colors.surface, borderRadius: 20, overflow: 'hidden',
        borderWidth: 1, borderColor: colors.border,
        shadowColor: '#000', shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: 3 }, shadowRadius: 12, elevation: 2,
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10, gap: 10 }}>
        {item.mosque?.logoUrl ? (
          <Image source={{ uri: item.mosque.logoUrl }} style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: '#F0F0F0' }} contentFit="cover" />
        ) : (
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 14 }}>🎬</Text>
          </View>
        )}
        <Text style={{ flex: 1, color: colors.text, fontWeight: '600', fontSize: 13, letterSpacing: -0.1 }} numberOfLines={1}>
          {item.mosque?.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: categoryStyle.bg, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 }}>
          <Text style={{ color: categoryStyle.text, fontSize: 11, fontWeight: '700', letterSpacing: 0.2 }}>
            {item.category?.replace('_', ' ') ?? 'VIDEO'}
          </Text>
        </View>
      </View>

      {/* Thumbnail */}
      {item.thumbnailUrl ? (
        <Image source={{ uri: item.thumbnailUrl }} style={{ width: '100%', aspectRatio: 16 / 9 }} contentFit="cover" />
      ) : (
        <View style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="play" size={26} color="white" style={{ marginLeft: 3 }} />
          </View>
        </View>
      )}

      {/* Content */}
      <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15, lineHeight: 22, marginBottom: 4, letterSpacing: -0.2 }} numberOfLines={2}>
          {item.title}
        </Text>
        {item.description ? (
          <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: 6 }} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
          <Ionicons name="eye-outline" size={12} color={colors.textTertiary} />
          <Text style={{ color: colors.textTertiary, fontSize: 11 }}>
            {(item.viewCount ?? 0).toLocaleString()} views
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

export default function HomeScreen() {
  const { user } = useUser()
  const { colors } = useTheme()
  const queryClient = useQueryClient()
  const firstName = user?.firstName ?? 'Friend'

  const {
    data: feedData,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch: refetchFeed,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ['home-feed'],
    queryFn: ({ pageParam }: { pageParam?: string }) =>
      api.get(`/users/me/feed${pageParam ? `?before=${encodeURIComponent(pageParam)}` : ''}`),
    getNextPageParam: (lastPage: any) =>
      lastPage?.data?.hasMore ? lastPage?.data?.cursor : undefined,
    initialPageParam: undefined as string | undefined,
    staleTime: 30_000,
  })

  const { data: followed } = useQuery({
    queryKey: ['followed-mosques'],
    queryFn: () => api.get('/users/me/follows'),
    staleTime: 60_000,
  })

  const feedItems = feedData?.pages.flatMap((p: any) => p?.data?.items ?? []) ?? []
  const followedMosques = followed?.data?.items ?? []
  const favoriteMosque = followedMosques.find((m: any) => m.isFavorite) ?? followedMosques[0] ?? null

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              refetchFeed()
            }}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
          <View>
            <Text style={{ color: colors.textSecondary, fontSize: 12, letterSpacing: 0.3, fontWeight: '500' }}>
              Assalamu Alaikum
            </Text>
            <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5, marginTop: 1 }}>
              {firstName} ✦
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/chat')}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 22, padding: 11,
              shadowColor: colors.primary, shadowOpacity: 0.35,
              shadowOffset: { width: 0, height: 4 }, shadowRadius: 10,
              elevation: 4,
            }}
          >
            <Ionicons name="chatbubble-ellipses" size={20} color="white" />
          </TouchableOpacity>
        </View>

        {/* Prayer widget */}
        <View style={{ paddingHorizontal: 16, marginBottom: 18 }}>
          <PrayerTimesWidget
            overrideMosqueId={favoriteMosque?.id}
            overrideMosqueName={favoriteMosque?.name}
          />
        </View>

        {/* No follows prompt */}
        {!followedMosques.length && (
          <View style={{
            marginHorizontal: 16, marginBottom: 18,
            backgroundColor: colors.primary, borderRadius: 20, padding: 20,
            shadowColor: colors.primary, shadowOpacity: 0.25,
            shadowOffset: { width: 0, height: 6 }, shadowRadius: 16, elevation: 4,
          }}>
            <Text style={{ color: colors.primaryLight, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6 }}>
              GET STARTED
            </Text>
            <Text style={{ color: 'white', fontWeight: '800', fontSize: 18, marginBottom: 6, letterSpacing: -0.3, lineHeight: 24 }}>
              🕌 Find your mosque
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, lineHeight: 20, marginBottom: 16 }}>
              Follow mosques to see prayer times, events, and announcements right here.
            </Text>
            <TouchableOpacity
              style={{
                backgroundColor: 'white', borderRadius: 12,
                paddingVertical: 10, paddingHorizontal: 18,
                alignSelf: 'flex-start',
              }}
              onPress={() => router.push('/(tabs)/discover')}
            >
              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>Discover Mosques →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <View style={{ paddingHorizontal: 16, gap: 14 }}>
            {[0, 1, 2].map(i => (
              <View key={i} style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceSecondary }} />
                  <View style={{ flex: 1, height: 13, borderRadius: 6, backgroundColor: colors.surfaceSecondary }} />
                </View>
                <View style={{ height: 16, borderRadius: 6, backgroundColor: colors.surfaceSecondary, marginBottom: 8 }} />
                <View style={{ height: 12, borderRadius: 6, backgroundColor: colors.surfaceSecondary, width: '70%' }} />
              </View>
            ))}
          </View>
        )}

        {/* Empty feed */}
        {feedItems.length === 0 && followedMosques.length > 0 && !isLoading && (
          <View style={{ alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 32 }}>📭</Text>
            </View>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: 6 }}>All caught up</Text>
            <Text style={{ color: colors.textTertiary, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
              Your mosques haven't posted anything new yet
            </Text>
          </View>
        )}

        {/* Feed */}
        {feedItems.map((item: any) => {
          if (item.type === 'announcement') return <AnnouncementCard key={item.id} item={item} />
          if (item.type === 'event') return <EventCard key={item.id} item={item} />
          if (item.type === 'video') return <VideoFeedCard key={item.id} item={item} />
          if (item.type === 'poll') return (
            <View key={item.id} style={{ marginHorizontal: 16 }}>
              <PollCard poll={item} queryKey={['home-feed']} />
            </View>
          )
          return null
        })}

        {/* Load more */}
        {hasNextPage && (
          <TouchableOpacity
            onPress={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            style={{ marginHorizontal: 16, marginBottom: 16, backgroundColor: colors.surface, borderRadius: 16, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}
          >
            {isFetchingNextPage
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 14 }}>Load more</Text>
            }
          </TouchableOpacity>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  )
}
