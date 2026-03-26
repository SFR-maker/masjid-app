import { useState, useRef } from 'react'
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AntDesign } from '@expo/vector-icons'
import { api } from '../../lib/api'

export default function VideoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const videoRef = useRef<Video>(null)
  const [status, setStatus] = useState<AVPlaybackStatus | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['video', id],
    // Initial fetch increments view count; subsequent invalidations use noView variant
    queryFn: () => api.get<any>(`/videos/${id}`),
  })

  const likeMutation = useMutation({
    mutationFn: () => api.post(`/videos/${id}/like`, {}),
    // Bug 8 fix: pass noView=1 so the refetch doesn't increment view count
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['video', id, 'noView'] }),
  })

  const video = data?.data

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#166534" />
      </View>
    )
  }

  if (!video) return null

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.container} bounces={false}>
        {/* Back button */}
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
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
                {video.status === 'PROCESSING' ? '⏳ Video is processing...' : '🎬'}
              </Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.info}>
          <View style={styles.categoryRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{video.category}</Text>
            </View>
            {video.mosque && (
              <Text style={styles.mosqueName}>{video.mosque.name}</Text>
            )}
          </View>

          <Text style={styles.title}>{video.title}</Text>

          <View style={styles.statsRow}>
            <Text style={styles.statsText}>{video.viewCount ?? 0} views</Text>
            {/* Bug 8 fix: vector icon, not PNG/emoji */}
            <Pressable onPress={() => likeMutation.mutate()} style={styles.likeBtn}>
              <AntDesign
                name={video.userLiked ? 'heart' : 'hearto'}
                size={16}
                color={video.userLiked ? '#EF4444' : '#374151'}
              />
              <Text style={styles.likeBtnText}>{video.likeCount ?? 0}</Text>
            </Pressable>
          </View>

          {video.description ? (
            <Text style={styles.description}>{video.description}</Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  container: { flex: 1, backgroundColor: '#fff' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  back: { padding: 16, backgroundColor: '#000' },
  backText: { color: '#fff', fontSize: 15 },
  playerContainer: { backgroundColor: '#000', width: '100%', aspectRatio: 16 / 9 },
  player: { width: '100%', height: '100%' },
  playerPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  processingText: { color: '#fff', fontSize: 16 },
  info: { padding: 16 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  categoryBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  categoryText: { color: '#15803d', fontSize: 12, fontWeight: '600' },
  mosqueName: { color: '#6b7280', fontSize: 13 },
  title: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 10 },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  statsText: { color: '#9ca3af', fontSize: 13 },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f3f4f6', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  likeBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  description: { fontSize: 14, color: '#6b7280', lineHeight: 22 },
})
