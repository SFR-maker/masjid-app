import { useState, useMemo, useRef, useEffect } from 'react'
import {
  View, Text, ScrollView, FlatList, TouchableOpacity, Linking, ActivityIndicator, Alert,
  Modal, TextInput, KeyboardAvoidingView, Platform, Dimensions,
} from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useAuth, useUser } from '@clerk/clerk-expo'
import { PollCard } from '../../components/PollCard'
import { api } from '../../lib/api'
import { EventCard } from '../../components/EventCard'
import { AnnouncementCard } from '../../components/AnnouncementCard'
import { QuranPicker, QuranVerseData } from '../../components/QuranPicker'
import { useSelectedMosque } from '../../hooks/useSelectedMosque'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, isSameMonth, addMonths, subMonths,
} from 'date-fns'
import { useTheme } from '../../contexts/ThemeContext'
import { useQuranAudioStore } from '../../lib/quranAudioStore'

const TABS = ['Info', 'Events', 'Announcements', 'Polls', 'Services', 'Documents']
const SCREEN_W = Dimensions.get('window').width

export default function MosqueProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { isSignedIn } = useAuth()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('Info')
  const [showMessageModal, setShowMessageModal] = useState(false)
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const { setSelectedMosque, mosqueId: selectedMosqueId, clearSelectedMosque } = useSelectedMosque()
  // Bug 15 fix: detect if mini Quran player is active so we can push the sticky bottom bar up
  const quranIsActive = useQuranAudioStore(s => s.isPlaying || s.isPaused)
  const MINI_PLAYER_HEIGHT = 52 // matches NowPlayingBar paddingVertical*2 + content height

  const { data, isLoading } = useQuery({
    queryKey: ['mosque', id],
    queryFn: () => api.get(`/mosques/${id}`),
    staleTime: 30_000,
  })

  const mosque = data?.data

  const followMutation = useMutation({
    mutationFn: (isFollowing: boolean) =>
      isFollowing
        ? api.delete(`/mosques/${id}/follow`)
        : api.post(`/mosques/${id}/follow`, {}),
    onSuccess: (_, isFollowing) => {
      queryClient.invalidateQueries({ queryKey: ['mosque', id] })
      queryClient.invalidateQueries({ queryKey: ['followed-mosques'] })
      if (!isFollowing && mosque) {
        // Just followed — set as selected mosque
        setSelectedMosque(mosque.id, mosque.name)
      } else if (isFollowing && selectedMosqueId === id) {
        // Just unfollowed the currently selected mosque — clear it
        clearSelectedMosque()
      }
    },
    onError: () => Alert.alert('Error', 'Could not update follow. Please try again.'),
  })

  const favoriteMutation = useMutation({
    mutationFn: (isFavorite: boolean) =>
      isFavorite
        ? api.delete(`/mosques/${id}/favorite`)
        : api.post(`/mosques/${id}/favorite`, {}),
    onSuccess: () => {
      // Invalidate all cached mosque detail pages so other mosques lose the star
      queryClient.invalidateQueries({ queryKey: ['mosque'] })
      queryClient.invalidateQueries({ queryKey: ['followed-mosques'] })
    },
    onError: () => Alert.alert('Error', 'Could not update favorite. Please try again.'),
  })

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    )
  }

  if (!mosque) return null

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Banner */}
        <View style={{ position: 'relative' }}>
          <Image
            source={{ uri: mosque.mainImageUrl || mosque.bannerUrl || mosque.logoUrl || `https://placehold.co/800x400/1B4332/D8F3DC?text=Mosque` }}
            style={{ width: '100%', height: 200 }}
            contentFit="cover"
          />
          {/* Floating back button — offset by safe area top inset */}
          <TouchableOpacity
            onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/discover')}
            style={{
              position: 'absolute',
              top: insets.top + 8,
              left: 16,
              backgroundColor: 'rgba(0,0,0,0.45)',
              borderRadius: 20,
              padding: 8,
            }}
          >
            <Ionicons name="arrow-back" size={20} color="white" />
          </TouchableOpacity>
        </View>

        {/* Mosque header card */}
        <View style={{ paddingHorizontal: 20, marginTop: -24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 }}>
              <Image
                source={{ uri: mosque.logoUrl ?? `https://placehold.co/60x60/1B4332/white?text=🕌` }}
                style={{ width: 64, height: 64, borderRadius: 12 }}
                contentFit="cover"
              />
            </View>
            {isSignedIn && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => favoriteMutation.mutate(!!mosque.isFavorite)}
                  disabled={favoriteMutation.isPending || !mosque.isFollowing || !mosque.hasOwner}
                  style={{
                    borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10,
                    backgroundColor: mosque.isFavorite ? '#FEF3C7' : colors.surface,
                    borderWidth: 1, borderColor: mosque.isFavorite ? '#D97706' : colors.border,
                    opacity: !mosque.hasOwner ? 0.4 : 1,
                  }}
                >
                  <Text style={{ fontSize: 16 }}>{mosque.isFavorite ? '⭐' : '☆'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    if (!mosque.hasOwner) {
                      Alert.alert('Unclaimed Mosque', 'This mosque has not been claimed by an owner yet and cannot be followed.')
                      return
                    }
                    if (mosque.isFollowing) {
                      Alert.alert('Unfollow Mosque', `Unfollow ${mosque.name}?`, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Unfollow', style: 'destructive', onPress: () => followMutation.mutate(true) },
                      ])
                    } else {
                      followMutation.mutate(false)
                    }
                  }}
                  disabled={followMutation.isPending}
                  style={{
                    borderRadius: 16, paddingHorizontal: 20, paddingVertical: 10,
                    backgroundColor: mosque.isFollowing ? colors.surface : mosque.hasOwner ? colors.primary : colors.border,
                    borderWidth: 1, borderColor: mosque.isFollowing ? colors.border : mosque.hasOwner ? colors.primary : colors.border,
                  }}
                >
                  <Text style={{ color: mosque.isFollowing ? colors.textSecondary : mosque.hasOwner ? colors.primaryContrast : colors.textTertiary, fontWeight: '600', fontSize: 14 }}>
                    {followMutation.isPending ? '...' : mosque.isFollowing ? 'Following' : mosque.hasOwner ? 'Follow' : 'Unclaimed'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={{ marginTop: 12, marginBottom: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text }}>{mosque.name}</Text>
              {mosque.isVerified && <Ionicons name="checkmark-circle" size={20} color="#D4A017" />}
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>{mosque.city}, {mosque.state}</Text>
            <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>{mosque.followersCount} followers</Text>
            {!mosque.hasOwner && (
              <View style={{ marginTop: 8, backgroundColor: '#FFF7ED', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#FED7AA', alignSelf: 'flex-start' }}>
                <Text style={{ color: '#C2410C', fontSize: 11, fontWeight: '600' }}>🔓 Unclaimed mosque — not yet set up by an owner</Text>
              </View>
            )}
          </View>
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingLeft: 20, marginTop: 16 }}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={{ marginRight: 24, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: activeTab === tab ? colors.primary : 'transparent' }}
            >
              <Text style={{ fontWeight: '600', color: activeTab === tab ? colors.primary : colors.textTertiary, fontSize: 14 }}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 20 }} />

        {/* Tab content */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
          {activeTab === 'Info' && <InfoTab mosque={mosque} />}
          {activeTab === 'Events' && <EventsTab mosqueId={id} />}
          {activeTab === 'Announcements' && <AnnouncementsTab mosqueId={id} />}
          {activeTab === 'Polls' && <PollsTab mosqueId={id} />}
          {activeTab === 'Services' && <ServicesTab mosqueId={id} />}
          {activeTab === 'Documents' && <DocumentsTab mosqueId={id} />}
        </View>

        <View style={{ height: 160 }} />
      </ScrollView>

      {/* Sticky bottom buttons — Bug 15 fix: push up when mini Quran player is active */}
      <View style={{ position: 'absolute', bottom: quranIsActive ? MINI_PLAYER_HEIGHT : 0, left: 0, right: 0, paddingHorizontal: 20, paddingBottom: 24, paddingTop: 12, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, gap: 10 }}>
        {isSignedIn && (
          <TouchableOpacity
            onPress={() => setShowMessageModal(true)}
            style={{ backgroundColor: colors.primaryLight, borderRadius: 16, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.primaryLight }}
          >
            <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 15 }}>✉️ Message {mosque.name}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={{ backgroundColor: '#D4A017', borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}>
          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 15 }}>💚 Donate to {mosque.name}</Text>
        </TouchableOpacity>
      </View>

      <MessageModal
        visible={showMessageModal}
        mosqueName={mosque.name}
        mosqueId={id}
        onClose={() => setShowMessageModal(false)}
      />
    </SafeAreaView>
  )
}

