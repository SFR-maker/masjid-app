/**
 * Videos Tab — full-screen TikTok-style feed
 *  - Autoplay: imperative play/pause via useEffect (reliable across all expo-av versions)
 *  - Header: category tabs on one line + expandable search
 *  - Like: animated heart with optimistic update
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, Dimensions,
  StatusBar, StyleSheet, Share, TextInput, ScrollView,
  Animated, Keyboard, Modal, KeyboardAvoidingView, Platform,
  ActivityIndicator,
} from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { Image } from 'expo-image'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons, Feather } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { router, useFocusEffect } from 'expo-router'
import { useAuth } from '@clerk/clerk-expo'
import { api } from '../../lib/api'
import { PersonalizationOptInModal, usePersonalizationState } from '../../components/PersonalizationOptIn'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  LECTURE:     { bg: 'rgba(109,40,217,0.75)',  text: '#EDE9FE' },
  QURAN:       { bg: 'rgba(6,95,70,0.75)',      text: '#D1FAE5' },
  KHUTBAH:     { bg: 'rgba(29,78,216,0.75)',    text: '#DBEAFE' },
  EDUCATIONAL: { bg: 'rgba(146,64,14,0.75)',    text: '#FEF3C7' },
  DUA:         { bg: 'rgba(190,24,93,0.75)',    text: '#FCE7F3' },
  NASHEED:     { bg: 'rgba(234,88,12,0.75)',    text: '#FFEDD5' },
  EVENT:       { bg: 'rgba(15,118,110,0.75)',   text: '#CCFBF1' },
}

const FEED_CATEGORIES = ['All', 'Khutbah', 'Lecture', 'Quran', 'Nasheed', 'Kids', 'Events']

const CATEGORY_MAP: Record<string, string> = {
  All: '',
  Khutbah: 'KHUTBAH',
  Lecture: 'LECTURE',
  Quran: 'QURAN',
  Nasheed: 'NASHEED',
  Kids: 'EDUCATIONAL',
  Events: 'EVENT',
}

// ── Animated like button ──────────────────────────────────────────────────────
function LikeButton({ liked, count, onPress }: { liked: boolean; count: number; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current

  function handlePress() {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.35, useNativeDriver: true, speed: 50, bounciness: 12 }),
      Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 40, bounciness: 6 }),
    ]).start()
    onPress()
  }

  return (
    <TouchableOpacity style={styles.railItem} onPress={handlePress} activeOpacity={0.7}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name={liked ? 'heart' : 'heart-outline'} size={30} color={liked ? '#FF3B5C' : '#fff'} />
      </Animated.View>
      <Text style={styles.railLabel}>{(count ?? 0).toLocaleString()}</Text>
    </TouchableOpacity>
  )
}

// ── Single full-screen video card ─────────────────────────────────────────────
function VideoCard({ item, isActive, isScreenFocused }: { item: any; isActive: boolean; isScreenFocused: boolean }) {
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const { isSignedIn } = useAuth()
  const videoRef = useRef<Video>(null)
  const [manuallyPaused, setManuallyPaused] = useState(false)
  const shouldPlay = isActive && isScreenFocused && !manuallyPaused
  const shouldPlayRef = useRef(shouldPlay)
  shouldPlayRef.current = shouldPlay
  const playStartRef = useRef<number | null>(null)
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')

  // Pause icon flash animation
  const pauseIconOpacity = useRef(new Animated.Value(0)).current
  function flashIcon() {
    pauseIconOpacity.stopAnimation()
    Animated.sequence([
      Animated.timing(pauseIconOpacity, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.delay(600),
      Animated.timing(pauseIconOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start()
  }

  function handleTap() {
    setManuallyPaused((p) => { flashIcon(); return !p })
  }

  // Reset manual pause when this card becomes inactive (e.g. swiped away)
  useEffect(() => {
    if (!isActive) setManuallyPaused(false)
  }, [isActive])

  // ── AUTOPLAY: imperative play/pause ────────────────────────────────────────
  useEffect(() => {
    if (!videoRef.current || !item.streamUrl) return
    if (shouldPlay) {
      playStartRef.current = Date.now()
      videoRef.current.playAsync().catch(() => {})
    } else {
      videoRef.current.pauseAsync().catch(() => {})
      if (playStartRef.current !== null) {
        const watchTime = Math.round((Date.now() - playStartRef.current) / 1000)
        playStartRef.current = null
        if (watchTime > 2) {
          api.post(`/videos/${item.id}/view`, { watchTime }).catch(() => {})
        }
      }
    }
  }, [shouldPlay, item.streamUrl, item.id])

  function handleReadyForDisplay() {
    if (shouldPlayRef.current && videoRef.current) {
      playStartRef.current = Date.now()
      videoRef.current.playAsync().catch(() => {})
    }
  }

  const { data: commentsData, isLoading: commentsLoading } = useQuery({
    queryKey: ['video-comments', item.id],
    queryFn: () => api.get(`/videos/${item.id}/comments`),
    enabled: showComments,
    staleTime: 30_000,
  })
  const comments: any[] = commentsData?.data?.items ?? []

  const postComment = useMutation({
    mutationFn: () => api.post(`/videos/${item.id}/comments`, { text: commentText.trim() }),
    onSuccess: () => {
      setCommentText('')
      queryClient.invalidateQueries({ queryKey: ['video-comments', item.id] })
    },
  })

  const catStyle = CATEGORY_COLORS[item.category] ?? { bg: 'rgba(75,85,99,0.75)', text: '#F3F4F6' }

  const likeMutation = useMutation({
    mutationFn: () => api.post(`/videos/${item.id}/like`, {}),
    onMutate: () => {
      queryClient.setQueryData(['videos-feed'], (old: any) => {
        if (!old) return old
        return {
          ...old,
          data: {
            ...old.data,
            items: (old.data?.items ?? []).map((v: any) =>
              v.id === item.id
                ? { ...v, userLiked: !v.userLiked, likeCount: (v.likeCount ?? 0) + (v.userLiked ? -1 : 1) }
                : v
            ),
          },
        }
      })
    },
    onError: () => {
      queryClient.setQueryData(['videos-feed'], (old: any) => {
        if (!old) return old
        return {
          ...old,
          data: {
            ...old.data,
            items: (old.data?.items ?? []).map((v: any) =>
              v.id === item.id
                ? { ...v, userLiked: !v.userLiked, likeCount: (v.likeCount ?? 0) + (v.userLiked ? -1 : 1) }
                : v
            ),
          },
        }
      })
    },
  })

  async function handleShare() {
    try {
      await Share.share({ message: `${item.title} — ${item.mosque?.name ?? 'Mosque'}\n\nWatch on the Masjid app`, title: item.title })
    } catch {}
  }

  return (
    <View style={styles.card}>
      {/* Always render Video so ref is stable; play/pause imperatively */}
      {item.streamUrl ? (
        <Video
          ref={videoRef}
          source={{ uri: item.streamUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.COVER}
          isLooping
          isMuted={false}
          shouldPlay={false}
          onReadyForDisplay={handleReadyForDisplay}
        />
      ) : (
        <Image
          source={{ uri: item.thumbnailUrl ?? 'https://placehold.co/414x896/0F172A/1E293B?text=+' }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      )}

      {/* Tap-to-pause/resume overlay */}
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={handleTap}
      />

      {/* Pause/play icon flash */}
      <Animated.View
        style={[styles.pauseIconWrap, { opacity: pauseIconOpacity }]}
        pointerEvents="none"
      >
        <Ionicons
          name={manuallyPaused ? 'pause-circle' : 'play-circle'}
          size={72}
          color="rgba(255,255,255,0.88)"
        />
      </Animated.View>

      {/* Persistent pause indicator in corner */}
      {manuallyPaused && (
        <View style={styles.pausedBadge} pointerEvents="none">
          <Ionicons name="pause" size={12} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>Paused</Text>
        </View>
      )}

      {/* Gradient */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.88)']}
        style={styles.gradient}
        pointerEvents="none"
      />

      {/* Right action rail */}
      <View style={[styles.rail, { bottom: insets.bottom + 90 }]}>
        <LikeButton liked={item.userLiked} count={item.likeCount ?? 0} onPress={() => likeMutation.mutate()} />

        <View style={styles.railItem}>
          <Ionicons name="eye-outline" size={26} color="#fff" />
          <Text style={styles.railLabel}>{(item.viewCount ?? 0).toLocaleString()}</Text>
        </View>

        <TouchableOpacity style={styles.railItem} onPress={handleShare}>
          <Feather name="share-2" size={24} color="#fff" />
          <Text style={styles.railLabel}>Share</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.railItem} onPress={() => setShowComments(true)}>
          <Ionicons name="chatbubble-outline" size={24} color="#fff" />
          <Text style={styles.railLabel}>Comments</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom info */}
      <View style={[styles.bottomInfo, { paddingBottom: insets.bottom + 80 }]}>
        <TouchableOpacity
          onPress={() => item.mosque?.id && router.push(`/mosque/${item.mosque.id}`)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}
        >
          {item.mosque?.logoUrl ? (
            <Image
              source={{ uri: item.mosque.logoUrl }}
              style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)' }}
              contentFit="cover"
            />
          ) : (
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 14 }}>🕌</Text>
            </View>
          )}
          <Text style={styles.mosqueName}>{item.mosque?.name ?? 'Mosque'}</Text>
        </TouchableOpacity>

        <Text style={styles.videoTitle} numberOfLines={2}>{item.title}</Text>

        {item.category && (
          <View style={[styles.categoryBadge, { backgroundColor: catStyle.bg }]}>
            <Text style={{ color: catStyle.text, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 }}>
              {item.category.replace('_', ' ')}
            </Text>
          </View>
        )}
      </View>

      {/* Comments bottom sheet */}
      <Modal visible={showComments} transparent animationType="slide" onRequestClose={() => setShowComments(false)} statusBarTranslucent>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => { Keyboard.dismiss(); setShowComments(false) }} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={{ backgroundColor: '#1A1A1A', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: SCREEN_H * 0.72, paddingBottom: insets.bottom + 8 }}>
            {/* Handle */}
            <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' }} />
            </View>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16, paddingHorizontal: 20, paddingBottom: 12 }}>
              Comments {comments.length > 0 ? `(${comments.length})` : ''}
            </Text>
            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />

            <ScrollView style={{ maxHeight: SCREEN_H * 0.52 }} contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
              {commentsLoading ? (
                <ActivityIndicator color="#fff" style={{ marginTop: 20 }} />
              ) : comments.length === 0 ? (
                <Text style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 24, fontSize: 14 }}>
                  No comments yet. Be the first!
                </Text>
              ) : (
                comments.map((c: any) => (
                  <View key={c.id} style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                      {c.user?.avatarUrl
                        ? <Image source={{ uri: c.user.avatarUrl }} style={{ width: 32, height: 32, borderRadius: 16 }} contentFit="cover" />
                        : <Text style={{ fontSize: 13 }}>👤</Text>
                      }
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600', marginBottom: 2 }}>{c.user?.name ?? 'Anonymous'}</Text>
                      <Text style={{ color: '#fff', fontSize: 14, lineHeight: 20 }}>{c.text}</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            {isSignedIn && (
              <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }}>
                <TextInput
                  style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', color: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 }}
                  placeholder="Add a comment..."
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  value={commentText}
                  onChangeText={setCommentText}
                  maxLength={1000}
                />
                <TouchableOpacity
                  onPress={() => postComment.mutate()}
                  disabled={postComment.isPending || commentText.trim().length < 2}
                  style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: commentText.trim().length >= 2 ? '#3B82F6' : 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}
                >
                  {postComment.isPending
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name="send" size={16} color="#fff" />
                  }
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

// ── Header: category tabs + expandable search ─────────────────────────────────
function VideoHeader({
  selectedCategory,
  onSelectCategory,
  onSearch,
}: {
  selectedCategory: string
  onSelectCategory: (c: string) => void
  onSearch: (q: string) => void
}) {
  const insets = useSafeAreaInsets()
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const searchAnim = useRef(new Animated.Value(0)).current
  const inputRef = useRef<TextInput>(null)

  function openSearch() {
    setSearchOpen(true)
    Animated.spring(searchAnim, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 0 }).start(() => {
      inputRef.current?.focus()
    })
  }

  function closeSearch() {
    Keyboard.dismiss()
    setSearchText('')
    onSearch('')
    setSearchOpen(false)
    Animated.spring(searchAnim, { toValue: 0, useNativeDriver: true, speed: 30, bounciness: 0 }).start()
  }

  function submitSearch() {
    Keyboard.dismiss()
    onSearch(searchText)
  }

  const searchTranslate = searchAnim.interpolate({ inputRange: [0, 1], outputRange: [-48, 0] })
  const searchOpacity = searchAnim

  return (
    <View style={[styles.header, { paddingTop: insets.top }]} pointerEvents="box-none">

      {/* ── Row 1: category tabs ── */}
      <View style={styles.tabRow} pointerEvents="auto">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScroll}
        >
          {FEED_CATEGORIES.map((cat) => {
            const active = selectedCategory === cat
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => onSelectCategory(cat)}
                style={[styles.tab, active && styles.tabActive]}
                activeOpacity={0.75}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{cat}</Text>
                {active && <View style={styles.tabUnderline} />}
              </TouchableOpacity>
            )
          })}
        </ScrollView>

        {/* Search icon button */}
        <TouchableOpacity onPress={openSearch} style={styles.searchIconBtn} pointerEvents="auto">
          <Ionicons name="search" size={20} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>
      </View>

      {/* ── Row 2: expandable search bar (slides in below tabs) ── */}
      <Animated.View
        style={[
          styles.searchBarRow,
          { opacity: searchOpacity, transform: [{ translateY: searchTranslate }] },
        ]}
        pointerEvents={searchOpen ? 'auto' : 'none'}
      >
        <View style={styles.searchInputWrap}>
          <Ionicons name="search" size={15} color="rgba(255,255,255,0.45)" style={{ marginLeft: 12 }} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Search lectures, khutbah..."
            placeholderTextColor="rgba(255,255,255,0.35)"
            value={searchText}
            onChangeText={setSearchText}
            returnKeyType="search"
            onSubmitEditing={submitSearch}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchText(''); onSearch('') }} style={{ paddingRight: 8 }}>
              <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.45)" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={closeSearch} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </Animated.View>

    </View>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function VideosScreen() {
  const [visibleIndex, setVisibleIndex] = useState(0)
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [searchText, setSearchText] = useState('')
  const [isScreenFocused, setIsScreenFocused] = useState(true)
  const { isSignedIn } = useAuth()
  const { state: personalizationState, loading: personalizationLoading, accept, decline } = usePersonalizationState()
  const [showOptIn, setShowOptIn] = useState(false)

  // Pause video when navigating away from this tab
  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true)
      return () => setIsScreenFocused(false)
    }, [])
  )

  // Show opt-in prompt once for signed-in users whose preference is unknown
  useEffect(() => {
    if (isSignedIn && !personalizationLoading && personalizationState === 'unknown') {
      const timer = setTimeout(() => setShowOptIn(true), 2000)
      return () => clearTimeout(timer)
    }
  }, [isSignedIn, personalizationLoading, personalizationState])

  const personalize = personalizationState === 'accepted'

  // Reset to top whenever the displayed list changes so a card is always active
  useEffect(() => {
    setVisibleIndex(0)
  }, [selectedCategory, searchText])

  const { data, isLoading } = useQuery({
    queryKey: ['videos-feed', personalize],
    queryFn: () => api.get(`/videos?limit=40${personalize ? '&personalize=1' : ''}`),
    staleTime: 30_000,
  })

  const allVideos: any[] = data?.data?.items ?? []

  const videos = allVideos.filter((v) => {
    const catFilter = CATEGORY_MAP[selectedCategory]
    const matchesCategory = !catFilter || v.category === catFilter
    const matchesSearch =
      !searchText.trim() ||
      v.title?.toLowerCase().includes(searchText.toLowerCase()) ||
      v.description?.toLowerCase().includes(searchText.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const idx = viewableItems[0].index ?? 0
      setVisibleIndex(idx)
      // Track video view (fire-and-forget)
      const video = videos[idx]
      if (video?.id) api.post(`/videos/${video.id}/view`, {}).catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videos])

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <View style={[styles.card, { backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' }]}>
          <Ionicons name="play-circle-outline" size={56} color="rgba(255,255,255,0.15)" />
        </View>
      </View>
    )
  }

  if (allVideos.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <Ionicons name="play-circle-outline" size={64} color="rgba(255,255,255,0.25)" />
        <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 17, fontWeight: '700', marginTop: 16 }}>No videos yet</Text>
        <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 6, textAlign: 'center', paddingHorizontal: 40 }}>
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
          <VideoCard item={item} isActive={index === visibleIndex} isScreenFocused={isScreenFocused} />
        )}
        ListEmptyComponent={
          <View style={{ width: SCREEN_W, height: SCREEN_H, justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="search-outline" size={52} color="rgba(255,255,255,0.2)" />
            <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 17, fontWeight: '700', marginTop: 16 }}>No videos found</Text>
            <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 6, textAlign: 'center', paddingHorizontal: 40 }}>
              {searchText.trim() ? `No results for "${searchText}"` : `No ${selectedCategory} videos yet`}
            </Text>
          </View>
        }
        pagingEnabled
        snapToInterval={SCREEN_H}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        removeClippedSubviews={false}
        windowSize={3}
        initialNumToRender={2}
        maxToRenderPerBatch={3}
        getItemLayout={(_data, index) => ({ length: SCREEN_H, offset: SCREEN_H * index, index })}
      />

      {/* Floating header */}
      <VideoHeader
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        onSearch={setSearchText}
      />

      {/* Personalization opt-in */}
      <PersonalizationOptInModal
        visible={showOptIn}
        onAccept={() => { accept(); setShowOptIn(false) }}
        onDecline={() => { decline(); setShowOptIn(false) }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    width: SCREEN_W,
    height: SCREEN_H,
    backgroundColor: '#0A0A0A',
    overflow: 'hidden',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: SCREEN_H * 0.65,
  },
  rail: {
    position: 'absolute',
    right: 14,
    alignItems: 'center',
    gap: 22,
  },
  railItem: {
    alignItems: 'center',
    gap: 5,
  },
  railLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bottomInfo: {
    position: 'absolute',
    left: 16,
    right: 76,
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
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
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
  pauseIconWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pausedBadge: {
    position: 'absolute',
    top: 60,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    pointerEvents: 'box-none',
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 2,
    // subtle dark gradient so tabs are legible over video
    backgroundColor: 'transparent',
  },
  tabScroll: {
    paddingHorizontal: 12,
    gap: 4,
    alignItems: 'center',
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    position: 'relative',
  },
  tabActive: {},
  tabText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '800',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 2,
    left: 14,
    right: 14,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#22C55E',
  },
  searchIconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },

  // ── Expandable search bar ───────────────────────────────────────────────────
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    height: 40,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    paddingHorizontal: 8,
    height: '100%',
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  cancelText: {
    color: '#22C55E',
    fontSize: 14,
    fontWeight: '600',
  },
})
