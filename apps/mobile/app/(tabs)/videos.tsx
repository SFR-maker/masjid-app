/**
 * Videos Tab — Bug 6 & 7 fix
 * Full-screen TikTok-style vertical FlatList with:
 *  - Dark immersive background
 *  - Right-side action rail (like, share, follow)
 *  - Bottom overlay with title, mosque name, category badge
 *  - Dark gradient overlay
 *  - AntDesign vector heart icon (not PNG)
 *  - Loading skeleton
 *  - Translucent status bar
 */

import { useState, useCallback, useRef } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, Dimensions,
  ActivityIndicator, StatusBar, StyleSheet, Share, Platform,
} from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { Image } from 'expo-image'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AntDesign, Ionicons, Feather } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { api } from '../../lib/api'
import { useTheme } from '../../contexts/ThemeContext'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')

// Category label colours (same as before)
const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  LECTURE:     { bg: 'rgba(109,40,217,0.75)', text: '#EDE9FE' },
  QURAN:       { bg: 'rgba(6,95,70,0.75)',   text: '#D1FAE5' },
  KHUTBAH:     { bg: 'rgba(29,78,216,0.75)', text: '#DBEAFE' },
  EDUCATIONAL: { bg: 'rgba(146,64,14,0.75)', text: '#FEF3C7' },
  DUA:         { bg: 'rgba(190,24,93,0.75)', text: '#FCE7F3' },
}

// ── Skeleton card while loading ───────────────────────────────────────────────
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

// ── Single full-screen video card ────────────────────────────────────────────
function VideoCard({ item, isVisible }: { item: any; isVisible: boolean }) {
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const videoRef = useRef<Video>(null)

  const catStyle = CATEGORY_COLORS[item.category] ?? { bg: 'rgba(75,85,99,0.75)', text: '#F3F4F6' }

  const likeMutation = useMutation({
    mutationFn: () => api.post(`/videos/${item.id}/like`, {}),
    onSuccess: (res: any) => {
      // Optimistic update on list
      queryClient.setQueryData(['videos-feed'], (old: any) => {
        if (!old) return old
        return {
          ...old,
          data: {
            ...old.data,
            items: (old.data?.items ?? []).map((v: any) =>
              v.id === item.id
                ? { ...v, userLiked: res?.data?.liked, likeCount: (v.likeCount ?? 0) + (res?.data?.liked ? 1 : -1) }
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
      {/* Video or Thumbnail */}
      {isVisible && item.streamUrl ? (
        <Video
          ref={videoRef}
          source={{ uri: item.streamUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.COVER}
          shouldPlay={isVisible}
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
        {/* Like */}
        <TouchableOpacity style={styles.railItem} onPress={() => likeMutation.mutate()}>
          <Ionicons
            name={item.userLiked ? 'heart' : 'heart-outline'}
            size={28}
            color={item.userLiked ? '#EF4444' : '#fff'}
          />
          <Text style={styles.railLabel}>{(item.likeCount ?? 0).toLocaleString()}</Text>
        </TouchableOpacity>

        {/* View count (eye) */}
        <View style={styles.railItem}>
          <Ionicons name="eye-outline" size={26} color="#fff" />
          <Text style={styles.railLabel}>{(item.viewCount ?? 0).toLocaleString()}</Text>
        </View>

        {/* Share */}
        <TouchableOpacity style={styles.railItem} onPress={handleShare}>
          <Feather name="share-2" size={24} color="#fff" />
          <Text style={styles.railLabel}>Share</Text>
        </TouchableOpacity>

        {/* Open full page */}
        <TouchableOpacity style={styles.railItem} onPress={() => router.push(`/video/${item.id}`)}>
          <Ionicons name="expand-outline" size={24} color="#fff" />
          <Text style={styles.railLabel}>More</Text>
        </TouchableOpacity>
      </View>

      {/* ── Bottom info overlay ── */}
      <View style={[styles.bottomInfo, { paddingBottom: insets.bottom + 70 }]}>
        {/* Mosque name */}
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

        {/* Title */}
        <Text style={styles.videoTitle} numberOfLines={2}>{item.title}</Text>

        {/* Category badge */}
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
  const [visibleIndex, setVisibleIndex] = useState(0)

  const { data, isLoading } = useQuery({
    queryKey: ['videos-feed'],
    queryFn: () => api.get('/videos?limit=20'),
    staleTime: 30_000,
  })

  const videos = data?.data?.items ?? []

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setVisibleIndex(viewableItems[0].index ?? 0)
    }
  }, [])

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 70 }).current

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <SkeletonCard />
      </View>
    )
  }

  if (videos.length === 0) {
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
          <VideoCard item={item} isVisible={index === visibleIndex} />
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
      />
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
})
