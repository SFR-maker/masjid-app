/**
 * Videos Tab — full-screen TikTok-style feed
 * Fixes applied:
 *  - Fix 1: Auto-play on scroll (onViewableItemsChanged, 60% threshold)
 *  - Fix 2: Search bar + category filter pill row (client-side filter)
 *  - Fix 4: Heart icon with scale animation + optimistic like toggle
 */

import { useState, useCallback, useRef } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, Dimensions,
  ActivityIndicator, StatusBar, StyleSheet, Share, Platform,
  TextInput, ScrollView, Animated,
} from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { Image } from 'expo-image'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons, Feather } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { api } from '../../lib/api'
import { useTheme } from '../../contexts/ThemeContext'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')

// Category label colours
const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  LECTURE:     { bg: 'rgba(109,40,217,0.75)', text: '#EDE9FE' },
  QURAN:       { bg: 'rgba(6,95,70,0.75)',    text: '#D1FAE5' },
  KHUTBAH:     { bg: 'rgba(29,78,216,0.75)',  text: '#DBEAFE' },
  EDUCATIONAL: { bg: 'rgba(146,64,14,0.75)',  text: '#FEF3C7' },
  DUA:         { bg: 'rgba(190,24,93,0.75)',  text: '#FCE7F3' },
  NASHEED:     { bg: 'rgba(234,88,12,0.75)',  text: '#FFEDD5' },
  EVENT:       { bg: 'rgba(15,118,110,0.75)', text: '#CCFBF1' },
}

// Feed category filters shown in the pill bar
const FEED_CATEGORIES = ['All', 'Khutbah', 'Lecture', 'Quran', 'Nasheed', 'Kids', 'Events']

// Map display label → enum value (or '' for All)
const CATEGORY_MAP: Record<string, string> = {
  All: '',
  Khutbah: 'KHUTBAH',
  Lecture: 'LECTURE',
  Quran: 'QURAN',
  Nasheed: 'NASHEED',
  Kids: 'EDUCATIONAL',
  Events: 'EVENT',
}

// ── Skeleton card while loading ─────────────────────────────────────────────
function SkeletonCard() {
  return (
    <View style={[styles.card, { backgroundColor: '#111' }]}>
      <View style={{ position: 'absolute', bottom: 100, left: 16, right: 80 }}>
        <View style={{ height: 14, width: '50%', backgroundColor: '#333', borderRadius: 7, marginBottom: 10 }} />
        <View style={{ height: 18, width: '80%', backgroundColor: '#333', borderRadius: 9, marginBottom: 8 }} />
        <View style={{ height: 14, width: '60%', backgroundColor: '#333', borderRadius: 7 }} />
      </View>
    </View>
  )
}

// ── Animated like button ─────────────────────────────────────────────────────
function LikeButton({ liked, count, onPress }: { liked: boolean; count: number; onPress: () => void }) {
  const scaleAnim = useRef(new Animated.Value(1)).current

  function handlePress() {
    // Spring scale: 1 → 1.3 → 1
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1.3, useNativeDriver: true, speed: 40, bounciness: 10 }),
      Animated.spring(scaleAnim, { toValue: 1,   useNativeDriver: true, speed: 40, bounciness: 6 }),
    ]).start()
    onPress()
  }

  return (
    <TouchableOpacity style={styles.railItem} onPress={handlePress} activeOpacity={0.7}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Ionicons
          name={liked ? 'heart' : 'heart-outline'}
          size={28}
          color={liked ? '#EF4444' : '#fff'}
        />
      </Animated.View>
      <Text style={styles.railLabel}>{(count ?? 0).toLocaleString()}</Text>
    </TouchableOpacity>
  )
}

