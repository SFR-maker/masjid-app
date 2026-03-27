import { useState, useRef, useEffect } from 'react'
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator,
  TextInput, TouchableOpacity, Platform, Alert, Share,
  FlatList, Animated, Dimensions, KeyboardAvoidingView,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { api } from '../../lib/api'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '@clerk/clerk-expo'

const SCREEN_HEIGHT = Dimensions.get('window').height
const VIDEO_FULL_HEIGHT = Math.round(SCREEN_HEIGHT * 0.38)
const VIDEO_COMPACT_HEIGHT = Math.round(SCREEN_HEIGHT * 0.28)
const PANEL_PEEK = 56    // handle + header row visible when closed
const PANEL_OPEN = Math.round(SCREEN_HEIGHT * 0.62)

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
function CommentItem({ comment, colors }: { comment: any; colors: any }) {
  const name = comment.user?.name ?? 'Anonymous'
  const initial = name.charAt(0).toUpperCase()
  const timeAgo = formatTimeAgo(new Date(comment.createdAt))

  return (
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
      </View>
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
  const { isSignedIn } = useAuth()

  const [commentsOpen, setCommentsOpen] = useState(false)
  const [sortBy, setSortBy] = useState<'top' | 'new'>('top')
  const [commentText, setCommentText] = useState('')
  const [commentError, setCommentError] = useState('')

  // Animation values
  const panelAnim = useRef(new Animated.Value(0)).current   // 0 = closed, 1 = open
  const videoAnim = useRef(new Animated.Value(0)).current   // 0 = full, 1 = compact

  const panelHeight = panelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [PANEL_PEEK, PANEL_OPEN],
  })
  const videoHeight = videoAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [VIDEO_FULL_HEIGHT, VIDEO_COMPACT_HEIGHT],
  })

  function openComments() {
    setCommentsOpen(true)
    Animated.spring(panelAnim, { toValue: 1, useNativeDriver: false, tension: 65, friction: 11 }).start()
    Animated.spring(videoAnim, { toValue: 1, useNativeDriver: false, tension: 65, friction: 11 }).start()
  }
  function closeComments() {
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

  function handlePostComment() {
    const trimmed = commentText.trim()
    if (trimmed.length < 2) { setCommentError('Comment must be at least 2 characters.'); return }
    if (containsBlockedContent(trimmed)) { setCommentError('Your comment contains inappropriate content.'); return }
    setCommentError('')
    commentMutation.mutate(trimmed)
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Back button */}
        <Pressable
          onPress={() => router.back()}
          style={{ position: 'absolute', top: 0, left: 0, zIndex: 10, flexDirection: 'row', alignItems: 'center', gap: 6, padding: 14 }}
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
        <View style={{ backgroundColor: colors.background, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <View style={{ backgroundColor: colors.primaryLight, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 }}>
              <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>{video.category}</Text>
            </View>
            {video.mosque && (
              <TouchableOpacity onPress={() => video.mosque?.id && router.push(`/mosque/${video.mosque.id}` as any)} activeOpacity={0.7}>
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>{video.mosque.name}</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 8 }} numberOfLines={2}>{video.title}</Text>

          {/* Action row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: colors.textTertiary, fontSize: 12, flex: 1 }}>{video.viewCount ?? 0} views</Text>
            <Pressable
              onPress={() => likeMutation.mutate()}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.surfaceSecondary, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 }}
            >
              <Ionicons name={video.userLiked ? 'heart' : 'heart-outline'} size={15} color={video.userLiked ? '#EF4444' : colors.textSecondary} />
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{video.likeCount ?? 0}</Text>
            </Pressable>
            <Pressable
              onPress={() => Share.share({ message: `${video.title} — ${video.mosque?.name ?? 'Mosque'}\n\nWatch on the Masjid app`, title: video.title }).catch(() => {})}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.surfaceSecondary, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 }}
            >
              <Ionicons name="share-outline" size={15} color={colors.textSecondary} />
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>Share</Text>
            </Pressable>
          </View>
        </View>

        {/* Comment panel — slides up */}
        <Animated.View
          style={{
            position: 'absolute',
            bottom: 0,
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
            overflow: 'hidden',
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
              renderItem={({ item }) => <CommentItem comment={item} colors={colors} />}
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
              paddingHorizontal: 12, paddingTop: 8,
              paddingBottom: Platform.OS === 'ios' ? 28 : 12,
            }}>
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
                    placeholder="Add a comment..."
                    placeholderTextColor={colors.textTertiary}
                    value={commentText}
                    onChangeText={(t) => { setCommentText(t); if (commentError) setCommentError('') }}
                    multiline
                    maxLength={1000}
                  />
                  <TouchableOpacity
                    onPress={handlePostComment}
                    disabled={commentMutation.isPending || commentText.trim().length < 2}
                    style={{
                      width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: commentMutation.isPending || commentText.trim().length < 2 ? colors.border : colors.primary,
                    }}
                    activeOpacity={0.8}
                  >
                    {commentMutation.isPending
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