function MessageModal({ visible, mosqueName, mosqueId, onClose }: {
  visible: boolean
  mosqueName: string
  mosqueId: string
  onClose: () => void
}) {
  const { colors } = useTheme()
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [verse, setVerse] = useState<QuranVerseData | null>(null)

  const sendMutation = useMutation({
    mutationFn: () => api.post(`/mosques/${mosqueId}/messages`, {
      subject: subject.trim() || undefined,
      body: body.trim(),
      ...(verse ?? {}),
    }),
    onSuccess: () => {
      Alert.alert('Message Sent', 'Your message has been sent to the mosque admin.')
      setSubject('')
      setBody('')
      setVerse(null)
      onClose()
    },
    onError: () => Alert.alert('Error', 'Could not send message. Please try again.'),
  })

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }}>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text }}>Message Mosque</Text>
            <TouchableOpacity
              onPress={() => sendMutation.mutate()}
              disabled={sendMutation.isPending || body.trim().length < 5}
            >
              <Text style={{ color: body.trim().length >= 5 ? colors.primary : colors.textTertiary, fontSize: 16, fontWeight: '600' }}>
                {sendMutation.isPending ? 'Sending...' : 'Send'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 16 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
              Your message will be sent privately to the admins of {mosqueName}.
            </Text>

            <View>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500', marginBottom: 6 }}>Subject (optional)</Text>
              <TextInput
                value={subject}
                onChangeText={setSubject}
                placeholder="e.g. Question about Friday prayer"
                placeholderTextColor={colors.textTertiary}
                style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.text }}
                maxLength={200}
              />
            </View>

            <View>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500', marginBottom: 6 }}>Message *</Text>
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="Write your message here..."
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.text, minHeight: 140 }}
                maxLength={2000}
              />
              <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 4, textAlign: 'right' }}>{body.length}/2000</Text>
            </View>

            <View>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500', marginBottom: 6 }}>Attach a Verse (optional)</Text>
              <QuranPicker verse={verse} onSelect={setVerse} />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