// ── Single full-screen video card ────────────────────────────────────────────
function VideoCard({ item, isActive }: { item: any; isActive: boolean }) {
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const videoRef = useRef<Video>(null)

  const catStyle = CATEGORY_COLORS[item.category] ?? { bg: 'rgba(75,85,99,0.75)', text: '#F3F4F6' }

  // Fix 4: optimistic like with animation
  const likeMutation = useMutation({
    mutationFn: () => api.post(`/videos/${item.id}/like`, {}),
    onMutate: () => {
      // Optimistic update
      queryClient.setQueryData(['videos-feed'], (old: any) => {
        if (!old) return old
        return {
          ...old,
          data: {
            ...old.data,
            items: (old.data?.items ?? []).map((v: any) =>
              v.id === item.id
                ? {
                    ...v,
                    userLiked: !v.userLiked,
                    likeCount: (v.likeCount ?? 0) + (v.userLiked ? -1 : 1),
                  }
                : v
            ),
          },
        }
      })
    },
    onError: () => {
      // Revert on error
      queryClient.setQueryData(['videos-feed'], (old: any) => {
        if (!old) return old
        return {
          ...old,
          data: {
            ...old.data,
            items: (old.data?.items ?? []).map((v: any) =>
              v.id === item.id
                ? {
                    ...v,
                    userLiked: !v.userLiked,
                    likeCount: (v.likeCount ?? 0) + (v.userLiked ? -1 : 1),
                  }
                : v
            ),
          },
        }
      })
    },
  })

  async function handleShare() {
    try {
      await Share.share({
        message: `${item.title} — ${item.mosque?.name ?? 'Mosque'}\n\nWatch on the Masjid app`,
        title: item.title,
      })
    } catch {}
  }

  return (
    <View style={styles.card}>
      {/* Fix 1: only render Video component when active; show thumbnail otherwise */}
      {isActive && item.streamUrl ? (
        <Video
          ref={videoRef}
          source={{ uri: item.streamUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.COVER}
          shouldPlay={isActive}
          isLooping
          isMuted={false}
        />
      ) : (
        <Image
          source={{ uri: item.thumbnailUrl ?? `https://placehold.co/414x896/0F172A/1E293B?text=` }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      )}

      {/* Dark gradient overlay at bottom */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.85)']}
        style={styles.gradient}
        pointerEvents="none"
      />

      {/* ── Right action rail ── */}
      <View style={[styles.rail, { bottom: insets.bottom + 80 }]}>
        {/* Fix 4: animated like button */}
        <LikeButton
          liked={item.userLiked}
          count={item.likeCount ?? 0}
          onPress={() => likeMutation.mutate()}
        />

        {/* View count */}
        <View style={styles.railItem}>
          <Ionicons name="eye-outline" size={26} color="#fff" />
          <Text style={styles.railLabel}>{(item.viewCount ?? 0).toLocaleString()}</Text>
        </View>

        {/* Share */}
        <TouchableOpacity style={styles.railItem} onPress={handleShare}>
          <Feather name="share-2" size={24} color="#fff" />
          <Text style={styles.railLabel}>Share</Text>
        </TouchableOpacity>

        {/* Open full detail page */}
        <TouchableOpacity style={styles.railItem} onPress={() => router.push(`/video/${item.id}`)}>
          <Ionicons name="expand-outline" size={24} color="#fff" />
          <Text style={styles.railLabel}>More</Text>
        </TouchableOpacity>
      </View>

      {/* ── Bottom info overlay ── */}
      <View style={[styles.bottomInfo, { paddingBottom: insets.bottom + 70 }]}>
        <TouchableOpacity
          onPress={() => item.mosque?.id && router.push(`/mosque/${item.mosque.id}`)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}
        >
          {item.mosque?.logoUrl ? (
            <Image
              source={{ uri: item.mosque.logoUrl }}
              style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)' }}
              contentFit="cover"
            />
          ) : (
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 12 }}>🕌</Text>
            </View>
          )}
          <Text style={styles.mosqueName}>{item.mosque?.name ?? 'Mosque'}</Text>
        </TouchableOpacity>

        <Text style={styles.videoTitle} numberOfLines={2}>{item.title}</Text>

        {item.category && (
          <View style={[styles.categoryBadge, { backgroundColor: catStyle.bg }]}>
            <Text style={{ color: catStyle.text, fontSize: 11, fontWeight: '700', letterSpacing: 0.3 }}>
              {item.category.replace('_', ' ')}
            </Text>
          </View>
        )}
      </View>
    </View>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function VideosScreen() {
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const [visibleIndex, setVisibleIndex] = useState(0)

  // Fix 2: search + category state
  const [searchText, setSearchText] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')

  const { data, isLoading } = useQuery({
    queryKey: ['videos-feed'],
    queryFn: () => api.get('/videos?limit=40'),
    staleTime: 30_000,
  })

  const allVideos: any[] = data?.data?.items ?? []

  // Fix 2: client-side filter
  const videos = allVideos.filter((v) => {
    const catFilter = CATEGORY_MAP[selectedCategory]
    const matchesCategory = !catFilter || v.category === catFilter
    const matchesSearch =
      !searchText.trim() ||
      v.title?.toLowerCase().includes(searchText.toLowerCase()) ||
      v.description?.toLowerCase().includes(searchText.toLowerCase())
    return matchesCategory && matchesSearch
  })

  // Fix 1: track visible index with 60% threshold
  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setVisibleIndex(viewableItems[0].index ?? 0)
    }
  }, [])

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current

  // Fix 2: header height for FlatList padding
  const FILTER_BAR_HEIGHT = 110

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <SkeletonCard />
      </View>
    )
  }

  if (allVideos.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <Ionicons name="play-circle-outline" size={64} color="rgba(255,255,255,0.3)" />
        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 17, fontWeight: '700', marginTop: 16 }}>No videos yet</Text>
        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 6, textAlign: 'center', paddingHorizontal: 40 }}>
          Follow mosques to see their lectures and video content
        </Text>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <FlatList
        data={videos}
        keyExtractor={(v: any) => v.id}
        renderItem={({ item, index }) => (
          <VideoCard item={item} isActive={index === visibleIndex} />
        )}
        pagingEnabled
        snapToInterval={SCREEN_H}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        removeClippedSubviews
        windowSize={3}
        initialNumToRender={2}
        maxToRenderPerBatch={3}
        getItemLayout={(_data, index) => ({ length: SCREEN_H, offset: SCREEN_H * index, index })}
        contentContainerStyle={{ paddingTop: 0 }}
      />

      {/* Fix 2: search + category bar — absolute, floats over feed */}
      <View
        style={[
          styles.filterBarWrapper,
          { paddingTop: insets.top + 8 },
        ]}
        pointerEvents="box-none"
      >
        {/* Search row */}
        <View style={styles.searchRow} pointerEvents="auto">
          <Ionicons name="search" size={16} color="rgba(255,255,255,0.55)" style={{ marginLeft: 12 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search videos..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={searchText}
            onChangeText={setSearchText}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')} style={{ marginRight: 10 }}>
              <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.55)" />
            </TouchableOpacity>
          )}
        </View>

        {/* Category pill row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 8 }}
          pointerEvents="auto"
          style={{ flexShrink: 0 }}
        >
          {FEED_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                style={[
                  styles.pill,
                  isSelected && styles.pillActive,
                ]}
                activeOpacity={0.75}
              >
                <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    width: SCREEN_W,
    height: SCREEN_H,
    backgroundColor: '#0F172A',
    overflow: 'hidden',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: SCREEN_H * 0.6,
  },
  rail: {
    position: 'absolute',
    right: 12,
    alignItems: 'center',
    gap: 20,
  },
  railItem: {
    alignItems: 'center',
    gap: 4,
  },
  railLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bottomInfo: {
    position: 'absolute',
    left: 16,
    right: 72,
    bottom: 0,
  },
  mosqueName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  videoTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  // Fix 2: filter bar styles
  filterBarWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    pointerEvents: 'box-none',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    height: 40,
    overflow: 'hidden',
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    paddingHorizontal: 8,
    paddingVertical: 0,
    height: '100%',
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  pillActive: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  pillText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  pillTextActive: {
    color: '#fff',
  },
})
