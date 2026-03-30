import { useState, useRef, useEffect } from 'react'
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator,
  TextInput, TouchableOpacity, Platform, Alert, Share,
  FlatList, Animated, useWindowDimensions, Keyboard, AppState,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Video, ResizeMode, AVPlaybackStatus, Audio } from 'expo-av'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { api } from '../../lib/api'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '@clerk/clerk-expo'

const PANEL_PEEK = 56    // handle + header row visible when closed

// ── Moderation ───────────────────────────────────────────────────────────────
const BLOCKED_TERMS = [
  'fuck', 'shit', 'bitch', 'ass', 'bastard', 'cunt', 'dick', 'pussy',
  'whore', 'slut', 'faggot', 'nigger', 'nigga', 'chink', 'spic', 'kike',
  'retard', 'tranny', 'dyke', 'cracker', 'wetback', 'towelhead', 'raghead',
]
function containsBlockedContent(text: string): boolean {
  const normalized = text.toLowerCase().replace(/[^a-z0-9]/g, ' ')
  return BLOCKED_TERMS.some((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(^|\\s)${escaped}(\\s|$)`).test(normalized)
  })
}

function formatTimeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

// ── Comment row ───────────────────────────────────────────────────────────────
function CommentItem({ comment, colors, currentUserId, onDelete, onLike, onReply }: {
  comment: any; colors: any; currentUserId?: string | null
  onDelete?: (id: string) => void
  onLike?: (id: string, liked: boolean) => void
  onReply?: (comment: any) => void
}) {
  const name = comment.user?.name ?? 'Anonymous'
  const initial = name.charAt(0).toUpperCase()
  const timeAgo = formatTimeAgo(new Date(comment.createdAt))
  const isOwn = currentUserId && comment.user?.id === currentUserId
  const [showReplies, setShowReplies] = useState(false)
  const [replies, setReplies] = useState<any[]>([])
  const [loadingReplies, setLoadingReplies] = useState(false)

  async function loadReplies() {
    if (loadingReplies) return
    setLoadingReplies(true)
    try {
      const res = await api.get<any>(`/videos/${comment.videoId}/comments/${comment.id}/replies`)
      setReplies(res?.data?.items ?? [])
      setShowReplies(true)
    } catch {}
    setLoadingReplies(false)
  }

  function toggleReplies() {
    if (showReplies) { setShowReplies(false); return }
    loadReplies()
  }

  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 10 }}>
        {comment.user?.avatarUrl ? (
          <Image source={{ uri: comment.user.avatarUrl }} style={{ width: 36, height: 36, borderRadius: 18 }} contentFit="cover" />
        ) : (
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: colors.primaryContrast, fontSize: 13, fontWeight: '700' }}>{initial}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>{name}</Text>
            <Text style={{ color: colors.textTertiary, fontSize: 11 }}>{timeAgo}</Text>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20 }}>{comment.text}</Text>
          {/* Action row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 6 }}>
            <TouchableOpacity
              onPress={() => onLike?.(comment.id, comment.userLiked)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name={comment.userLiked ? 'heart' : 'heart-outline'} size={14} color={comment.userLiked ? '#EF4444' : colors.textTertiary} />
              {(comment.likeCount ?? 0) > 0 && (
                <Text style={{ fontSize: 12, color: comment.userLiked ? '#EF4444' : colors.textTertiary }}>{comment.likeCount}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onReply?.(comment)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chatbubble-outline" size={13} color={colors.textTertiary} />
              <Text style={{ fontSize: 12, color: colors.textTertiary }}>Reply</Text>
            </TouchableOpacity>
            {(comment.replyCount ?? 0) > 0 && (
              <TouchableOpacity onPress={toggleReplies} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {loadingReplies ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Ionicons name={showReplies ? 'chevron-up' : 'chevron-down'} size={12} color={colors.primary} />
                    <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>
                      {showReplies ? 'Hide' : `${comment.replyCount} ${comment.replyCount === 1 ? 'reply' : 'replies'}`}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
        {isOwn && onDelete && (
          <TouchableOpacity
            onPress={() => Alert.alert('Delete comment', 'Remove this comment?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => onDelete(comment.id) },
            ])}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ justifyContent: 'center', paddingLeft: 4 }}
          >
            <Ionicons name="trash-outline" size={15} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>
      {/* Replies */}
      {showReplies && replies.map((r) => (
        <View key={r.id} style={{ flexDirection: 'row', gap: 8, paddingLeft: 62, paddingRight: 16, paddingVertical: 6 }}>
          {r.user?.avatarUrl ? (
            <Image source={{ uri: r.user.avatarUrl }} style={{ width: 28, height: 28, borderRadius: 14 }} contentFit="cover" />
          ) : (
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>{(r.user?.name ?? '?')[0].toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>{r.user?.name ?? 'Anonymous'}</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 10 }}>{formatTimeAgo(new Date(r.createdAt))}</Text>
              {r.userId === currentUserId && (
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert('Delete reply', 'Remove this reply?', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete', style: 'destructive', onPress: async () => {
                          setReplies((prev) => prev.filter((x) => x.id !== r.id))
                          try {
                            await api.delete(`/videos/${comment.videoId}/comments/${comment.id}/replies/${r.id}`)
                          } catch { /* optimistic removal already applied */ }
                        },
                      },
                    ])
                  }}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  style={{ marginLeft: 'auto' }}
                >
                  <Ionicons name="trash-outline" size={12} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>{r.text}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function VideoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const videoRef = useRef<Video>(null)
  const [status, setStatus] = useState<AVPlaybackStatus | null>(null)
  const { colors } = useTheme()
  const { isSignedIn, userId: currentUserId } = useAuth()
  const { height: screenHeight } = useWindowDimensions()
  const VIDEO_FULL_HEIGHT = Math.round(screenHeight * 0.38)
  const VIDEO_COMPACT_HEIGHT = Math.round(screenHeight * 0.28)
  const PANEL_OPEN = Math.round(screenHeight * 0.62)

  const [commentsOpen, setCommentsOpen] = useState(false)
  const [sortBy, setSortBy] = useState<'top' | 'new'>('top')
  const [commentText, setCommentText] = useState('')
  const [commentError, setCommentError] = useState('')
  const [replyingTo, setReplyingTo] = useState<{ id: string; videoId: string; userName: string } | null>(null)

  // Animation values
  const panelAnim = useRef(new Animated.Value(0)).current   // 0 = closed, 1 = open
  const videoAnim = useRef(new Animated.Value(0)).current   // 0 = full, 1 = compact
  const keyboardShift = useRef(new Animated.Value(0)).current

  const panelHeight = panelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [PANEL_PEEK, PANEL_OPEN],
  })
  const videoHeight = videoAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [VIDEO_FULL_HEIGHT, VIDEO_COMPACT_HEIGHT],
  })
  // Lift panel up when keyboard opens so input stays above keyboard
  const panelBottom = keyboardShift.interpolate({ inputRange: [0, 1], outputRange: [0, 1] })

  // Configure audio session so video plays over silent mode and resumes after calls
  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      allowsRecordingIOS: false,
    }).catch(() => {})

    // Resume playback when app comes back to foreground after a call interruption
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && videoRef.current) {
        videoRef.current.getStatusAsync().then((s) => {
          if (s.isLoaded && !s.isPlaying && !s.didJustFinish) {
            videoRef.current?.playAsync().catch(() => {})
          }
        }).catch(() => {})
      }
    })
    return () => sub.remove()
  }, [])

  // Keyboard listeners — lift the panel on Android (iOS handled by SafeAreaView)
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => Animated.timing(keyboardShift, { toValue: e.endCoordinates.height, duration: Platform.OS === 'ios' ? e.duration : 220, useNativeDriver: false }).start()
    )
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      (e) => Animated.timing(keyboardShift, { toValue: 0, duration: Platform.OS === 'ios' ? e.duration : 180, useNativeDriver: false }).start()
    )
    return () => { show.remove(); hide.remove() }
  }, [keyboardShift])

  function openComments() {
    setCommentsOpen(true)
    Animated.spring(panelAnim, { toValue: 1, useNativeDriver: false, tension: 65, friction: 11 }).start()
    Animated.spring(videoAnim, { toValue: 1, useNativeDriver: false, tension: 65, friction: 11 }).start()
  }
  function closeComments() {
    Keyboard.dismiss()
    Animated.spring(panelAnim, { toValue: 0, useNativeDriver: false, tension: 65, friction: 11 }).start(() => setCommentsOpen(false))
    Animated.spring(videoAnim, { toValue: 0, useNativeDriver: false, tension: 65, friction: 11 }).start()
  }

  const { data, isLoading } = useQuery({
    queryKey: ['video', id],
    queryFn: () => api.get<any>(`/videos/${id}`),
  })

  const { data: commentsData, isLoading: commentsLoading } = useQuery({
    queryKey: ['video-comments', id],
    queryFn: () => api.get(`/videos/${id}/comments?limit=50`),
    enabled: !!id,
  })

  const likeMutation = useMutation({
    mutationFn: () => api.post(`/videos/${id}/like`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['video', id] }),
  })

  const commentMutation = useMutation({
    mutationFn: (text: string) => api.post(`/videos/${id}/comments`, { text }),
    onSuccess: (res: any) => {
      queryClient.setQueryData(['video-comments', id], (old: any) => {
        if (!old) return old
        return { ...old, data: { ...old.data, items: [...(old.data?.items ?? []), res?.data] } }
      })
      setCommentText('')
      setCommentError('')
    },
    onError: () => setCommentError('Failed to post. Please try again.'),
  })

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => api.delete(`/videos/${id}/comments/${commentId}`),
    onMutate: (commentId: string) => {
      queryClient.setQueryData(['video-comments', id], (old: any) => {
        if (!old) return old
        return { ...old, data: { ...old.data, items: (old.data?.items ?? []).filter((c: any) => c.id !== commentId) } }
      })
    },
    onError: () => queryClient.invalidateQueries({ queryKey: ['video-comments', id] }),
  })

  const likeCommentMutation = useMutation({
    mutationFn: ({ commentId }: { commentId: string; liked: boolean }) =>
      api.post(`/videos/${id}/comments/${commentId}/like`, {}),
    onMutate: ({ commentId, liked }) => {
      queryClient.setQueryData(['video-comments', id], (old: any) => {
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
    onError: () => queryClient.invalidateQueries({ queryKey: ['video-comments', id] }),
  })

  const replyMutation = useMutation({
    mutationFn: ({ commentId, text }: { commentId: string; text: string }) =>
      api.post(`/videos/${id}/comments/${commentId}/replies`, { text }),
    onSuccess: () => {
      setCommentText('')
      setReplyingTo(null)
      queryClient.invalidateQueries({ queryKey: ['video-comments', id] })
    },
    onError: () => setCommentError('Failed to post reply. Please try again.'),
  })

  function handlePostComment() {
    const trimmed = commentText.trim()
    if (trimmed.length < 1) { setCommentError('Comment cannot be empty.'); return }
    if (containsBlockedContent(trimmed)) { setCommentError('Your comment contains inappropriate content.'); return }
    setCommentError('')
    if (replyingTo) {
      replyMutation.mutate({ commentId: replyingTo.id, text: trimmed })
    } else {
      if (trimmed.length < 2) { setCommentError('Comment must be at least 2 characters.'); return }
      commentMutation.mutate(trimmed)
    }
  }

  const video = data?.data
  const rawComments: any[] = commentsData?.data?.items ?? []
  const comments = sortBy === 'top'
    ? [...rawComments].sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0))
    : [...rawComments].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }
  if (!video) return null

  const actionBtnBg = colors.isDark ? '#1E293B' : '#F3F4F6'

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }} edges={['top']}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Back button with pill background */}
        <Pressable
          onPress={() => router.back()}
          style={{
            position: 'absolute', top: 12, left: 14, zIndex: 10,
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: 'rgba(0,0,0,0.45)',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </Pressable>

        {/* Video player — height animates when comments open */}
        <Animated.View style={{ width: '100%', height: videoHeight, backgroundColor: '#000' }}>
          {video.streamUrl ? (
            <Video
              ref={videoRef}
              source={{ uri: video.streamUrl }}
              style={{ width: '100%', height: '100%' }}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls
              onPlaybackStatusUpdate={(s) => setStatus(s)}
            />
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fff' }}>
                {video.status === 'PROCESSING' ? 'Video is processing...' : 'No video available'}
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Info strip — always visible above the panel */}
        <View style={{
          backgroundColor: colors.surface,
          paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12,
          borderBottomWidth: 1, borderBottomColor: colors.border,
        }}>
          {/* Mosque row */}
          <TouchableOpacity
            onPress={() => video.mosque?.id && router.push(`/mosque/${video.mosque.id}` as any)}
            activeOpacity={0.7}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}
          >
            {video.mosque?.logoUrl ? (
              <Image
                source={{ uri: video.mosque.logoUrl }}
                style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.border }}
                contentFit="cover"
              />
            ) : (
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 16 }}>🕌</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700', letterSpacing: -0.1 }}>
                {video.mosque?.name ?? 'Mosque'}
              </Text>
              <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 1 }}>View profile →</Text>
            </View>
            <View style={{ backgroundColor: colors.primaryLight, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 }}>
              <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700', letterSpacing: 0.2 }}>
                {(video.category ?? 'VIDEO').replace('_', ' ')}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Title */}
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800', lineHeight: 23, letterSpacing: -0.3, marginBottom: 4 }} numberOfLines={3}>
            {video.title}
          </Text>

          {/* Description */}
          {video.description ? (
            <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 10 }} numberOfLines={3}>
              {video.description}
            </Text>
          ) : <View style={{ height: 8 }} />}

          {/* Stats + actions */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
              <Ionicons name="eye-outline" size={13} color={colors.textTertiary} />
              <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                {(video.viewCount ?? 0).toLocaleString()} views
              </Text>
            </View>
            <Pressable
              onPress={() => {
                if (!isSignedIn) { Alert.alert('Sign in required', 'Sign in to like videos'); return }
                likeMutation.mutate()
              }}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 5,
                backgroundColor: video.userLiked ? '#FEE2E2' : actionBtnBg,
                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                borderWidth: video.userLiked ? 1 : 0, borderColor: '#FECACA',
              }}
            >
              <Ionicons name={video.userLiked ? 'heart' : 'heart-outline'} size={15} color={video.userLiked ? '#EF4444' : colors.textSecondary} />
              <Text style={{ color: video.userLiked ? '#EF4444' : colors.text, fontSize: 13, fontWeight: '600' }}>
                {video.likeCount ?? 0}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => Share.share({ message: `${video.title} — ${video.mosque?.name ?? 'Mosque'}\n\nWatch on Masjidly`, title: video.title }).catch(() => {})}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: actionBtnBg, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 }}
            >
              <Ionicons name="share-outline" size={15} color={colors.textSecondary} />
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>Share</Text>
            </Pressable>
          </View>
        </View>

        {/* Comment panel — slides up, lifts with keyboard */}
        <Animated.View
          style={{
            position: 'absolute',
            bottom: keyboardShift,
            left: 0,
            right: 0,
            height: panelHeight,
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            shadowColor: '#000',
            shadowOpacity: 0.18,
            shadowOffset: { width: 0, height: -4 },
            shadowRadius: 16,
            elevation: 12,
          }}
        >
          {/* Panel header */}
          <TouchableOpacity
            onPress={commentsOpen ? closeComments : openComments}
            activeOpacity={0.85}
            style={{
              alignItems: 'center',
              paddingTop: 10,
              paddingBottom: 10,
              borderBottomWidth: commentsOpen ? 1 : 0,
              borderBottomColor: colors.border,
            }}
          >
            {/* Drag handle pill */}
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)', marginBottom: 8 }} />

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, width: '100%', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="chatbubble-ellipses" size={16} color={colors.primary} />
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
                  {rawComments.length > 0 ? `${rawComments.length} Comments` : 'Comments'}
                </Text>
              </View>
              {commentsOpen ? (
                <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>View all</Text>
                  <Ionicons name="chevron-up" size={14} color={colors.primary} />
                </View>
              )}
            </View>
          </TouchableOpacity>

          {/* Sort toggles */}
          {commentsOpen && (
            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10 }}>
              {(['top', 'new'] as const).map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setSortBy(s)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20,
                    backgroundColor: sortBy === s ? colors.primary : colors.surfaceSecondary,
                  }}
                >
                  <Text style={{ color: sortBy === s ? colors.primaryContrast : colors.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' }}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Comment list */}
          {commentsOpen && (
            <FlatList
              data={comments}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <CommentItem
                  comment={{ ...item, videoId: id }}
                  colors={colors}
                  currentUserId={currentUserId}
                  onDelete={(commentId) => deleteCommentMutation.mutate(commentId)}
                  onLike={(commentId, liked) => likeCommentMutation.mutate({ commentId, liked })}
                  onReply={(c) => {
                    setReplyingTo({ id: c.id, videoId: id as string, userName: c.user?.name ?? 'Anonymous' })
                    setCommentsOpen(true)
                  }}
                />
              )}
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 100 }}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                commentsLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 24 }} />
                ) : (
                  <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                    <Ionicons name="chatbubble-outline" size={32} color={colors.textTertiary} />
                    <Text style={{ color: colors.textTertiary, marginTop: 8, fontSize: 14 }}>No comments yet. Be the first.</Text>
                  </View>
                )
              }
            />
          )}

          {/* Comment input */}
          {commentsOpen && (
            <View style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              backgroundColor: colors.surface,
              borderTopWidth: 1, borderTopColor: colors.border,
              paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12,
            }}>
              {replyingTo && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surfaceSecondary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 6 }}>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    Replying to <Text style={{ fontWeight: '700', color: colors.text }}>{replyingTo.userName}</Text>
                  </Text>
                  <TouchableOpacity onPress={() => setReplyingTo(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close" size={16} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              )}
              {commentError ? <Text style={{ color: '#EF4444', fontSize: 12, marginBottom: 4, paddingHorizontal: 4 }}>{commentError}</Text> : null}
              {isSignedIn ? (
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
                  <TextInput
                    style={{
                      flex: 1, borderWidth: 1, borderRadius: 20,
                      paddingHorizontal: 14, paddingVertical: 8,
                      fontSize: 14, maxHeight: 96, minHeight: 40,
                      backgroundColor: colors.inputBackground,
                      color: colors.text, borderColor: colors.border,
                    }}
                    placeholder={replyingTo ? `Reply to ${replyingTo.userName}...` : 'Add a comment...'}
                    placeholderTextColor={colors.textTertiary}
                    value={commentText}
                    onChangeText={(t) => { setCommentText(t); if (commentError) setCommentError('') }}
                    multiline
                    maxLength={1000}
                  />
                  <TouchableOpacity
                    onPress={handlePostComment}
                    disabled={(commentMutation.isPending || replyMutation.isPending) || commentText.trim().length < 1}
                    style={{
                      width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: (commentMutation.isPending || replyMutation.isPending) || commentText.trim().length < 1 ? colors.border : colors.primary,
                    }}
                    activeOpacity={0.8}
                  >
                    {(commentMutation.isPending || replyMutation.isPending)
                      ? <ActivityIndicator size="small" color={colors.primaryContrast} />
                      : <Ionicons name="send" size={16} color={colors.primaryContrast} />
                    }
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={{ color: colors.textSecondary, textAlign: 'center', fontSize: 14, paddingVertical: 6 }}>
                  Sign in to leave a comment
                </Text>
              )}
            </View>
          )}
        </Animated.View>
      </View>
    </SafeAreaView>
  )
}
