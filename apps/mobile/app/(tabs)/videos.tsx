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
  Animated, Keyboard, Platform, Modal, KeyboardAvoidingView,
  ActivityIndicator, PanResponder, Pressable,
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
import { useTranslation } from 'react-i18next'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
const PANEL_HEIGHT = Math.round(SCREEN_H * 0.58)

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

// ── Comment row with like + reply + expandable replies ───────────────────────
function CommentRow({ c, videoId, onLike, onReply }: {
  c: any; videoId: string
  onLike: (commentId: string, liked: boolean) => void
  onReply: (comment: any) => void
}) {
  const [repliesOpen, setRepliesOpen] = useState(false)
  const [replies, setReplies] = useState<any[]>([])
  const [loadingReplies, setLoadingReplies] = useState(false)

  async function loadReplies() {
    if (loadingReplies) return
    setLoadingReplies(true)
    try {
      const res = await api.get<any>(`/videos/${videoId}/comments/${c.id}/replies`)
      setReplies(res?.data?.items ?? [])
      setRepliesOpen(true)
    } catch {}
    setLoadingReplies(false)
  }

  function toggleReplies() {
    if (repliesOpen) { setRepliesOpen(false); return }
    loadReplies()
  }

  return (
    <View>
      <View style={styles.commentRow}>
        <View style={styles.commentAvatar}>
          {c.user?.avatarUrl
            ? <Image source={{ uri: c.user.avatarUrl }} style={{ width: 36, height: 36, borderRadius: 18 }} contentFit="cover" />
            : <Text style={{ fontSize: 16 }}>👤</Text>
          }
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.commentBubble}>
            <Text style={styles.commentUsername}>{c.user?.name ?? 'Anonymous'}</Text>
            <Text style={styles.commentText}>{c.text}</Text>
          </View>
          {/* Action row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 7, paddingLeft: 4 }}>
            <TouchableOpacity
              onPress={() => onLike(c.id, c.userLiked)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name={c.userLiked ? 'heart' : 'heart-outline'} size={13} color={c.userLiked ? '#FF3B5C' : 'rgba(255,255,255,0.4)'} />
              {(c.likeCount ?? 0) > 0 && (
                <Text style={{ fontSize: 11, color: c.userLiked ? '#FF3B5C' : 'rgba(255,255,255,0.4)', fontWeight: '600' }}>{c.likeCount}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onReply(c)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chatbubble-outline" size={12} color="rgba(255,255,255,0.4)" />
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Reply</Text>
            </TouchableOpacity>
            {(c.replyCount ?? 0) > 0 && (
              <TouchableOpacity
                onPress={toggleReplies}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {loadingReplies
                  ? <ActivityIndicator size="small" color="#22C55E" />
                  : <>
                      <Ionicons name={repliesOpen ? 'chevron-up' : 'chevron-down'} size={11} color="#22C55E" />
                      <Text style={{ fontSize: 11, color: '#22C55E', fontWeight: '600' }}>
                        {repliesOpen ? 'Hide' : `${c.replyCount} ${c.replyCount === 1 ? 'reply' : 'replies'}`}
                      </Text>
                    </>
                }
              </TouchableOpacity>
            )}
          </View>
          {/* Replies */}
          {repliesOpen && replies.map((r) => (
            <View key={r.id} style={{ flexDirection: 'row', gap: 8, paddingLeft: 8, marginTop: 10 }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {r.user?.avatarUrl
                  ? <Image source={{ uri: r.user.avatarUrl }} style={{ width: 26, height: 26, borderRadius: 13 }} contentFit="cover" />
                  : <Text style={{ fontSize: 12 }}>👤</Text>
                }
              </View>
              <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 11, paddingHorizontal: 10, paddingVertical: 7 }}>
                <Text style={{ color: '#22C55E', fontSize: 11, fontWeight: '700', marginBottom: 2 }}>{r.user?.name ?? 'Anonymous'}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.82)', fontSize: 13, lineHeight: 18 }}>{r.text}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}

// ── Single full-screen video card ─────────────────────────────────────────────
function VideoCard({ item, isActive, isScreenFocused, personalize }: { item: any; isActive: boolean; isScreenFocused: boolean; personalize: boolean }) {
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
  const [panelVisible, setPanelVisible] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [replyingTo, setReplyingTo] = useState<{ id: string; userName: string } | null>(null)
  const panelAnim = useRef(new Animated.Value(0)).current
  const backdropAnim = useRef(new Animated.Value(0)).current
  const panelTranslateY = panelAnim.interpolate({ inputRange: [0, 1], outputRange: [PANEL_HEIGHT, 0] })

  function openComments() {
    setPanelVisible(true)
    setShowComments(true)
    Animated.parallel([
      Animated.spring(panelAnim, { toValue: 1, useNativeDriver: true, tension: 70, friction: 12 }),
      Animated.timing(backdropAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start()
  }

  function closeComments() {
    Keyboard.dismiss()
    setReplyingTo(null)
    Animated.parallel([
      Animated.spring(panelAnim, { toValue: 0, useNativeDriver: true, tension: 70, friction: 12 }),
      Animated.timing(backdropAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setPanelVisible(false)
      setShowComments(false)
    })
  }

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
    mutationFn: () => replyingTo
      ? api.post(`/videos/${item.id}/comments/${replyingTo.id}/replies`, { text: commentText.trim() })
      : api.post(`/videos/${item.id}/comments`, { text: commentText.trim() }),
    onSuccess: () => {
      setCommentText('')
      setReplyingTo(null)
      queryClient.invalidateQueries({ queryKey: ['video-comments', item.id] })
    },
  })

  const likeCommentMutation = useMutation({
    mutationFn: ({ commentId }: { commentId: string; liked: boolean }) =>
      api.post(`/videos/${item.id}/comments/${commentId}/like`, {}),
    onMutate: ({ commentId, liked }) => {
      queryClient.setQueryData(['video-comments', item.id], (old: any) => {
        if (!old) return old
        return {
          ...old,
          data: {
            ...old.data,
            items: (old.data?.items ?? []).map((c: any) =>
              c.id === commentId
                ? { ...c, userLiked: !liked, likeCount: (c.likeCount ?? 0) + (liked ? -1 : 1) }
                : c
            ),
          },
        }
      })
    },
    onError: () => queryClient.invalidateQueries({ queryKey: ['video-comments', item.id] }),
  })

  const catStyle = CATEGORY_COLORS[item.category] ?? { bg: 'rgba(75,85,99,0.75)', text: '#F3F4F6' }

  const likeQueryKey = ['videos-feed', personalize]

  const likeMutation = useMutation({
    mutationFn: () => api.post(`/videos/${item.id}/like`, {}),
    onMutate: () => {
      queryClient.setQueryData(likeQueryKey, (old: any) => {
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
      queryClient.setQueryData(likeQueryKey, (old: any) => {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos-feed'] })
    },
  })

  async function handleShare() {
    try {
      await Share.share({ message: `${item.title} — ${item.mosque?.name ?? 'Mosque'}\n\nWatch on Masjidly`, title: item.title })
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

        <TouchableOpacity style={styles.railItem} onPress={openComments} activeOpacity={0.75}>
          <Ionicons name="chatbubble-ellipses-outline" size={28} color={panelVisible ? '#22C55E' : '#fff'} />
          <Text style={[styles.railLabel, panelVisible && { color: '#22C55E' }]}>
            {(showComments && comments.length > 0 ? comments.length : (item.commentCount ?? 0)).toLocaleString()}
          </Text>
        </TouchableOpacity>

        <View style={styles.railItem}>
          <Ionicons name="eye-outline" size={26} color="#fff" />
          <Text style={styles.railLabel}>{(item.viewCount ?? 0).toLocaleString()}</Text>
        </View>

        <TouchableOpacity style={styles.railItem} onPress={handleShare}>
          <Feather name="share-2" size={24} color="#fff" />
          <Text style={styles.railLabel}>Share</Text>
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

      {/* Comment sheet — Modal renders at root level, bypassing card overflow:hidden */}
      <Modal
        visible={panelVisible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeComments}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Backdrop */}
          <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.6)', opacity: backdropAnim }]}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={closeComments} />
          </Animated.View>

          {/* Push panel to bottom */}
          <View style={{ flex: 1 }} pointerEvents="none" />

          {/* Sliding panel */}
          <Animated.View style={[styles.commentPanel, { transform: [{ translateY: panelTranslateY }] }]}>
            {/* Handle */}
            <View style={styles.commentHandle} />

            {/* Header */}
            <View style={styles.commentHeader}>
              <Text style={styles.commentHeaderTitle}>
                {comments.length > 0 ? `${comments.length} Comments` : 'Comments'}
              </Text>
              <TouchableOpacity onPress={closeComments} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.commentCloseBtn}>
                <Ionicons name="close" size={18} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>
            <View style={styles.commentDivider} />

            {/* Comment list */}
            <ScrollView
              style={styles.commentScroll}
              contentContainerStyle={styles.commentList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {commentsLoading ? (
                <ActivityIndicator color="#22C55E" style={{ marginTop: 32 }} />
              ) : comments.length === 0 ? (
                <View style={styles.commentEmpty}>
                  <Ionicons name="chatbubble-outline" size={36} color="rgba(255,255,255,0.15)" />
                  <Text style={styles.commentEmptyText}>No comments yet</Text>
                  <Text style={styles.commentEmptySubtext}>Be the first to comment!</Text>
                </View>
              ) : (
                comments.map((c: any) => (
                  <CommentRow
                    key={c.id}
                    c={c}
                    videoId={item.id}
                    onLike={(commentId, liked) => likeCommentMutation.mutate({ commentId, liked })}
                    onReply={(comment) => {
                      setReplyingTo({ id: comment.id, userName: comment.user?.name ?? 'Anonymous' })
                      setCommentText('')
                    }}
                  />
                ))
              )}
            </ScrollView>

            {/* Input — in normal flow, KAV pushes it above keyboard */}
            <View style={[styles.commentInputRow, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              {isSignedIn ? (
                <>
                  {replyingTo && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 8, width: '100%' }}>
                      <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                        Replying to <Text style={{ fontWeight: '700', color: '#22C55E' }}>{replyingTo.userName}</Text>
                      </Text>
                      <TouchableOpacity onPress={() => setReplyingTo(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close" size={15} color="rgba(255,255,255,0.45)" />
                      </TouchableOpacity>
                    </View>
                  )}
                  <TextInput
                    style={styles.commentInput}
                    placeholder={replyingTo ? `Reply to ${replyingTo.userName}...` : 'Write a comment...'}
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={commentText}
                    onChangeText={setCommentText}
                    maxLength={1000}
                    multiline
                    returnKeyType="send"
                    blurOnSubmit={false}
                  />
                  <TouchableOpacity
                    onPress={() => postComment.mutate()}
                    disabled={postComment.isPending || commentText.trim().length < 2}
                    style={[styles.commentSendBtn, commentText.trim().length >= 2 && styles.commentSendBtnActive]}
                  >
                    {postComment.isPending
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Ionicons name="send" size={16} color="#fff" />
                    }
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, textAlign: 'center', flex: 1, paddingVertical: 4 }}>
                  Sign in to leave a comment
                </Text>
              )}
            </View>
          </Animated.View>
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
  const { t } = useTranslation()
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
            placeholder={t('videos_search')}
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

  // Ref so the PanResponder (created once) always reads the latest category
  const selectedCategoryRef = useRef(selectedCategory)
  useEffect(() => { selectedCategoryRef.current = selectedCategory }, [selectedCategory])

  const swipePan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) < 30) return
        const direction = g.dx < 0 ? 'left' : 'right'
        const currentIdx = FEED_CATEGORIES.indexOf(selectedCategoryRef.current)
        const nextIdx = direction === 'left'
          ? Math.min(currentIdx + 1, FEED_CATEGORIES.length - 1)
          : Math.max(currentIdx - 1, 0)
        if (nextIdx !== currentIdx) {
          setSelectedCategory(FEED_CATEGORIES[nextIdx])
        }
      },
    })
  ).current

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
    <View style={{ flex: 1, backgroundColor: '#000' }} {...swipePan.panHandlers}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <FlatList
        data={videos}
        keyExtractor={(v: any) => v.id}
        renderItem={({ item, index }) => (
          <VideoCard item={item} isActive={index === visibleIndex} isScreenFocused={isScreenFocused} personalize={personalize} />
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

  // ── Comment panel ───────────────────────────────────────────────────────────
  commentPanel: {
    backgroundColor: '#161618',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: PANEL_HEIGHT,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 24,
  },
  commentScroll: {
    maxHeight: PANEL_HEIGHT - 160,
  },
  commentHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 14,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  commentHeaderTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.1,
  },
  commentCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginHorizontal: 0,
  },
  commentList: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 16,
  },
  commentEmpty: {
    alignItems: 'center',
    paddingTop: 36,
    gap: 8,
  },
  commentEmptyText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
  },
  commentEmptySubtext: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 13,
  },
  commentRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  commentBubble: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  commentUsername: {
    color: '#22C55E',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 3,
    letterSpacing: 0.1,
  },
  commentText: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 14,
    lineHeight: 20,
  },
  commentInputRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  commentInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    color: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    maxHeight: 90,
  },
  commentSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentSendBtnActive: {
    backgroundColor: '#22C55E',
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
