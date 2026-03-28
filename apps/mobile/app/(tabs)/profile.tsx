import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Switch, Platform, Modal, TextInput } from 'react-native'
import { useAuth, useUser, useClerk } from '@clerk/clerk-expo'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api'
import { useTheme } from '../../contexts/ThemeContext'
import { MADHAB_KEY } from './prayer'
import { TIME_FORMAT_KEY, useTimeFormat } from '../../hooks/useTimeFormat'

export default function ProfileScreen() {
  const { signOut: clerkSignOut } = useClerk()
  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const queryClient = useQueryClient()
  const [signingOut, setSigningOut] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({ birthdate: '', gender: '' as '' | 'MALE' | 'FEMALE' | 'PREFER_NOT_TO_SAY', isOpenToVolunteer: false, isOpenToMarriage: false })
  const [showDatePicker, setShowDatePicker] = useState(false)
  const { colors, mode, setMode } = useTheme()
  const { t } = useTranslation()

  const { data: follows } = useQuery({
    queryKey: ['followed-mosques'],
    queryFn: () => api.get('/users/me/follows'),
    staleTime: 30_000,
  })

  const { data: meData } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/users/me'),
    staleTime: 60_000,
  })

  // Bug 2 fix: show badge for threads that have an admin reply (new response)
  const { data: messagesData } = useQuery({
    queryKey: ['messages-unread-count'],
    queryFn: async () => {
      const res = await api.get('/users/me/messages')
      const items: any[] = res.data?.items ?? []
      // Count threads where admin has replied (fromAdmin reply exists)
      return items.filter((m: any) =>
        Array.isArray(m.replies) && m.replies.some((r: any) => r.fromAdmin)
      ).length
    },
    refetchInterval: 30000,
    staleTime: 15_000,
  })
  const unreadMessagesCount = messagesData ?? 0

  const madhabPreference = meData?.data?.madhabPreference ?? 'STANDARD'

  const madhabMutation = useMutation({
    mutationFn: (pref: string) => api.patch('/users/me', { madhabPreference: pref }),
    onSuccess: (res) => {
      const saved = res.data.madhabPreference as string
      AsyncStorage.setItem(MADHAB_KEY, saved)
      queryClient.setQueryData(['me'], (old: any) =>
        old ? { ...old, data: { ...old.data, madhabPreference: saved } } : old
      )
      queryClient.invalidateQueries({ queryKey: ['me'] })
    },
    onError: () => {
      Alert.alert('Error', 'Could not update prayer calculation method. Please try again.')
    },
  })

  const profileMutation = useMutation({
    mutationFn: (data: { birthdate?: string | null; gender?: string | null; isOpenToVolunteer: boolean; isOpenToMarriage: boolean }) =>
      api.patch('/users/me', {
        birthdate: data.birthdate ? new Date(data.birthdate).toISOString() : null,
        gender: data.gender || null,
        isOpenToVolunteer: data.isOpenToVolunteer,
        isOpenToMarriage: data.isOpenToMarriage,
      }),
    onSuccess: (res) => {
      queryClient.setQueryData(['me'], (old: any) =>
        old ? { ...old, data: { ...old.data, ...res.data } } : old
      )
      setEditingProfile(false)
    },
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.message ?? err?.message ?? 'Could not save profile. Please try again.'),
  })

  useEffect(() => {
    if (meData?.data) {
      const d = meData.data
      setProfileForm({
        birthdate: d.birthdate ? new Date(d.birthdate).toISOString().slice(0, 10) : '',
        gender: d.gender ?? '',
        isOpenToVolunteer: d.isOpenToVolunteer ?? false,
        isOpenToMarriage: d.isOpenToMarriage ?? false,
      })
    }
  }, [meData])

  const { is24h } = useTimeFormat()

  function handleTimeFormatChange() {
    const next = is24h ? '12h' : '24h'
    const label = next === '24h' ? '24-hour clock' : '12-hour (AM/PM)'
    Alert.alert(
      'Time Format',
      `Switch to ${label}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          onPress: async () => {
            await AsyncStorage.setItem(TIME_FORMAT_KEY, next)
            queryClient.setQueryData(['time-format'], next)
          },
        },
      ]
    )
  }

  function handleMadhabChange() {
    const next = madhabPreference === 'STANDARD' ? 'HANAFI' : 'STANDARD'
    const label = next === 'HANAFI' ? 'Hanafi (later Asr)' : 'Shafi / Maliki / Hanbali (earlier Asr)'
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if ((globalThis as any).confirm(`Switch to ${label}?`)) {
        madhabMutation.mutate(next)
      }
      return
    }
    Alert.alert(
      'Prayer Calculation Method',
      `Switch to ${label}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Switch', onPress: () => madhabMutation.mutate(next) },
      ]
    )
  }

  const { data: adminData } = useQuery({
    queryKey: ['admin-mosques'],
    queryFn: () => api.get<any>('/users/me/admin-mosques'),
    staleTime: 60_000,
  })
  const isAdmin = (adminData?.data?.isSuperAdmin) || ((adminData?.data?.items?.length ?? 0) > 0)

  const followedMosques = follows?.data?.items ?? []

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true)
          try {
            queryClient.clear()
            await clerkSignOut()
            router.replace('/(auth)/sign-in' as any)
          } catch {
            setSigningOut(false)
            Alert.alert('Error', 'Could not sign out. Please try again.')
          }
        },
      },
    ])
  }

  const madhabLabel = madhabPreference === 'HANAFI' ? 'Hanafi' : 'Shafi / Maliki / Hanbali'

  const sectionLabelStyle = {
    fontSize: 11, fontWeight: '700' as const, color: colors.textTertiary,
    letterSpacing: 0.8, paddingHorizontal: 20, marginBottom: 8,
  }
  const cardStyle = {
    marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: 20,
    borderWidth: 1, borderColor: colors.borderLight, marginBottom: 20,
    shadowColor: colors.primary, shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 3 }, shadowRadius: 10, elevation: 2,
  }

  // ── Resource items ──────────────────────────────────────────────────────────
  const resourceItems = [
    { icon: 'bookmark', label: t('profile_followed_mosques'), badge: followedMosques.length, onPress: () => router.push('/(tabs)/discover') },
    { icon: 'calendar', label: t('profile_my_rsvps'), onPress: () => router.push('/rsvps') },
    { icon: 'heart', label: 'Donation History', onPress: () => router.push('/donation-history') },
    { icon: 'mail', label: t('profile_messages'), badge: unreadMessagesCount, onPress: () => router.push('/messages') },
    { icon: 'book', label: t('profile_quran'), onPress: () => router.push('/quran') },
    { icon: 'chatbubble-ellipses', label: t('profile_islamic_ai'), onPress: () => router.push('/chat') },
    { icon: 'compass', label: t('profile_qibla'), onPress: () => router.push('/qibla') },
    { icon: 'book', label: t('profile_athkar'), onPress: () => router.push('/athkar') },
  ]

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── Profile header ─────────────────────────────────────────────── */}
        <View style={{ alignItems: 'center', paddingTop: 32, paddingBottom: 28 }}>
          {isSignedIn ? (
            /* Sign out button — only when signed in */
            <TouchableOpacity
              onPress={handleSignOut}
              disabled={signingOut}
              style={{ position: 'absolute', top: 16, right: 16 }}
            >
              {signingOut
                ? <ActivityIndicator size="small" color="#EF4444" />
                : <Text style={{ color: '#EF4444', fontSize: 14, fontWeight: '600' }}>{t('profile_sign_out')}</Text>
              }
            </TouchableOpacity>
          ) : null}

          <View style={{ position: 'relative', marginBottom: 14 }}>
            {isSignedIn && user?.imageUrl ? (
              <Image
                source={{ uri: user.imageUrl }}
                style={{ width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: colors.primaryLight }}
                contentFit="cover"
              />
            ) : (
              <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.primaryLight }}>
                {isSignedIn
                  ? <Text style={{ color: colors.primaryContrast, fontSize: 30, fontWeight: '800' }}>{user?.firstName?.[0] ?? '?'}</Text>
                  : <Ionicons name="person-outline" size={36} color={colors.primaryContrast} />
                }
              </View>
            )}
          </View>

          <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.4 }}>
            {isSignedIn ? (user?.fullName ?? 'User') : 'Guest'}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 3, fontWeight: '500' }}>
            {isSignedIn ? user?.primaryEmailAddress?.emailAddress : 'Browsing without an account'}
          </Text>

          {!isSignedIn && (
            <TouchableOpacity
              onPress={() => router.replace('/(auth)/sign-in' as any)}
              style={{
                marginTop: 16, backgroundColor: colors.primary,
                borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32,
              }}
              activeOpacity={0.8}
            >
              <Text style={{ color: colors.primaryContrast, fontWeight: '700', fontSize: 15 }}>Sign In</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Admin shortcut (only for mosque admins) ────────────────────── */}
        {isSignedIn && isAdmin && (
          <TouchableOpacity
            onPress={() => router.replace('/admin' as any)}
            activeOpacity={0.82}
            style={{
              marginHorizontal: 16, marginBottom: 20,
              backgroundColor: colors.primary, borderRadius: 18,
              paddingVertical: 16, paddingHorizontal: 20,
              flexDirection: 'row', alignItems: 'center',
              shadowColor: colors.primary, shadowOpacity: 0.3,
              shadowOffset: { width: 0, height: 6 }, shadowRadius: 14, elevation: 6,
            }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
              <Ionicons name="grid-outline" size={20} color="white" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: 'white', fontWeight: '800', fontSize: 15 }}>Manage Mosque</Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 1 }}>Switch to admin dashboard</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        )}

        {/* ── SECTION A: RESOURCES ───────────────────────────────────────── */}
        <Text style={sectionLabelStyle}>{t('profile_resources')}</Text>

        <View style={cardStyle}>
          {resourceItems.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              onPress={item.onPress}
              activeOpacity={0.75}
              style={{
                flexDirection: 'row', alignItems: 'center',
                paddingHorizontal: 16, paddingVertical: 15,
                borderBottomWidth: i < resourceItems.length - 1 ? 1 : 0,
                borderBottomColor: colors.borderLight,
              }}
            >
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 13 }}>
                <Ionicons name={item.icon as any} size={17} color={colors.primary} />
              </View>
              <Text style={{ flex: 1, color: colors.text, fontSize: 15, fontWeight: '500' }}>{item.label}</Text>
              {item.badge !== undefined && item.badge > 0 && (
                <View style={{ backgroundColor: colors.primaryLight, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginRight: 8 }}>
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>{item.badge}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={15} color={colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>

        {/* ── SECTION B: ACCOUNT ─────────────────────────────────────────── */}
        <Text style={sectionLabelStyle}>{t('profile_account')}</Text>

        <View style={cardStyle}>
          {/* Personal Information — edit card */}
          {!editingProfile ? (
            <TouchableOpacity onPress={() => setEditingProfile(true)} activeOpacity={0.75}
              style={{ paddingHorizontal: 16, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 13 }}>
                <Ionicons name="person-outline" size={17} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }}>Personal Information</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>
                  {[
                    profileForm.birthdate ? new Date(profileForm.birthdate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null,
                    profileForm.gender === 'MALE' ? 'Male' : profileForm.gender === 'FEMALE' ? 'Female' : profileForm.gender === 'PREFER_NOT_TO_SAY' ? 'Prefer not to say' : null,
                    profileForm.isOpenToVolunteer ? 'Open to volunteer' : null,
                    profileForm.isOpenToMarriage ? 'Open to marriage' : null,
                  ].filter(Boolean).join(' · ') || 'Tap to add'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={15} color={colors.textTertiary} />
            </TouchableOpacity>
          ) : (
            <View style={{ paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
              {/* Birthdate */}
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>Birthday</Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                style={{
                  backgroundColor: colors.background,
                  borderWidth: 1, borderColor: colors.border, borderRadius: 12,
                  paddingHorizontal: 14, paddingVertical: 12,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 16,
                }}
              >
                <Text style={{ fontSize: 14, color: profileForm.birthdate ? colors.text : colors.textTertiary }}>
                  {profileForm.birthdate
                    ? new Date(profileForm.birthdate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                    : 'Select birthday'}
                </Text>
                <Ionicons name="calendar-outline" size={18} color={colors.textTertiary} />
              </TouchableOpacity>

              <BirthdayPicker
                visible={showDatePicker}
                value={profileForm.birthdate}
                onConfirm={(dateStr) => { setProfileForm(f => ({ ...f, birthdate: dateStr })); setShowDatePicker(false) }}
                onCancel={() => setShowDatePicker(false)}
                colors={colors}
              />

              {/* Gender */}
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>Gender</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                {([
                  { value: 'MALE', label: 'Male' },
                  { value: 'FEMALE', label: 'Female' },
                  { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
                ] as const).map(({ value, label }) => (
                  <TouchableOpacity
                    key={value}
                    onPress={() => setProfileForm((f) => ({ ...f, gender: f.gender === value ? '' : value }))}
                    style={{
                      flex: 1, paddingVertical: 8, borderRadius: 12, alignItems: 'center',
                      backgroundColor: profileForm.gender === value ? colors.primary : colors.inputBackground ?? colors.background,
                      borderWidth: 1,
                      borderColor: profileForm.gender === value ? colors.primary : colors.border,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: profileForm.gender === value ? 'white' : colors.textSecondary }}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Volunteer */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }}>Open to volunteer opportunities</Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>Mosques can reach out to you for volunteer roles</Text>
                </View>
                <Switch
                  value={profileForm.isOpenToVolunteer}
                  onValueChange={(v) => setProfileForm((f) => ({ ...f, isOpenToVolunteer: v }))}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="white"
                />
              </View>

              {/* Marriage */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }}>Open to finding a spouse</Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>Mosques may connect you with others looking for a partner</Text>
                </View>
                <Switch
                  value={profileForm.isOpenToMarriage}
                  onValueChange={(v) => setProfileForm((f) => ({ ...f, isOpenToMarriage: v }))}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="white"
                />
              </View>

              {/* Actions */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  onPress={() => setEditingProfile(false)}
                  style={{ flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}
                >
                  <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 14 }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => profileMutation.mutate(profileForm)}
                  disabled={profileMutation.isPending}
                  style={{ flex: 2, paddingVertical: 12, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', opacity: profileMutation.isPending ? 0.6 : 1 }}
                >
                  <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>
                    {profileMutation.isPending ? 'Saving…' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Account Settings — email, password, name */}
          <TouchableOpacity
            onPress={() => router.push('/account-settings')}
            activeOpacity={0.75}
            style={{ paddingHorizontal: 16, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.borderLight }}
          >
            <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 13 }}>
              <Ionicons name="mail-outline" size={17} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }}>{t('profile_email_password')}</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                {user?.primaryEmailAddress?.emailAddress ?? '—'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={15} color={colors.textTertiary} />
          </TouchableOpacity>

          {/* Notification Settings */}
          <TouchableOpacity
            onPress={() => router.push('/notification-settings')}
            activeOpacity={0.75}
            style={{ paddingHorizontal: 16, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.borderLight }}
          >
            <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 13 }}>
              <Ionicons name="notifications-outline" size={17} color={colors.primary} />
            </View>
            <Text style={{ flex: 1, color: colors.text, fontSize: 15, fontWeight: '500' }}>{t('profile_notification_settings')}</Text>
            <Ionicons name="chevron-forward" size={15} color={colors.textTertiary} />
          </TouchableOpacity>

          {/* Privacy Settings */}
          <TouchableOpacity
            onPress={() => router.push('/privacy')}
            activeOpacity={0.75}
            style={{ paddingHorizontal: 16, paddingVertical: 15, flexDirection: 'row', alignItems: 'center' }}
          >
            <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 13 }}>
              <Ionicons name="shield-checkmark-outline" size={17} color={colors.primary} />
            </View>
            <Text style={{ flex: 1, color: colors.text, fontSize: 15, fontWeight: '500' }}>{t('profile_privacy_settings')}</Text>
            <Ionicons name="chevron-forward" size={15} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* ── SECTION C: SETTINGS ────────────────────────────────────────── */}
        <Text style={sectionLabelStyle}>{t('profile_settings')}</Text>

        <View style={cardStyle}>
          {/* Prayer Settings — Asr Calculation */}
          <TouchableOpacity
            onPress={handleMadhabChange}
            disabled={madhabMutation.isPending}
            activeOpacity={0.75}
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}
          >
            <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 13 }}>
              <Ionicons name="time-outline" size={17} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }}>{t('profile_asr_calculation')}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>{madhabLabel} — tap to change</Text>
            </View>
            {madhabMutation.isPending
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Ionicons name="chevron-forward" size={15} color={colors.textTertiary} />
            }
          </TouchableOpacity>

          {/* Time Format */}
          <TouchableOpacity
            onPress={handleTimeFormatChange}
            activeOpacity={0.75}
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}
          >
            <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 13 }}>
              <Ionicons name="time-outline" size={17} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }}>Time Format</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>{is24h ? '24-hour clock' : '12-hour (AM/PM)'} — tap to change</Text>
            </View>
            <Ionicons name="chevron-forward" size={15} color={colors.textTertiary} />
          </TouchableOpacity>

          {/* Appearance — Dark mode */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
            <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#1F2937', alignItems: 'center', justifyContent: 'center', marginRight: 13 }}>
              <Ionicons name="moon-outline" size={17} color="white" />
            </View>
            <Text style={{ flex: 1, color: colors.text, fontSize: 15, fontWeight: '500' }}>{t('profile_dark_mode')}</Text>
            <Switch
              value={mode === 'dark'}
              onValueChange={val => setMode(val ? 'dark' : 'light')}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="white"
            />
          </View>

          {/* Appearance — Use System Setting */}
          <TouchableOpacity
            onPress={() => setMode('system')}
            activeOpacity={0.75}
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}
          >
            <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center', marginRight: 13 }}>
              <Ionicons name="phone-portrait-outline" size={17} color="#7C3AED" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }}>{t('profile_use_system')}</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>
                {mode === 'system' ? 'Active — following device preference' : 'Follow device preference'}
              </Text>
            </View>
            {mode === 'system' && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
          </TouchableOpacity>

          {/* Language */}
          <TouchableOpacity
            onPress={() => router.push('/language')}
            activeOpacity={0.75}
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}
          >
            <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 13 }}>
              <Ionicons name="language-outline" size={17} color={colors.primary} />
            </View>
            <Text style={{ flex: 1, color: colors.text, fontSize: 15, fontWeight: '500' }}>{t('profile_language')}</Text>
            <Ionicons name="chevron-forward" size={15} color={colors.textTertiary} />
          </TouchableOpacity>

          {/* Help & Support */}
          <TouchableOpacity
            onPress={() => router.push('/help')}
            activeOpacity={0.75}
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 15 }}
          >
            <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 13 }}>
              <Ionicons name="help-circle-outline" size={17} color={colors.primary} />
            </View>
            <Text style={{ flex: 1, color: colors.text, fontSize: 15, fontWeight: '500' }}>{t('profile_help_support')}</Text>
            <Ionicons name="chevron-forward" size={15} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Birthday Picker ─────────────────────────────────────────────────────────

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function BirthdayPicker({ visible, value, onConfirm, onCancel, colors }: {
  visible: boolean
  value: string
  onConfirm: (dateStr: string) => void
  onCancel: () => void
  colors: any
}) {
  const currentYear = new Date().getFullYear()
  const parsed = value ? new Date(value + 'T12:00:00') : new Date(2000, 0, 1)
  const [month, setMonth] = useState(parsed.getMonth())
  const [day, setDay] = useState(parsed.getDate())
  const [year, setYear] = useState(parsed.getFullYear())

  useEffect(() => {
    if (visible) {
      const d = value ? new Date(value + 'T12:00:00') : new Date(2000, 0, 1)
      setMonth(d.getMonth())
      setDay(d.getDate())
      setYear(d.getFullYear())
    }
  }, [visible])

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const clampedDay = Math.min(day, daysInMonth)

  function handleConfirm() {
    onConfirm(`${year}-${String(month + 1).padStart(2,'0')}-${String(clampedDay).padStart(2,'0')}`)
  }

  function adjustYear(delta: number) {
    setYear(y => Math.max(currentYear - 100, Math.min(currentYear, y + delta)))
  }
  function adjustDay(delta: number) {
    setDay(d => Math.max(1, Math.min(daysInMonth, d + delta)))
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' }}>
        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 36 }}>

          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={onCancel} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 15 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ fontWeight: '700', fontSize: 16, color: colors.text }}>Birthday</Text>
            <TouchableOpacity onPress={handleConfirm} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ color: colors.primary, fontSize: 15, fontWeight: '700' }}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Selected date display */}
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text, letterSpacing: -0.5 }}>
              {MONTHS[month]} {clampedDay}, {year}
            </Text>
          </View>

          {/* Month grid */}
          <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textTertiary, letterSpacing: 0.8, marginBottom: 8 }}>MONTH</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {MONTHS_SHORT.map((m, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => setMonth(i)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 7,
                    borderRadius: 20, minWidth: 52, alignItems: 'center',
                    backgroundColor: month === i ? colors.primary : colors.surfaceSecondary,
                    borderWidth: 1,
                    borderColor: month === i ? colors.primary : colors.borderLight,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: month === i ? colors.primaryContrast : colors.text }}>
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Day + Year row */}
          <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 16 }}>
            {/* Day input */}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textTertiary, letterSpacing: 0.8, marginBottom: 8 }}>DAY</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceSecondary, borderRadius: 14, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden' }}>
                <TouchableOpacity onPress={() => adjustDay(-1)} style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
                  <Text style={{ fontSize: 20, color: colors.primary, fontWeight: '300' }}>−</Text>
                </TouchableOpacity>
                <TextInput
                  style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: colors.text, paddingVertical: 10 }}
                  keyboardType="number-pad"
                  value={String(day)}
                  onChangeText={(t) => {
                    const n = parseInt(t, 10)
                    if (!isNaN(n)) setDay(Math.max(1, Math.min(31, n)))
                    else if (t === '') setDay(1)
                  }}
                  onBlur={() => setDay(Math.max(1, Math.min(daysInMonth, day)))}
                  maxLength={2}
                  selectTextOnFocus
                />
                <TouchableOpacity onPress={() => adjustDay(1)} style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
                  <Text style={{ fontSize: 20, color: colors.primary, fontWeight: '300' }}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Year input */}
            <View style={{ flex: 1.4 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textTertiary, letterSpacing: 0.8, marginBottom: 8 }}>YEAR</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceSecondary, borderRadius: 14, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden' }}>
                <TouchableOpacity onPress={() => adjustYear(-1)} style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
                  <Text style={{ fontSize: 20, color: colors.primary, fontWeight: '300' }}>−</Text>
                </TouchableOpacity>
                <TextInput
                  style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: colors.text, paddingVertical: 10 }}
                  keyboardType="number-pad"
                  value={String(year)}
                  onChangeText={(t) => {
                    const n = parseInt(t, 10)
                    if (!isNaN(n)) setYear(n)
                    else if (t === '') setYear(currentYear)
                  }}
                  onBlur={() => setYear(Math.max(currentYear - 100, Math.min(currentYear, year)))}
                  maxLength={4}
                  selectTextOnFocus
                />
                <TouchableOpacity onPress={() => adjustYear(1)} style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
                  <Text style={{ fontSize: 20, color: colors.primary, fontWeight: '300' }}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

        </View>
      </View>
    </Modal>
  )
}