function InfoTab({ mosque }: { mosque: any }) {
  const { colors } = useTheme()
  const photos: any[] = mosque.photos ?? []
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const lightboxRef = useRef<FlatList>(null)

  // Scroll lightbox to tapped photo without animation (instant jump on open)
  useEffect(() => {
    if (lightboxIndex !== null && photos.length > 1) {
      setTimeout(() => {
        lightboxRef.current?.scrollToIndex({ index: lightboxIndex, animated: false })
      }, 30)
    }
  }, [lightboxIndex === null ? null : 'open']) // only fire on open

  return (
    <View>
      {mosque.description && (
        <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 22, marginBottom: 16 }}>
          {mosque.description}
        </Text>
      )}

      {[
        { icon: 'location', label: mosque.address, action: () => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(mosque.address)}`) },
        mosque.phone && { icon: 'call', label: mosque.phone, action: () => Linking.openURL(`tel:${mosque.phone}`) },
        mosque.email && { icon: 'mail', label: mosque.email, action: () => Linking.openURL(`mailto:${mosque.email}`) },
        mosque.imamName && { icon: 'person', label: `Imam: ${mosque.imamName}` },
        mosque.website && { icon: 'globe', label: mosque.website, action: () => Linking.openURL(mosque.website) },
      ]
        .filter(Boolean)
        .map((row: any, i: number) => (
          <TouchableOpacity
            key={i}
            onPress={row.action}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}
          >
            <Ionicons name={row.icon} size={17} color={colors.textSecondary} />
            <Text style={{ color: colors.text, fontSize: 14, marginLeft: 12, flex: 1 }}>{row.label}</Text>
            {row.action && <Ionicons name="chevron-forward" size={14} color={colors.border} />}
          </TouchableOpacity>
        ))}

      {/* Social media links */}
      {(mosque.facebookUrl || mosque.twitterUrl || mosque.instagramUrl || mosque.youtubeUrl) && (
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
          {mosque.facebookUrl && (
            <TouchableOpacity
              onPress={() => Linking.openURL(mosque.facebookUrl)}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(24,119,242,0.15)', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="logo-facebook" size={22} color="#1877F2" />
            </TouchableOpacity>
          )}
          {mosque.twitterUrl && (
            <TouchableOpacity
              onPress={() => Linking.openURL(mosque.twitterUrl)}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.08)', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="logo-twitter" size={22} color="#000000" />
            </TouchableOpacity>
          )}
          {mosque.instagramUrl && (
            <TouchableOpacity
              onPress={() => Linking.openURL(mosque.instagramUrl)}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(225,48,108,0.15)', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="logo-instagram" size={22} color="#E1306C" />
            </TouchableOpacity>
          )}
          {mosque.youtubeUrl && (
            <TouchableOpacity
              onPress={() => Linking.openURL(mosque.youtubeUrl)}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,0,0,0.12)', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="logo-youtube" size={22} color="#FF0000" />
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
        {mosque.hasWomensPrayer && <Badge label="Women's Prayer" />}
        {mosque.hasYouthPrograms && <Badge label="Youth Programs" />}
        {mosque.hasParking && <Badge label="Parking" />}
        {mosque.isAccessible && <Badge label="Accessible" />}
      </View>

      {mosque.languages?.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: '600', marginBottom: 8 }}>LANGUAGES</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {mosque.languages.map((lang: string) => <Badge key={lang} label={lang} />)}
          </View>
        </View>
      )}

      {mosque.amenities?.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: '600', marginBottom: 10 }}>AMENITIES</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {mosque.amenities.map((a: string) => {
              const key = a.toLowerCase()
              const emoji =
                key.includes('basketball') ? '🏀' :
                key.includes('football') ? '🏈' :
                key.includes('coffee') ? '☕' :
                key.includes('library') ? '📚' :
                key.includes('playground') ? '🛝' :
                key.includes('gym') ? '🏋️' :
                key.includes('cafeteria') ? '🍽️' :
                key.includes('funeral') ? '🕊️' :
                key.includes('wudu') ? '💧' :
                key.includes('classroom') ? '🏫' :
                key.includes('social hall') ? '🏛️' :
                key.includes('medical') ? '🏥' :
                key.includes('parking') ? '🅿️' :
                key.includes('accessible') ? '♿' :
                key.includes("women") ? '🕌' :
                '✓'
              return (
                <View
                  key={a}
                  style={{
                    width: '47%',
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 14,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Text style={{ fontSize: 16 }}>{emoji}</Text>
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: '500', flex: 1 }} numberOfLines={2}>
                    {a.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </Text>
                </View>
              )
            })}
          </View>
        </View>
      )}

      <ProgramsSection mosqueId={mosque.id} />

      {photos.length > 0 && (
        <View style={{ marginTop: 20 }}>
          <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: '600', marginBottom: 10 }}>
            PHOTOS · {photos.length}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -20 }}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
          >
            {photos.map((photo: any, i: number) => (
              <TouchableOpacity
                key={photo.id}
                onPress={() => setLightboxIndex(i)}
                activeOpacity={0.85}
              >
                <Image
                  source={{ uri: photo.url }}
                  style={{ width: 180, height: 120, borderRadius: 12 }}
                  contentFit="cover"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Lightbox ─────────────────────────────────────────────── */}
      <Modal
        visible={lightboxIndex !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setLightboxIndex(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.96)' }}>
          {/* Top bar */}
          <SafeAreaView edges={['top']}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10 }}>
              <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14 }}>
                {lightboxIndex !== null ? `${lightboxIndex + 1} / ${photos.length}` : ''}
              </Text>
              <TouchableOpacity
                onPress={() => setLightboxIndex(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={26} color="white" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>

          {/* Swipeable full-screen photos */}
          <FlatList
            ref={lightboxRef}
            data={photos}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            getItemLayout={(_, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W)
              setLightboxIndex(idx)
            }}
            style={{ flex: 1 }}
            renderItem={({ item }) => (
              <View style={{ width: SCREEN_W, flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Image
                  source={{ uri: item.url }}
                  style={{ width: SCREEN_W, height: SCREEN_W * 0.85 }}
                  contentFit="contain"
                />
                {item.caption ? (
                  <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 14, textAlign: 'center', paddingHorizontal: 24 }}>
                    {item.caption}
                  </Text>
                ) : null}
              </View>
            )}
          />

          {/* Dot indicators */}
          {photos.length > 1 && (
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingBottom: 32 }}>
              {photos.map((_, i) => (
                <View
                  key={i}
                  style={{
                    width: i === lightboxIndex ? 20 : 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: i === lightboxIndex ? 'white' : 'rgba(255,255,255,0.3)',
                  }}
                />
              ))}
            </View>
          )}
        </View>
      </Modal>
    </View>
  )
}

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function EventsTab({ mosqueId }: { mosqueId: string }) {
  const { colors } = useTheme()
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [month, setMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const { data } = useQuery({
    queryKey: ['mosque-events', mosqueId, viewMode === 'calendar' ? 'all' : 'upcoming'],
    queryFn: () =>
      viewMode === 'calendar'
        ? api.get(`/mosques/${mosqueId}/events?upcoming=false&limit=100`)
        : api.get(`/mosques/${mosqueId}/events?upcoming=true`),
  })
  const events: any[] = data?.data?.items ?? []

  // Days in the viewed month
  const calendarDays = useMemo(() => {
    const start = startOfMonth(month)
    const end = endOfMonth(month)
    const days = eachDayOfInterval({ start, end })
    // Pad with nulls for starting weekday
    const padBefore = Array(start.getDay()).fill(null)
    return [...padBefore, ...days]
  }, [month])

  // Events on a specific day
  const eventsOnDay = (day: Date) =>
    events.filter((e) => isSameDay(new Date(e.startTime), day))

  // Events to show in list (either selected day or all)
  const listEvents = selectedDay
    ? eventsOnDay(selectedDay)
    : viewMode === 'calendar'
    ? events.filter((e) => isSameMonth(new Date(e.startTime), month))
    : events

  return (
    <View>
      {/* Toggle */}
      <View style={{ flexDirection: 'row', backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 3, marginBottom: 16, alignSelf: 'flex-start' }}>
        {(['list', 'calendar'] as const).map((mode) => (
          <TouchableOpacity
            key={mode}
            onPress={() => { setViewMode(mode); setSelectedDay(null) }}
            style={{
              paddingHorizontal: 16, paddingVertical: 6, borderRadius: 10,
              backgroundColor: viewMode === mode ? colors.surface : 'transparent',
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: viewMode === mode ? colors.text : colors.textTertiary }}>
              {mode === 'list' ? '☰ List' : '📅 Calendar'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {viewMode === 'calendar' && (
        <View style={{ marginBottom: 12 }}>
          {/* Month nav */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <TouchableOpacity onPress={() => { setMonth(subMonths(month, 1)); setSelectedDay(null) }} style={{ padding: 6 }}>
              <Ionicons name="chevron-back" size={18} color={colors.primary} />
            </TouchableOpacity>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
              {format(month, 'MMMM yyyy')}
            </Text>
            <TouchableOpacity onPress={() => { setMonth(addMonths(month, 1)); setSelectedDay(null) }} style={{ padding: 6 }}>
              <Ionicons name="chevron-forward" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Day labels */}
          <View style={{ flexDirection: 'row' }}>
            {DAY_LABELS.map((d) => (
              <View key={d} style={{ flex: 1, alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textTertiary }}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Calendar grid */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {calendarDays.map((day, idx) => {
              if (!day) return <View key={`pad-${idx}`} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />
              const dayEvents = eventsOnDay(day)
              const hasEvents = dayEvents.length > 0
              const isSelected = selectedDay ? isSameDay(day, selectedDay) : false
              const isToday = isSameDay(day, new Date())
              return (
                <TouchableOpacity
                  key={day.toISOString()}
                  onPress={() => setSelectedDay(isSelected ? null : day)}
                  style={{
                    width: `${100 / 7}%`, aspectRatio: 1,
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <View style={{
                    width: 32, height: 32, borderRadius: 16,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: isSelected ? colors.primary : isToday ? colors.primaryLight : 'transparent',
                  }}>
                    <Text style={{
                      fontSize: 13, fontWeight: hasEvents ? '700' : '400',
                      color: isSelected ? colors.primaryContrast : isToday ? colors.primary : colors.text,
                    }}>{format(day, 'd')}</Text>
                  </View>
                  {hasEvents && (
                    <View style={{
                      width: 4, height: 4, borderRadius: 2,
                      backgroundColor: isSelected ? colors.primaryContrast : colors.primary,
                      marginTop: 1,
                    }} />
                  )}
                </TouchableOpacity>
              )
            })}
          </View>

          {selectedDay && (
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 8, marginBottom: 4 }}>
              {format(selectedDay, 'EEEE, MMMM d')} · {eventsOnDay(selectedDay).length} event{eventsOnDay(selectedDay).length !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
      )}

      {/* Event list */}
      {listEvents.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
          <Text style={{ color: colors.textTertiary, fontSize: 14 }}>
            {selectedDay ? 'No events on this day' : 'No upcoming events'}
          </Text>
        </View>
      ) : (
        <View>{listEvents.map((e: any) => <EventCard key={e.id} item={e} />)}</View>
      )}
    </View>
  )
}

function AnnouncementsTab({ mosqueId }: { mosqueId: string }) {
  const { colors } = useTheme()
  const { data } = useQuery({
    queryKey: ['mosque-announcements', mosqueId],
    queryFn: () => api.get(`/mosques/${mosqueId}/announcements`),
  })
  const items = data?.data?.items ?? []
  if (!items.length) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 40 }}>
        <Text style={{ color: colors.textTertiary, fontSize: 14 }}>No announcements</Text>
      </View>
    )
  }
  return <View>{items.map((a: any) => <AnnouncementCard key={a.id} item={a} compact />)}</View>
}

function ServicesTab({ mosqueId }: { mosqueId: string }) {
  const { colors } = useTheme()
  const { isSignedIn, userId } = useAuth()
  const { user } = useUser()
  const [requestingService, setRequestingService] = useState<any>(null)
  const [reqName, setReqName] = useState('')
  const [reqPhone, setReqPhone] = useState('')
  const [reqMessage, setReqMessage] = useState('')

  const { data } = useQuery({
    queryKey: ['mosque-services', mosqueId],
    queryFn: () => api.get(`/mosques/${mosqueId}/services`),
  })
  const services: any[] = data?.data?.items ?? []

  const requestMutation = useMutation({
    mutationFn: (svc: any) =>
      api.post(`/mosques/${mosqueId}/services/${svc.id}/requests`, {
        name: reqName,
        phone: reqPhone || undefined,
        message: reqMessage,
      }),
    onSuccess: () => {
      setRequestingService(null)
      setReqName('')
      setReqPhone('')
      setReqMessage('')
      Alert.alert('Request Sent', 'The mosque will review your request and get back to you.')
    },
    onError: () => Alert.alert('Error', 'Could not send request. Please try again.'),
  })

  function openRequest(svc: any) {
    setRequestingService(svc)
    setReqName(user?.fullName ?? '')
    setReqPhone('')
    setReqMessage('')
  }

  if (!services.length) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 40 }}>
        <Text style={{ color: colors.textTertiary, fontSize: 14 }}>No services listed</Text>
      </View>
    )
  }

  return (
    <View style={{ gap: 10 }}>
      {services.map((svc: any) => (
        <View
          key={svc.id}
          style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 }}>{svc.name}</Text>
            {svc.pricing && (
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600', marginLeft: 8 }}>{svc.pricing}</Text>
            )}
          </View>
          {svc.description && (
            <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 6 }}>{svc.description}</Text>
          )}
          {svc.schedule && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="calendar-outline" size={13} color={colors.textTertiary} />
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{svc.schedule}</Text>
            </View>
          )}
          {svc.contact && (
            <TouchableOpacity
              onPress={() => Linking.openURL(`tel:${svc.contact}`)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}
            >
              <Ionicons name="call-outline" size={13} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 12 }}>{svc.contact}</Text>
            </TouchableOpacity>
          )}
          {svc.registration && (
            <View style={{ marginTop: 6, backgroundColor: colors.primaryLight, borderRadius: 8, padding: 8 }}>
              <Text style={{ color: colors.primary, fontSize: 12 }}>📋 {svc.registration}</Text>
            </View>
          )}
          <TouchableOpacity
            onPress={() => openRequest(svc)}
            style={{ marginTop: 10, backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 9, alignItems: 'center' }}
          >
            <Text style={{ color: colors.primaryContrast, fontWeight: '600', fontSize: 13 }}>Request This Service</Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* Service request modal */}
      <Modal
        visible={!!requestingService}
        animationType="slide"
        transparent
        onRequestClose={() => setRequestingService(null)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
            activeOpacity={1}
            onPress={() => setRequestingService(null)}
          />
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 4 }}>
              {requestingService?.name}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 20 }}>
              Fill in your details and we'll forward your request to the mosque.
            </Text>

            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6 }}>Your Name *</Text>
            <TextInput
              value={reqName}
              onChangeText={setReqName}
              placeholder="Full name"
              placeholderTextColor={colors.textTertiary}
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: colors.text, backgroundColor: colors.inputBackground, marginBottom: 14 }}
            />

            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6 }}>Phone (optional)</Text>
            <TextInput
              value={reqPhone}
              onChangeText={setReqPhone}
              placeholder="+1 (555) 000-0000"
              keyboardType="phone-pad"
              placeholderTextColor={colors.textTertiary}
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: colors.text, backgroundColor: colors.inputBackground, marginBottom: 14 }}
            />

            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6 }}>Message *</Text>
            <TextInput
              value={reqMessage}
              onChangeText={setReqMessage}
              placeholder="Tell the mosque what you need..."
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={4}
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: colors.text, backgroundColor: colors.inputBackground, minHeight: 90, textAlignVertical: 'top', marginBottom: 20 }}
            />

            <TouchableOpacity
              onPress={() => requestMutation.mutate(requestingService)}
              disabled={!reqName.trim() || !reqMessage.trim() || requestMutation.isPending}
              style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', opacity: (!reqName.trim() || !reqMessage.trim()) ? 0.5 : 1 }}
            >
              {requestMutation.isPending
                ? <ActivityIndicator color={colors.primaryContrast} />
                : <Text style={{ color: colors.primaryContrast, fontWeight: '700', fontSize: 15 }}>Send Request</Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

function PollsTab({ mosqueId }: { mosqueId: string }) {
  const { colors } = useTheme()
  const queryKey = ['mosque-polls', mosqueId]
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => api.get(`/mosques/${mosqueId}/polls`),
    staleTime: 30_000,
  })
  const polls: any[] = data?.data?.items ?? []

  if (isLoading) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 40 }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  if (!polls.length) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 40 }}>
        <Text style={{ fontSize: 32, marginBottom: 8 }}>📊</Text>
        <Text style={{ color: colors.textTertiary, fontSize: 14 }}>No polls yet</Text>
      </View>
    )
  }

  return (
    <View style={{ gap: 0 }}>
      {polls.map((poll: any) => (
        <PollCard key={poll.id} poll={poll} queryKey={queryKey} />
      ))}
    </View>
  )
}

function DocumentsTab({ mosqueId }: { mosqueId: string }) {
  const { colors } = useTheme()
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['mosque-documents', mosqueId],
    queryFn: () => api.get(`/mosques/${mosqueId}/documents`),
  })
  const docs: any[] = data?.data?.items ?? []

  function formatBytes(bytes: number) {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function fileIcon(mime?: string | null) {
    if (!mime) return '📄'
    if (mime === 'application/pdf') return '📕'
    if (mime.startsWith('image/')) return '🖼️'
    if (mime.includes('word')) return '📝'
    if (mime.includes('excel') || mime.includes('spreadsheet')) return '📊'
    return '📄'
  }

  function fileExtension(mime?: string | null) {
    if (!mime) return 'file'
    if (mime === 'application/pdf') return 'pdf'
    if (mime.startsWith('image/jpeg')) return 'jpg'
    if (mime.startsWith('image/png')) return 'png'
    if (mime.includes('word')) return 'docx'
    if (mime.includes('excel') || mime.includes('spreadsheet')) return 'xlsx'
    return 'file'
  }

  // Bug 1 fix: download file using expo-file-system then share/open with expo-sharing
  async function handleDownload(doc: any) {
    if (downloadingId) return
    setDownloadingId(doc.id)
    try {
      const ext = fileExtension(doc.mimeType)
      const safeName = (doc.name ?? 'document').replace(/[^a-zA-Z0-9_\-]/g, '_')
      const localUri = `${FileSystem.cacheDirectory}${safeName}.${ext}`

      const downloadResumable = FileSystem.createDownloadResumable(
        doc.fileUrl,
        localUri,
        {},
        (progress) => {
          // progress updates available but we just show spinner
        }
      )

      const result = await downloadResumable.downloadAsync()
      if (!result?.uri) throw new Error('Download failed')

      const canShare = await Sharing.isAvailableAsync()
      if (canShare) {
        await Sharing.shareAsync(result.uri, {
          mimeType: doc.mimeType ?? 'application/octet-stream',
          dialogTitle: doc.name ?? 'Open document',
          UTI: doc.mimeType === 'application/pdf' ? 'com.adobe.pdf' : undefined,
        })
      } else {
        Alert.alert('Downloaded', `"${doc.name}" saved to your device.`)
      }
    } catch (err: any) {
      Alert.alert('Download failed', err?.message ?? 'Could not download the file. Please try again.')
    } finally {
      setDownloadingId(null)
    }
  }

  if (isLoading) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 40 }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  if (!docs.length) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 40 }}>
        <Text style={{ fontSize: 32, marginBottom: 8 }}>📂</Text>
        <Text style={{ color: colors.textTertiary, fontSize: 14 }}>No documents uploaded yet</Text>
      </View>
    )
  }

  return (
    <View style={{ gap: 10 }}>
      {docs.map((doc: any) => {
        const isDownloading = downloadingId === doc.id
        return (
          <TouchableOpacity
            key={doc.id}
            onPress={() => handleDownload(doc)}
            disabled={!!downloadingId}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 14,
              borderWidth: 1,
              borderColor: colors.border,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              opacity: downloadingId && !isDownloading ? 0.6 : 1,
            }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 26 }}>{fileIcon(doc.mimeType)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }} numberOfLines={2}>
                {doc.name}
              </Text>
              <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>
                {doc.fileSize ? formatBytes(doc.fileSize) + ' · ' : ''}
                {new Date(doc.createdAt).toLocaleDateString()}
              </Text>
            </View>
            {isDownloading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="download-outline" size={20} color={colors.primary} />
            )}
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

function Badge({ label }: { label: string }) {
  const { colors } = useTheme()
  return (
    <View style={{ backgroundColor: colors.primaryLight, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 }}>
      <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '500' }}>{label}</Text>
    </View>
  )
}

function ProgramsSection({ mosqueId }: { mosqueId: string }) {
  const { colors } = useTheme()
  const [expandedPrograms, setExpandedPrograms] = useState<Set<string>>(new Set())
  const { data } = useQuery({
    queryKey: ['mosque-programs-public', mosqueId],
    queryFn: () => api.get(`/mosques/${mosqueId}/programs`),
    staleTime: 60_000,
  })
  const programs: any[] = data?.data?.items?.filter((p: any) => p.isActive) ?? []
  if (programs.length === 0) return null

  function toggleExpanded(id: string) {
    setExpandedPrograms((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <View style={{ marginTop: 20 }}>
      <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: '600', marginBottom: 10 }}>PROGRAMS OFFERED</Text>
      <View style={{ gap: 10 }}>
        {programs.map((program: any) => {
          const isExpanded = expandedPrograms.has(program.id)
          const isLong = program.description && program.description.length > 80
          return (
            <View
              key={program.id}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 14,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600', flex: 1 }}>{program.name}</Text>
                {program.ageGroup && (
                  <View style={{ backgroundColor: colors.primaryLight, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 }}>
                    <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '600' }}>{program.ageGroup}</Text>
                  </View>
                )}
              </View>
              {program.description && (
                <>
                  <Text
                    numberOfLines={isExpanded ? undefined : 2}
                    style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19 }}
                  >
                    {program.description}
                  </Text>
                  {isLong && (
                    <TouchableOpacity onPress={() => toggleExpanded(program.id)} style={{ marginTop: 4 }}>
                      <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>
                        {isExpanded ? 'See less' : 'See more'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
              {program.schedule && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <Ionicons name="time-outline" size={13} color={colors.textTertiary} />
                  <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{program.schedule}</Text>
                </View>
              )}
            </View>
          )
        })}
      </View>
    </View>
  )
}
