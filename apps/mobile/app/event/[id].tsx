import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Video, ResizeMode } from 'expo-av'
import { Ionicons } from '@expo/vector-icons'
import { format } from 'date-fns'
import { useAuth } from '@clerk/clerk-expo'
import { api } from '../../lib/api'
import { useTheme } from '../../contexts/ThemeContext'

const RSVP_OPTIONS = [
  { status: 'GOING',     label: 'Going',    icon: '✅', color: '#1B4332' },
  { status: 'MAYBE',     label: 'Maybe',    icon: '🤔', color: '#92400E' },
  { status: 'NOT_GOING', label: "Can't go", icon: '❌', color: '#7F1D1D' },
] as const

export default function EventDetailScreen() {
  const { colors } = useTheme()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { isSignedIn } = useAuth()
  const queryClient = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['event', id],
    queryFn: () => api.get(`/events/${id}`),
  })

  const rsvpMutation = useMutation({
    mutationFn: (status: string) => api.post(`/events/${id}/rsvp`, { status }),
    onMutate: async (newStatus) => {
      await queryClient.cancelQueries({ queryKey: ['event', id] })
      const previous = queryClient.getQueryData(['event', id])
      queryClient.setQueryData(['event', id], (old: any) => ({
        ...old,
        data: { ...old?.data, userRsvp: newStatus },
      }))
      return { previous }
    },
    onError: (_err, _status, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['event', id], context.previous)
      }
      Alert.alert('Error', 'Could not save your RSVP. Please try again.')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['event', id] })
      queryClient.invalidateQueries({ queryKey: ['user-rsvps'] })
      // Use getQueryData to avoid stale closure over `event` variable
      const eventData = queryClient.getQueryData<any>(['event', id])?.data
      if (eventData?.mosqueId) {
        queryClient.invalidateQueries({ queryKey: ['mosque-events', eventData.mosqueId] })
      }
      queryClient.invalidateQueries({ queryKey: ['home-feed'] })
    },
  })

  const event = data?.data

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }
  if (isError || !event) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <Ionicons name="calendar-outline" size={52} color={colors.textTertiary} />
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700', marginTop: 16, marginBottom: 6 }}>
            {isError ? 'Could not load event' : 'Event not found'}
          </Text>
          <Text style={{ color: colors.textTertiary, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
            {isError ? 'Check your connection and try again.' : 'This event may have been removed.'}
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  const currentStatus = event.userRsvp as string | null

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        {event.imageUrl && (
          <Image source={{ uri: event.imageUrl }} style={{ width: '100%', height: 200 }} contentFit="cover" />
        )}
        {event.videoUrl && !event.imageUrl && (
          <Video source={{ uri: event.videoUrl }} useNativeControls resizeMode={ResizeMode.CONTAIN}
            style={{ width: '100%', height: 220, backgroundColor: '#000' }} />
        )}

        <View style={{ padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <View style={{ backgroundColor: colors.primaryLight, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>
                {event.category?.replace('_', ' ')}
              </Text>
            </View>
            {event.mosque?.isVerified && (
              <Ionicons name="checkmark-circle" size={16} color="#D4A017" />
            )}
          </View>

          <Text style={{ fontSize: 22, fontWeight: 'bold', color: colors.text, marginBottom: 4 }}>
            {event.title}
          </Text>
          <TouchableOpacity
            onPress={() => event.mosque?.id && router.push(`/mosque/${event.mosque.id}` as any)}
            disabled={!event.mosque?.id}
            activeOpacity={0.7}
            style={{ alignSelf: 'flex-start', marginBottom: 16 }}
          >
            <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>
              by {event.mosque?.name}
            </Text>
          </TouchableOpacity>

          <View style={{ gap: 10, marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="calendar" size={16} color={colors.textSecondary} />
              <Text style={{ color: colors.text, fontSize: 14, marginLeft: 8 }}>
                {format(new Date(event.startTime), 'EEEE, MMMM d, yyyy')}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="time" size={16} color={colors.textSecondary} />
              <Text style={{ color: colors.text, fontSize: 14, marginLeft: 8 }}>
                {format(new Date(event.startTime), 'h:mm a')}
                {event.endTime ? ` – ${format(new Date(event.endTime), 'h:mm a')}` : ''}
              </Text>
            </View>
            {event.location && (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="location" size={16} color={colors.textSecondary} />
                <Text style={{ color: colors.text, fontSize: 14, marginLeft: 8 }}>{event.location}</Text>
              </View>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="people" size={16} color={colors.textSecondary} />
              <Text style={{ color: colors.text, fontSize: 14, marginLeft: 8 }}>{event.rsvpCount ?? 0} going</Text>
            </View>
          </View>

          {event.description && (
            <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 22, marginBottom: 16 }}>
              {event.description}
            </Text>
          )}

          {event.quranArabic && (
            <View style={{ marginBottom: 20, backgroundColor: colors.primaryLight, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.primary }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary, letterSpacing: 0.5, marginBottom: 10 }}>
                📖 QUR'AN — {event.quranSurahName?.toUpperCase()} {event.quranSurah}:{event.quranAyah}
              </Text>
              <Text style={{ fontSize: 20, color: colors.text, textAlign: 'right', lineHeight: 36, marginBottom: 10 }}>
                {event.quranArabic}
              </Text>
              {event.quranEnglish && (
                <Text style={{ fontSize: 13, color: colors.textSecondary, fontStyle: 'italic', lineHeight: 20 }}>
                  "{event.quranEnglish}"
                </Text>
              )}
            </View>
          )}

          {/* RSVP */}
          {isSignedIn ? (
            <View>
              <Text style={{ color: colors.text, fontWeight: '600', marginBottom: 10, fontSize: 15 }}>
                Will you attend?
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {RSVP_OPTIONS.map((opt) => {
                  const isActive = currentStatus === opt.status
                  return (
                    <TouchableOpacity
                      key={opt.status}
                      onPress={() => rsvpMutation.mutate(opt.status)}
                      disabled={rsvpMutation.isPending}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                      style={{
                        flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center',
                        backgroundColor: isActive ? opt.color : colors.surface,
                        borderWidth: 1,
                        borderColor: isActive ? opt.color : colors.border,
                        opacity: rsvpMutation.isPending ? 0.6 : 1,
                      }}
                    >
                      <Text style={{ fontSize: 18 }}>{opt.icon}</Text>
                      <Text style={{ fontSize: 12, fontWeight: '600', marginTop: 4, color: isActive ? colors.primaryContrast : colors.textSecondary }}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
              {currentStatus && (
                <TouchableOpacity
                  onPress={() => rsvpMutation.mutate(currentStatus === 'GOING' ? 'NOT_GOING' : 'GOING')}
                  style={{ marginTop: 10, alignItems: 'center' }}
                >
                  <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                    {currentStatus === 'GOING' ? "Change response" : "Tap Going to confirm attendance"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => router.push('/(auth)/sign-in')}
              style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
            >
              <Text style={{ color: colors.primaryContrast, fontWeight: '600' }}>Sign in to RSVP</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
