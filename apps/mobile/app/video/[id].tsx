/**
 * Video detail / "More" screen
 * Fixes applied:
 *  - Fix 3: Comment section with client-side moderation
 *  - Fix 5: Full dark-mode support via ThemeContext
 */

import { useState, useRef } from 'react'
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator,
  TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, Share,
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

// ── Client-side comment moderation ──────────────────────────────────────────
const BLOCKED_TERMS = [
  'fuck', 'shit', 'bitch', 'ass', 'bastard', 'cunt', 'dick', 'pussy',
  'whore', 'slut', 'faggot', 'nigger', 'nigga', 'chink', 'spic', 'kike',
  'retard', 'tranny', 'dyke', 'cracker', 'wetback', 'towelhead', 'raghead',
]

function containsBlockedContent(text: string): boolean {
  const normalized = text.toLowerCase().replace(/[^a-z0-9]/g, ' ')
  return BLOCKED_TERMS.some((term) => {
    // Word-boundary check via surrounding spaces/start/end
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(^|\\s)${escaped}(\\s|$)`).test(normalized)
  })
}

// ── Comment item ─────────────────────────────────────────────────────────────
function CommentItem({ comment, colors }: { comment: any; colors: any }) {
  const name = comment.user?.name ?? 'Anonymous'
  const initial = name.charAt(0).toUpperCase()
  const date = new Date(comment.createdAt)
  const timeAgo = formatTimeAgo(date)

  return (
    <View style={[commentStyles.row, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
      {/* Avatar */}
      {comment.user?.avatarUrl ? (
        <Image
          source={{ uri: comment.user.avatarUrl }}
          style={commentStyles.avatar}
          contentFit="cover"
        />
      ) : (
        <View style={[commentStyles.avatarFallback, { backgroundColor: colors.primary }]}>
          <Text style={{ color: colors.primaryContrast, fontSize: 13, fontWeight: '700' }}>{initial}</Text>
        </View>
      )}

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[commentStyles.authorName, { color: colors.text }]}>{name}</Text>
          <Text style={[commentStyles.timestamp, { color: colors.textTertiary }]}>{timeAgo}</Text>
        </View>
        <Text style={[commentStyles.commentText, { color: colors.textSecondary }]}>{comment.text}</Text>
      </View>
    </View>
  )
}

function formatTimeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  if (diffSecs < 60) return `${diffSecs}s ago`
  const diffMins = Math.floor(diffSecs / 60)
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
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

  // Comment state
  const [commentText, setCommentText] = useState('')
  const [commentError, setCommentError] = useState('')

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
        const newComment = res?.data
        return {
          ...old,
          data: {
            ...old.data,
            items: [...(old.data?.items ?? []), newComment],
          },
        }
      })
      setCommentText('')
      setCommentError('')
    },
    onError: () => {
      setCommentError('Failed to post comment. Please try again.')
    },
  })

  function handlePostComment() {
    const trimmed = commentText.trim()
    if (trimmed.length < 2) {
      setCommentError('Comment must be at least 2 characters.')
      return
    }
    if (containsBlockedContent(trimmed)) {
      setCommentError('Your comment contains inappropriate content.')
      return
    }
    setCommentError('')
    commentMutation.mutate(trimmed)
  }

  const video = data?.data
  const comments: any[] = commentsData?.data?.items ?? []

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  if (!video) return null

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={{ flex: 1, backgroundColor: colors.background }}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Fix 5: back button visible in dark mode */}
          <Pressable
            onPress={() => router.back()}
            style={[styles.back, { backgroundColor: '#000' }]}
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
            <Text style={styles.backText}>Back</Text>
          </Pressable>

          {/* Video player */}
          <View style={styles.playerContainer}>
            {video.streamUrl ? (
              <Video
                ref={videoRef}
                source={{ uri: video.streamUrl }}
                style={styles.player}
                resizeMode={ResizeMode.CONTAIN}
                useNativeControls
                onPlaybackStatusUpdate={(s) => setStatus(s)}
              />
            ) : (
              <View style={[styles.player, styles.playerPlaceholder]}>
                <Text style={styles.processingText}>
                  {video.status === 'PROCESSING' ? 'Video is processing...' : 'No video available'}
                </Text>
              </View>
            )}
          </View>

          {/* Info section — Fix 5: themed colors */}
          <View style={[styles.info, { backgroundColor: colors.background }]}>
            <View style={styles.categoryRow}>
              <View style={[styles.categoryBadge, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.categoryText, { color: colors.primary }]}>{video.category}</Text>
              </View>
              {video.mosque && (
                <TouchableOpacity
                  onPress={() => video.mosque?.id && router.push(`/mosque/${video.mosque.id}` as any)}
                  disabled={!video.mosque?.id}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.mosqueName, { color: colors.primary }]}>{video.mosque.name}</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={[styles.title, { color: colors.text }]}>{video.title}</Text>

            <View style={styles.statsRow}>
              <Text style={[styles.statsText, { color: colors.textTertiary }]}>{video.viewCount ?? 0} views</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={() => likeMutation.mutate()}
                  style={[styles.likeBtn, { backgroundColor: colors.surfaceSecondary }]}
                >
                  <Ionicons
                    name={video.userLiked ? 'heart' : 'heart-outline'}
                    size={16}
                    color={video.userLiked ? '#EF4444' : colors.textSecondary}
                  />
                  <Text style={[styles.likeBtnText, { color: colors.text }]}>{video.likeCount ?? 0}</Text>
                </Pressable>
                <Pressable
                  onPress={() => Share.share({ message: `${video.title} — ${video.mosque?.name ?? 'Mosque'}\n\nWatch on the Masjid app`, title: video.title }).catch(() => {})}
                  style={[styles.likeBtn, { backgroundColor: colors.surfaceSecondary }]}
                >
                  <Ionicons name="share-outline" size={16} color={colors.textSecondary} />
                  <Text style={[styles.likeBtnText, { color: colors.text }]}>Share</Text>
                </Pressable>
              </View>
            </View>

            {video.description ? (
              <Text style={[styles.description, { color: colors.textSecondary }]}>{video.description}</Text>
            ) : null}
          </View>

          {/* Fix 3: Comments section */}
          <View style={[styles.commentsSection, { backgroundColor: colors.background }]}>
            <Text style={[styles.commentsSectionTitle, { color: colors.text }]}>
              Comments {comments.length > 0 ? `(${comments.length})` : ''}
            </Text>

            {commentsLoading ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 16 }} />
            ) : comments.length === 0 ? (
              <Text style={[styles.noComments, { color: colors.textTertiary }]}>
                No comments yet. Be the first to comment.
              </Text>
            ) : (
              comments.map((c) => (
                <CommentItem key={c.id} comment={c} colors={colors} />
              ))
            )}
          </View>
        </ScrollView>

        {/* Fix 3: Comment input bar — Fix 5: themed */}
        {isSignedIn ? (
          <View style={[styles.commentBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            {commentError ? (
              <Text style={styles.commentErrorText}>{commentError}</Text>
            ) : null}
            <View style={styles.commentInputRow}>
              <TextInput
                style={[
                  styles.commentInput,
                  {
                    backgroundColor: colors.inputBackground,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                placeholder="Add a comment..."
                placeholderTextColor={colors.textTertiary}
                value={commentText}
                onChangeText={(t) => {
                  setCommentText(t)
                  if (commentError) setCommentError('')
                }}
                multiline
                maxLength={1000}
                returnKeyType="default"
              />
              <TouchableOpacity
                onPress={handlePostComment}
                disabled={commentMutation.isPending || commentText.trim().length < 2}
                style={[
                  styles.sendBtn,
                  {
                    backgroundColor:
                      commentMutation.isPending || commentText.trim().length < 2
                        ? colors.border
                        : colors.primary,
                  },
                ]}
                activeOpacity={0.8}
              >
                {commentMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.primaryContrast} />
                ) : (
                  <Ionicons name="send" size={16} color={colors.primaryContrast} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={[styles.commentBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <Text style={[styles.signInPrompt, { color: colors.textSecondary }]}>
              Sign in to leave a comment
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
  },
  backText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  playerContainer: { backgroundColor: '#000', width: '100%', aspectRatio: 16 / 9 },
  player: { width: '100%', height: '100%' },
  playerPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  processingText: { color: '#fff', fontSize: 16 },
  info: { padding: 16 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  categoryBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  categoryText: { fontSize: 12, fontWeight: '600' },
  mosqueName: { fontSize: 13 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 10 },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  statsText: { fontSize: 13 },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  likeBtnText: { fontSize: 14, fontWeight: '600' },
  description: { fontSize: 14, lineHeight: 22 },
  // Comments section
  commentsSection: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    minHeight: 100,
  },
  commentsSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  noComments: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  // Comment bar (input)
  commentBar: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 4 : 8,
  },
  commentErrorText: {
    color: '#EF4444',
    fontSize: 12,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 96,
    minHeight: 40,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
  signInPrompt: {
    textAlign: 'center',
    fontSize: 14,
    paddingVertical: 10,
  },
})

const commentStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorName: {
    fontSize: 13,
    fontWeight: '700',
  },
  timestamp: {
    fontSize: 11,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 3,
  },
})
