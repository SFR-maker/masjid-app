import { useState, useRef } from 'react'
import { View, Text, TouchableOpacity, Alert, TextInput, ActivityIndicator } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { formatDistanceToNow } from 'date-fns'
import { router } from 'expo-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-expo'
import { api } from '../lib/api'
import { QuranPicker, QuranVerseData } from './QuranPicker'
import { useTheme } from '../contexts/ThemeContext'

interface Props {
  item: {
    id: string
    title: string
    body: string
    priority: string
    mosqueId?: string
    mosqueName?: string
    mosque?: { id?: string; name: string; logoUrl?: string }
    mosqueLogoUrl?: string
    imageUrl?: string
    videoUrl?: string
    createdAt: string
    likeCount?: number
    commentCount?: number
    isLiked?: boolean
  }
  compact?: boolean
}

const PRIORITY_BADGE: Record<string, { bg: string; text: string; label: string } | null> = {
  URGENT: { bg: '#FEE2E2', text: '#EF4444', label: 'Urgent' },
  IMPORTANT: { bg: '#FEF3C7', text: '#D97706', label: 'Important' },
  NORMAL: null,
}

export function AnnouncementCard({ item, compact }: Props) {
  const { colors } = useTheme()
  const { isSignedIn } = useAuth()
  const queryClient = useQueryClient()
  const [showCommentInput, setShowCommentInput] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [commentVerse, setCommentVerse] = useState<QuranVerseData | null>(null)
  const inputRef = useRef<TextInput>(null)
  const mosqueName = item.mosqueName ?? item.mosque?.name
  const logoUrl = item.mosqueLogoUrl ?? item.mosque?.logoUrl
  const badge = PRIORITY_BADGE[item.priority] ?? null
  const mosqueId = item.mosqueId ?? item.mosque?.id

  // Optimistic local state — updates instantly, reverts on error
  const [liked, setLiked] = useState(item.isLiked ?? false)
  const [likeCount, setLikeCount] = useState(item.likeCount ?? 0)
  const [commentCount, setCommentCount] = useState(item.commentCount ?? 0)

  const commentMutation = useMutation({
    mutationFn: () => api.post(`/announcements/${item.id}/comments`, {
      text: commentText.trim(),
      ...(commentVerse ?? {}),
    }),
    onError: (err: any) => Alert.alert('Error', err.message ?? 'Could not post comment. Try again.'),
    onSuccess: () => {
      setCommentText('')
      setCommentVerse(null)
      setShowCommentInput(false)
      setCommentCount(prev => prev + 1)
      queryClient.invalidateQueries({ queryKey: ['announcement-comments', item.id] })
      queryClient.setQueryData(['home-feed'], (old: any) => {
        if (!old?.data?.items) return old
        return {
          ...old,
          data: {
            ...old.data,
            items: old.data.items.map((i: any) =>
              i.id === item.id ? { ...i, commentCount: (i.commentCount ?? 0) + 1 } : i
            ),
          },
        }
      })
    },
  })

  const likeMutation = useMutation({
    mutationFn: () => api.post(`/announcements/${item.id}/likes`, {}),
    onSuccess: (res: any) => {
      // Sync local state with server truth
      setLiked(res.data.isLiked)
      setLikeCount(res.data.likeCount)
      // Keep caches in sync
      queryClient.setQueryData(['home-feed'], (old: any) => {
        if (!old?.data?.items) return old
        return {
          ...old,
          data: {
            ...old.data,
            items: old.data.items.map((i: any) =>
              i.id === item.id
                ? { ...i, isLiked: res.data.isLiked, likeCount: res.data.likeCount }
                : i
            ),
          },
        }
      })
      queryClient.setQueryData(['announcement', item.id], (old: any) =>
        old ? { ...old, data: { ...old.data, isLiked: res.data.isLiked, likeCount: res.data.likeCount } } : old
      )
    },
    onError: () => {
      // Revert optimistic update
      setLiked(item.isLiked ?? false)
      setLikeCount(item.likeCount ?? 0)
    },
  })

  function handleLike(e: any) {
    e.stopPropagation?.()
    if (!isSignedIn) { Alert.alert('Sign in required', 'Please sign in to like posts.'); return }
    // Optimistic update — flip immediately before API responds
    setLiked(prev => !prev)
    setLikeCount(prev => liked ? prev - 1 : prev + 1)
    likeMutation.mutate()
  }

  function handleCommentTap(e: any) {
    e.stopPropagation?.()
    if (!isSignedIn) { Alert.alert('Sign in required', 'Please sign in to comment.'); return }
    setShowCommentInput(v => {
      if (!v) setTimeout(() => inputRef.current?.focus(), 100)
      return !v
    })
  }


  function handleSubmitComment(e: any) {
    e.stopPropagation?.()
    if (!commentText.trim()) return
    commentMutation.mutate()
  }

  return (
    <TouchableOpacity
      onPress={() => router.push(`/announcement/${item.id}` as any)}
      activeOpacity={0.92}
      style={{
        marginHorizontal: compact ? 0 : 16,
        marginBottom: 14,
        backgroundColor: colors.surface,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: colors.primary,
        shadowOpacity: 0.06,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 14,
        elevation: 3,
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10, gap: 10 }}>
        {logoUrl ? (
          <Image source={{ uri: logoUrl }} style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: '#F0F0F0' }} contentFit="cover" />
        ) : (
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#D8F3DC', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 15 }}>📢</Text>
          </View>
        )}
        <TouchableOpacity
          style={{ flex: 1 }}
          onPress={(e) => { e.stopPropagation?.(); if (mosqueId) router.push(`/mosque/${mosqueId}` as any) }}
          activeOpacity={0.7}
          disabled={!mosqueId}
        >
          <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13, letterSpacing: -0.1 }} numberOfLines={1}>{mosqueName}</Text>
        </TouchableOpacity>
        {badge && (
          <View style={{ backgroundColor: badge.bg, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 }}>
            <Text style={{ color: badge.text, fontSize: 11, fontWeight: '700', letterSpacing: 0.2 }}>{badge.label.toUpperCase()}</Text>
          </View>
        )}
      </View>

      {/* Image */}
      {item.imageUrl && (
        <Image source={{ uri: item.imageUrl }} style={{ width: '100%', aspectRatio: 16 / 9 }} contentFit="cover" />
      )}
      {item.videoUrl && !item.imageUrl && (
        <View style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="play" size={22} color="white" style={{ marginLeft: 3 }} />
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 10, fontWeight: '500' }}>Tap to watch</Text>
        </View>
      )}

      {/* Content */}
      <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15, lineHeight: 21, marginBottom: 5, letterSpacing: -0.2 }}>
          {item.title}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19 }} numberOfLines={compact ? 2 : 3}>
          {item.body}
        </Text>
        {(item as any).quranSurah && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, backgroundColor: colors.primaryLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, alignSelf: 'flex-start' }}>
            <Text style={{ fontSize: 11 }}>📖</Text>
            <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600', letterSpacing: 0.1 }}>
              {(item as any).quranSurahName} {(item as any).quranSurah}:{(item as any).quranAyah}
            </Text>
          </View>
        )}
      </View>

      {/* Divider */}
      <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 14, marginTop: 8 }} />

      {/* Like / Comment row */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 14, paddingTop: 10, paddingBottom: showCommentInput ? 6 : 12,
        gap: 18,
      }}>
        <TouchableOpacity
          onPress={handleLike}
          disabled={likeMutation.isPending}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
        >
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={18}
            color={liked ? '#EF4444' : '#9CA3AF'}
          />
          {likeCount > 0 && (
            <Text style={{ fontSize: 13, color: liked ? '#EF4444' : '#9CA3AF', fontWeight: '600' }}>
              {likeCount}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleCommentTap}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
        >
          <Ionicons
            name={showCommentInput ? 'chatbubble' : 'chatbubble-outline'}
            size={18}
            color={showCommentInput ? colors.primary : '#9CA3AF'}
          />
          {commentCount > 0 && (
            <Text style={{ fontSize: 13, color: showCommentInput ? colors.primary : '#9CA3AF', fontWeight: '600' }}>
              {commentCount}
            </Text>
          )}
        </TouchableOpacity>

        <Text style={{ color: colors.textTertiary, fontSize: 11, marginLeft: 'auto' }}>
          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
        </Text>
      </View>

      {/* Inline comment input */}
      {showCommentInput && (
        <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation?.()}>
          <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 8 }}>
            <QuranPicker verse={commentVerse} onSelect={setCommentVerse} />
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
              <TextInput
                ref={inputRef}
                value={commentText}
                onChangeText={setCommentText}
                placeholder="Write a comment…"
                placeholderTextColor="#9CA3AF"
                multiline
                maxLength={500}
                style={{
                  flex: 1, backgroundColor: colors.inputBackground, borderRadius: 16,
                  paddingHorizontal: 13, paddingTop: 9, paddingBottom: 9,
                  fontSize: 13, color: colors.text, maxHeight: 80,
                  borderWidth: 1, borderColor: colors.border,
                }}
              />
              <TouchableOpacity
                onPress={handleSubmitComment}
                disabled={!commentText.trim() || commentMutation.isPending}
                style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: commentText.trim() ? colors.primary : colors.border,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                {commentMutation.isPending
                  ? <ActivityIndicator size="small" color="white" />
                  : <Ionicons name="arrow-up" size={16} color={commentText.trim() ? 'white' : '#9CA3AF'} />
                }
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  )
}
