import { useState, useRef } from 'react'
import {
  View, Text, ScrollView, ActivityIndicator, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Video, ResizeMode } from 'expo-av'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@clerk/clerk-expo'
import { format, formatDistanceToNow } from 'date-fns'
import { api } from '../../lib/api'
import { QuranPicker, QuranVerseData } from '../../components/QuranPicker'
import { PollCard } from '../../components/PollCard'
import { useTheme } from '../../contexts/ThemeContext'

const PRIORITY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  URGENT:    { bg: '#FEE2E2', text: '#7F1D1D', label: 'Urgent' },
  IMPORTANT: { bg: '#FEF3C7', text: '#78350F', label: 'Important' },
  NORMAL:    { bg: '#D8F3DC', text: '#1B4332', label: '' },
}

export default function AnnouncementDetailScreen() {
  const { colors } = useTheme()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { isSignedIn } = useAuth()
  const queryClient = useQueryClient()
  const [commentText, setCommentText] = useState('')
  const [commentVerse, setCommentVerse] = useState<QuranVerseData | null>(null)
  const inputRef = useRef<TextInput>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['announcement', id],
    queryFn: () => api.get(`/announcements/${id}`),
  })

  const { data: commentsData, isLoading: commentsLoading } = useQuery({
    queryKey: ['announcement-comments', id],
    queryFn: () => api.get(`/announcements/${id}/comments`),
  })

  const likeMutation = useMutation({
    mutationFn: () => api.post(`/announcements/${id}/likes`, {}),
    onSuccess: (res) => {
      queryClient.setQueryData(['announcement', id], (old: any) => ({
        ...old,
        data: { ...old.data, isLiked: res.data.isLiked, likeCount: res.data.likeCount },
      }))
    },
  })

  const commentMutation = useMutation({
    mutationFn: (text: string) => api.post(`/announcements/${id}/comments`, { text, ...(commentVerse ?? {}) }),
    onError: (err: any) => Alert.alert('Error', err.message ?? 'Could not post comment. Try again.'),
    onSuccess: () => {
      setCommentText('')
      setCommentVerse(null)
      queryClient.invalidateQueries({ queryKey: ['announcement-comments', id] })
      queryClient.invalidateQueries({ queryKey: ['announcement', id] })
    },
  })

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => api.delete(`/announcements/comments/${commentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcement-comments', id] })
      queryClient.invalidateQueries({ queryKey: ['announcement', id] })
    },
  })

  const item = data?.data
  const comments: any[] = commentsData?.data?.items ?? []

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }
  if (!item) return null

  const priorityCfg = PRIORITY_COLORS[item.priority] ?? PRIORITY_COLORS.NORMAL

  function handleLike() {
    if (!isSignedIn) { Alert.alert('Sign in required', 'Please sign in to like posts.'); return }
    likeMutation.mutate()
  }

  function handleSubmitComment() {
    if (!isSignedIn) { Alert.alert('Sign in required', 'Please sign in to comment.'); return }
    if (!commentText.trim()) return
    commentMutation.mutate(commentText.trim())
  }

  function handleDeleteComment(commentId: string) {
    Alert.alert('Delete comment', 'Remove this comment?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteCommentMutation.mutate(commentId) },
    ])
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={56}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Media */}
          {item.imageUrl && (
            <Image source={{ uri: item.imageUrl }} style={{ width: '100%', height: 220 }} contentFit="cover" />
          )}
          {item.videoUrl && !item.imageUrl && (
            <Video
              source={{ uri: item.videoUrl }}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              style={{ width: '100%', height: 240, backgroundColor: '#000' }}
            />
          )}

          <View style={{ padding: 20 }}>
            {/* Badges */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              {item.isPinned && (
                <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>📌 Pinned</Text>
                </View>
              )}
              {item.priority !== 'NORMAL' && (
                <View style={{ backgroundColor: priorityCfg.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: priorityCfg.text }}>{priorityCfg.label}</Text>
                </View>
              )}
            </View>

            <Text style={{ fontSize: 22, fontWeight: 'bold', color: colors.text, marginBottom: 6 }}>{item.title}</Text>

            {item.mosque && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                {item.mosque.logoUrl && (
                  <Image source={{ uri: item.mosque.logoUrl }} style={{ width: 20, height: 20, borderRadius: 4 }} contentFit="cover" />
                )}
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{item.mosque.name}</Text>
              </View>
            )}

            <Text style={{ color: colors.textTertiary, fontSize: 12, marginBottom: 20 }}>
              {format(new Date(item.createdAt), 'MMMM d, yyyy · h:mm a')}
            </Text>

            <Text style={{ color: colors.text, fontSize: 15, lineHeight: 24 }}>{item.body}</Text>

            {item.title?.startsWith('📊') && (
              <PollLinkSection mosqueId={item.mosqueId} question={item.body} />
            )}

            {/* Qur'an verse */}
            {item.quranArabic && (
              <View style={{ marginTop: 16, backgroundColor: colors.primaryLight, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.primary }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary, letterSpacing: 0.5, marginBottom: 10 }}>
                  📖 QUR'AN — {item.quranSurahName?.toUpperCase()} {item.quranSurah}:{item.quranAyah}
                </Text>
                <Text style={{ fontSize: 20, color: colors.text, textAlign: 'right', lineHeight: 36, marginBottom: 10 }}>
                  {item.quranArabic}
                </Text>
                {item.quranEnglish && (
                  <Text style={{ fontSize: 13, color: colors.textSecondary, fontStyle: 'italic', lineHeight: 20 }}>
                    "{item.quranEnglish}"
                  </Text>
                )}
              </View>
            )}

            {/* Like & Comment counts */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
              <TouchableOpacity
                onPress={handleLike}
                disabled={likeMutation.isPending}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                <Ionicons
                  name={item.isLiked ? 'heart' : 'heart-outline'}
                  size={24}
                  color={item.isLiked ? '#EF4444' : colors.textTertiary}
                />
                <Text style={{ fontSize: 14, color: item.isLiked ? '#EF4444' : colors.textTertiary, fontWeight: '600' }}>
                  {item.likeCount ?? 0}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => inputRef.current?.focus()}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                <Ionicons name="chatbubble-outline" size={22} color={colors.textTertiary} />
                <Text style={{ fontSize: 14, color: colors.textTertiary, fontWeight: '600' }}>
                  {item.commentCount ?? 0}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Comments */}
          <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 14 }}>
              Comments {comments.length > 0 ? `(${comments.length})` : ''}
            </Text>

            {commentsLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
            ) : comments.length === 0 ? (
              <Text style={{ color: colors.textTertiary, fontSize: 14, textAlign: 'center', paddingVertical: 20 }}>
                No comments yet. Be the first!
              </Text>
            ) : (
              comments.map((c) => (
                <CommentRow
                  key={c.id}
                  comment={c}
                  onDelete={() => handleDeleteComment(c.id)}
                />
              ))
            )}
          </View>

          <View style={{ height: 80 }} />
        </ScrollView>

        {/* Comment input */}
        <View style={{
          gap: 8, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10,
          borderTopWidth: 1, borderTopColor: colors.border,
          backgroundColor: colors.surface,
        }}>
          <QuranPicker verse={commentVerse} onSelect={setCommentVerse} />
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
            <TextInput
              ref={inputRef}
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Add a comment…"
              placeholderTextColor={colors.textTertiary}
              multiline
              maxLength={1000}
              style={{
                flex: 1, backgroundColor: colors.inputBackground, borderRadius: 20,
                paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10,
                fontSize: 14, color: colors.text, maxHeight: 100,
                borderWidth: 1, borderColor: colors.border,
              }}
            />
            <TouchableOpacity
              onPress={handleSubmitComment}
              disabled={!commentText.trim() || commentMutation.isPending}
              style={{
                width: 38, height: 38, borderRadius: 19,
                backgroundColor: commentText.trim() ? colors.primary : colors.border,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              {commentMutation.isPending
                ? <ActivityIndicator size="small" color="white" />
                : <Ionicons name="arrow-up" size={18} color={commentText.trim() ? 'white' : colors.textTertiary} />
              }
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function PollLinkSection({ mosqueId, question }: { mosqueId: string; question: string }) {
  const { colors } = useTheme()
  const { data } = useQuery({
    queryKey: ['mosque-polls-for-announcement', mosqueId],
    queryFn: () => api.get(`/mosques/${mosqueId}/polls`),
    staleTime: 30_000,
  })
  const polls: any[] = data?.data?.items ?? []
  // Find the poll whose question matches the announcement body
  const poll = polls.find((p: any) => p.question === question || p.question.includes(question.slice(0, 30)))
  if (!poll) return null
  return (
    <View style={{ marginTop: 16 }}>
      <PollCard poll={poll} queryKey={['mosque-polls-for-announcement', mosqueId]} />
    </View>
  )
}

function CommentRow({ comment, onDelete }: { comment: any; onDelete: () => void }) {
  const { colors } = useTheme()
  const { userId } = useAuth()
  const isOwn = comment.user?.id === userId
  const initials = (comment.user?.name ?? '?')[0].toUpperCase()

  return (
    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
      {comment.user?.avatarUrl ? (
        <Image source={{ uri: comment.user.avatarUrl }} style={{ width: 34, height: 34, borderRadius: 17, marginTop: 2 }} contentFit="cover" />
      ) : (
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>{initials}</Text>
        </View>
      )}

      <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>
            {comment.user?.name ?? 'Anonymous'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 11, color: colors.textTertiary }}>
              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
            </Text>
            {isOwn && (
              <TouchableOpacity onPress={onDelete} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Ionicons name="trash-outline" size={14} color="#EF4444" />
              </TouchableOpacity>
            )}
          </View>
        </View>
        <Text style={{ fontSize: 14, color: colors.text, lineHeight: 20 }}>{comment.text}</Text>
        {comment.quranArabic && (
          <View style={{ marginTop: 6, backgroundColor: colors.primaryLight, borderRadius: 8, padding: 8, borderWidth: 1, borderColor: colors.primary }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary, marginBottom: 4 }}>
              📖 {comment.quranSurahName} {comment.quranSurah}:{comment.quranAyah}{comment.quranAyahEnd && comment.quranAyahEnd !== comment.quranAyah ? `–${comment.quranAyahEnd}` : ''}
            </Text>
            <Text style={{ fontSize: 13, color: colors.text, textAlign: 'right', lineHeight: 22 }}>{comment.quranArabic}</Text>
            {comment.quranEnglish && (
              <Text style={{ fontSize: 11, color: colors.textSecondary, fontStyle: 'italic', marginTop: 3 }} numberOfLines={2}>"{comment.quranEnglish}"</Text>
            )}
          </View>
        )}
      </View>
    </View>
  )
}
