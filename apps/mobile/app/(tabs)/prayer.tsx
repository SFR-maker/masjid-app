import { useState, useEffect, useMemo, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Modal } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { SafeAreaView } from 'react-native-safe-area-context'
import { format, addDays, isToday } from 'date-fns'
import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'
import * as Location from 'expo-location'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { api } from '../../lib/api'
import { useAuth } from '@clerk/clerk-expo'
import { useAdhanScheduler } from '../../hooks/useAdhanScheduler'
import { usePrayerWidgetSync } from '../../hooks/usePrayerWidgetSync'
import { useTheme } from '../../contexts/ThemeContext'
import { useTranslation } from 'react-i18next'

const PRAYER_SOURCE_KEY = 'prayer_source'
export const MADHAB_KEY = 'madhab_preference'  // shared with profile.tsx

function toHijri(date: Date): { day: number; month: string; year: number } {
  const MONTHS = [
    'Muharram', 'Safar', "Rabi' al-Awwal", "Rabi' al-Thani",
    'Jumada al-Awwal', 'Jumada al-Thani', 'Rajab', "Sha'ban",
    'Ramadan', 'Shawwal', "Dhu al-Qi'dah", "Dhu al-Hijjah",
  ]
  const y = date.getFullYear(), mo = date.getMonth() + 1, d = date.getDate()
  const jd = Math.floor((14 - mo) / 12)
  const y2 = y + 4800 - jd
  const m2 = mo + 12 * jd - 3
  const jdn = d + Math.floor((153 * m2 + 2) / 5) + 365 * y2 + Math.floor(y2 / 4)
    - Math.floor(y2 / 100) + Math.floor(y2 / 400) - 32045
  const l = jdn - 1948440 + 10632
  const n = Math.floor((l - 1) / 10631)
  const ll = l - 10631 * n + 354
  const j = Math.floor((10985 - ll) / 5316) * Math.floor(50 * ll / 17719)
    + Math.floor(ll / 5670) * Math.floor(43 * ll / 15238)
  const ll2 = ll - Math.floor((30 - j) / 15) * Math.floor(17719 * j / 50)
    - Math.floor(j / 16) * Math.floor(15238 * j / 43) + 29
  const hMonth = Math.floor(24 * ll2 / 709)
  const hDay = ll2 - Math.floor(709 * hMonth / 24)
  const hYear = 30 * n + j - 30
  return { day: hDay, month: MONTHS[hMonth - 1] ?? '', year: hYear }
}

function to12Hour(time: string | undefined): string | undefined {
  if (!time) return undefined
  const [h, m] = time.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return time
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

const PRAYERS = [
  { key: 'fajr',    name: 'Fajr',    arabicName: 'الفجر', icon: '🌙', aladhanKey: 'Fajr' },
  { key: 'dhuhr',   name: 'Dhuhr',   arabicName: 'الظهر', icon: '☀️', aladhanKey: 'Dhuhr' },
  { key: 'asr',     name: 'Asr',     arabicName: 'العصر', icon: '🌤',  aladhanKey: 'Asr' },
  { key: 'maghrib', name: 'Maghrib', arabicName: 'المغرب', icon: '🌅', aladhanKey: 'Maghrib' },
  { key: 'isha',    name: 'Isha',    arabicName: 'العشاء', icon: '🌃', aladhanKey: 'Isha' },
]

// Sentinel value meaning "use GPS location"
const LOCATION_SOURCE = '__location__'

export default function PrayerScreen() {
  const { colors } = useTheme()
  const [selectedDate, setSelectedDate] = useState(new Date())
  // source is either LOCATION_SOURCE or a mosque id string
  const [source, setSource] = useState<string>(LOCATION_SOURCE)
  const [showMoreDropdown, setShowMoreDropdown] = useState(false)
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [now, setNow] = useState(new Date())
  const { isSignedIn } = useAuth()
  const queryClient = useQueryClient()

  // Persist & restore source selection
  useEffect(() => {
    AsyncStorage.getItem(PRAYER_SOURCE_KEY).then((val) => {
      if (val) setSource(val)
    })
  }, [])

  // Re-read madhab preference every time this tab gains focus.
  // This ensures changes made on the Profile tab are picked up immediately
  // without relying on cross-tab React state synchronisation.
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(MADHAB_KEY).then((val) => {
        const school: 0 | 1 = val === 'HANAFI' ? 1 : 0
        setMadhabSchool(prev => {
          if (prev !== school) {
            // School changed — remove stale Aladhan cache so the new value is fetched
            queryClient.removeQueries({ queryKey: ['aladhan'] })
          }
          return school
        })
      })
    }, [queryClient])
  )

  function selectSource(src: string) {
    setSource(src)
    AsyncStorage.setItem(PRAYER_SOURCE_KEY, src)
  }

  // Tick every second for the countdown
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const activeMosqueId = source === LOCATION_SOURCE ? null : source

  // Sync prayer data to AsyncStorage for widget/lockscreen extensions
  usePrayerWidgetSync(activeMosqueId)

  // Get user GPS location
  const fetchLocation = async () => {
    setLocationLoading(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') return
      const loc = await Location.getCurrentPositionAsync({})
      setUserCoords(loc.coords)
    } finally {
      setLocationLoading(false)
    }
  }

  useEffect(() => { fetchLocation() }, [])

  // Re-fetch location whenever the user explicitly switches to location mode
  useEffect(() => {
    if (source === LOCATION_SOURCE) fetchLocation()
  }, [source])


  // Fetch followed mosques — API returns flat mosque objects: { id, name, ... }
  const { data: followsData } = useQuery({
    queryKey: ['followed-mosques'],
    queryFn: () => api.get('/users/me/follows'),
    enabled: !!isSignedIn,
  })
  // Each item IS the mosque: { id, name, city, isFavorite, ... }
  // Sort so the favorite appears first (right after My Location)
  const followedMosques: any[] = [...(followsData?.data?.items ?? [])].sort(
    (a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0)
  )

  const dateStr = format(selectedDate, 'yyyy-MM-dd')

  // Mosque prayer times (only when a mosque is selected)
  const { data: mosqueTimesData, isLoading: mosqueTimesLoading } = useQuery({
    queryKey: ['prayer-times', activeMosqueId, dateStr],
    queryFn: () => api.get(`/mosques/${activeMosqueId}/prayer-times?date=${dateStr}`),
    enabled: !!activeMosqueId,
  })

  // Mosque detail — Jumu'ah schedules & coordinates
  const { data: mosqueDetailData, isLoading: mosqueDetailLoading } = useQuery({
    queryKey: ['mosque-detail', activeMosqueId],
    queryFn: () => api.get(`/mosques/${activeMosqueId}`),
    enabled: !!activeMosqueId,
  })

  // mosqueTimesData shape: { success, data: schedule|null, mosqueLocation: {lat,lng}|null }
  const mosqueSchedule = activeMosqueId ? (mosqueTimesData?.data ?? null) : null
  // Mosque coords come from the prayer-times API response — no extra round-trip needed
  const apiMosqueCoords = mosqueTimesData?.mosqueLocation ?? null

  // Mosque detail is still needed for Jumu'ah schedules only
  const mosqueDetail = mosqueDetailData?.data
  const jumuahSchedules: any[] = mosqueDetail?.jumuahSchedules ?? []

  // Madhab preference — read from AsyncStorage for instant, race-condition-free access.
  // AsyncStorage is updated immediately whenever the user changes madhab (see profile.tsx),
  // so this is always up to date without waiting for the /users/me API response.
  // school=0 → Shafi/Maliki/Hanbali (Standard), school=1 → Hanafi
  const [madhabSchool, setMadhabSchool] = useState<0 | 1>(0)
  useEffect(() => {
    AsyncStorage.getItem(MADHAB_KEY).then((val) => {
      setMadhabSchool(val === 'HANAFI' ? 1 : 0)
    })
  }, [])

  const { data: taraweehData } = useQuery({
    queryKey: ['taraweeh', activeMosqueId],
    queryFn: () => api.get(`/mosques/${activeMosqueId}/taraweeh`),
    enabled: !!activeMosqueId,
  })
  const taraweehSchedules: any[] = taraweehData?.data?.items ?? []

  // Name to display
  const activeMosqueName = activeMosqueId
    ? (followedMosques.find(m => m.id === activeMosqueId)?.name ?? mosqueDetail?.name ?? 'Mosque')
    : null

  // Need Aladhan when: location mode, OR mosque has no schedule, OR schedule exists but
  // at least one adhan is blank (mosque set iqamah only — adhan fills in from location).
  const scheduleHasAllAdhan = mosqueSchedule != null &&
    PRAYERS.every(p => !!(mosqueSchedule as any)[`${p.key}Adhan`])
  const needsAladhan = !activeMosqueId || (!mosqueTimesLoading && !scheduleHasAllAdhan)

  // Aladhan coords: for a mosque use the mosque's own coordinates (from the API response).
  // Fall back to userCoords only as last resort so different mosques don't share the same
  // calculation (a mosque in Louisiana and one in Texas must use their own locations).
  const aladhanCoords = activeMosqueId
    ? (apiMosqueCoords ?? userCoords)
    : userCoords

  const { data: aladhanData, isLoading: aladhanLoading } = useQuery({
    // Include activeMosqueId (or '__location__') in the key so mosque A and mosque B
    // never share the same cached Aladhan response, even when their coordinates happen
    // to be identical (e.g., both fall back to userCoords).
    queryKey: ['aladhan', activeMosqueId ?? '__location__', aladhanCoords?.latitude, aladhanCoords?.longitude, dateStr, madhabSchool],
    queryFn: async () => {
      const res = await fetch(
        `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${aladhanCoords!.latitude}&longitude=${aladhanCoords!.longitude}&method=2&school=${madhabSchool}`
      )
      return res.json() as Promise<any>
    },
    enabled: needsAladhan && !!aladhanCoords,
    staleTime: 1000 * 60 * 60,
  })

  const aladhanTimings = aladhanData?.data?.timings
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i - 1))

  // mosqueDetailLoading is NOT included — Jumu'ah loads async below the prayer times.
  // Prayer times themselves are ready as soon as mosqueTimesData resolves.
  const isLoading =
    (activeMosqueId && mosqueTimesLoading) ||
    (needsAladhan && aladhanLoading && !!aladhanCoords) ||
    (!activeMosqueId && locationLoading)

  // Build resolved prayer times for adhan scheduler (merge mosque schedule + Aladhan fallback)
  const resolvedTimes = useMemo(() => {
    if (!mosqueSchedule && !aladhanTimings) return null
    return {
      fajr:    (mosqueSchedule as any)?.fajrAdhan    || aladhanTimings?.Fajr,
      dhuhr:   (mosqueSchedule as any)?.dhuhrAdhan   || aladhanTimings?.Dhuhr,
      asr:     (mosqueSchedule as any)?.asrAdhan     || aladhanTimings?.Asr,
      maghrib: (mosqueSchedule as any)?.maghribAdhan || aladhanTimings?.Maghrib,
      isha:    (mosqueSchedule as any)?.ishaAdhan    || aladhanTimings?.Isha,
    }
  }, [mosqueSchedule, aladhanTimings])

  useAdhanScheduler(resolvedTimes)

  // Next prayer countdown (today only)
  const nextPrayer = useMemo(() => {
    if (!resolvedTimes || !isToday(selectedDate)) return null
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    for (const prayer of PRAYERS) {
      const timeStr = resolvedTimes[prayer.key as keyof typeof resolvedTimes]
      if (!timeStr) continue
      const [h, m] = timeStr.split(':').map(Number)
      if (isNaN(h) || isNaN(m)) continue
      const prayerDate = new Date(`${todayStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`)
      if (prayerDate > now) {
        const diffMs = prayerDate.getTime() - now.getTime()
        const hrs = Math.floor(diffMs / 3600000)
        const mins = Math.floor((diffMs % 3600000) / 60000)
        const secs = Math.floor((diffMs % 60000) / 1000)
        const timeLabel = hrs > 0 ? `${hrs}h ${mins}m` : mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
        return { name: prayer.name, timeLabel }
      }
    }
    return null
  }, [resolvedTimes, now, selectedDate])

  // Hijri date for today
  const hijri = useMemo(() => toHijri(new Date()), [])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.6 }}>Prayer Times</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 3, fontWeight: '500' }}>
                {activeMosqueName ?? (userCoords ? 'Based on your location' : 'Getting location…')}
              </Text>
              <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>
                {hijri.day} {hijri.month} {hijri.year} AH
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/notification-settings')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, marginTop: 2,
                shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 1 }}
            >
              <Ionicons name="notifications-outline" size={19} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {nextPrayer && (
            <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.primaryLight, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 8, alignSelf: 'flex-start',
              shadowColor: colors.primary, shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 }}>
              <Ionicons name="time-outline" size={13} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
                {nextPrayer.name} in {nextPrayer.timeLabel}
              </Text>
            </View>
          )}
        </View>

        {/* Source switcher */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ paddingVertical: 14 }}
          contentContainerStyle={{ paddingLeft: 16, paddingRight: 16, gap: 8 }}
        >
          <TouchableOpacity
            onPress={() => selectSource(LOCATION_SOURCE)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              paddingHorizontal: 14, paddingVertical: 9, borderRadius: 22,
              backgroundColor: source === LOCATION_SOURCE ? colors.primary : colors.surface,
              borderWidth: 1, borderColor: source === LOCATION_SOURCE ? colors.primary : colors.border,
              shadowColor: source === LOCATION_SOURCE ? colors.primary : '#000',
              shadowOpacity: source === LOCATION_SOURCE ? 0.18 : 0.04,
              shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: source === LOCATION_SOURCE ? 3 : 1,
            }}
          >
            <Ionicons name="location" size={13} color={source === LOCATION_SOURCE ? colors.primaryContrast : colors.textSecondary} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: source === LOCATION_SOURCE ? colors.primaryContrast : colors.text, letterSpacing: 0.1 }}>
              My Location
            </Text>
          </TouchableOpacity>

          {followedMosques.slice(0, 3).map((mosque: any) => {
            const isActive = source === mosque.id
            return (
              <TouchableOpacity
                key={mosque.id}
                onPress={() => selectSource(mosque.id)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingHorizontal: 14, paddingVertical: 9, borderRadius: 22,
                  backgroundColor: isActive ? colors.primary : colors.surface,
                  borderWidth: 1, borderColor: isActive ? colors.primary : colors.border,
                  shadowColor: isActive ? colors.primary : '#000',
                  shadowOpacity: isActive ? 0.18 : 0.04,
                  shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: isActive ? 3 : 1,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: isActive ? colors.primaryContrast : colors.text, letterSpacing: 0.1 }}>
                  🕌 {mosque.name}
                </Text>
              </TouchableOpacity>
            )
          })}

          {followedMosques.length > 3 && (() => {
            const overflowMosques = followedMosques.slice(3)
            const overflowActive = overflowMosques.some((m: any) => m.id === source)
            return (
              <>
                <TouchableOpacity
                  onPress={() => setShowMoreDropdown(true)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                    backgroundColor: overflowActive ? colors.primary : colors.surface,
                    borderWidth: 1, borderColor: overflowActive ? colors.primary : colors.border,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: overflowActive ? colors.primaryContrast : colors.textSecondary }}>
                    {overflowActive
                      ? `🕌 ${followedMosques.find((m: any) => m.id === source)?.name}`
                      : `+${overflowMosques.length} more`}
                  </Text>
                  <Ionicons name="chevron-down" size={12} color={overflowActive ? colors.primaryContrast : colors.textSecondary} />
                </TouchableOpacity>

                <Modal
                  visible={showMoreDropdown}
                  transparent
                  animationType="fade"
                  onRequestClose={() => setShowMoreDropdown(false)}
                >
                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
                    activeOpacity={1}
                    onPress={() => setShowMoreDropdown(false)}
                  >
                    <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32 }}>
                      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>More Mosques</Text>
                      </View>
                      {overflowMosques.map((mosque: any) => {
                        const isActive = source === mosque.id
                        return (
                          <TouchableOpacity
                            key={mosque.id}
                            onPress={() => { selectSource(mosque.id); setShowMoreDropdown(false) }}
                            style={{
                              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                              paddingHorizontal: 20, paddingVertical: 14,
                              borderBottomWidth: 1, borderBottomColor: colors.background,
                            }}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                              <Text style={{ fontSize: 18 }}>🕌</Text>
                              <Text style={{ fontSize: 14, fontWeight: isActive ? '700' : '500', color: isActive ? colors.primary : colors.text }}>
                                {mosque.name}
                              </Text>
                            </View>
                            {isActive && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                          </TouchableOpacity>
                        )
                      })}
                    </View>
                  </TouchableOpacity>
                </Modal>
              </>
            )
          })()}

          {isSignedIn && followedMosques.length === 0 && (
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/discover')}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primaryLight,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>+ Follow a mosque</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Date strip */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingBottom: 16 }} contentContainerStyle={{ paddingLeft: 16, paddingRight: 8 }}>
          {weekDays.map((day) => {
            const isSelected = format(day, 'yyyy-MM-dd') === dateStr
            const isFri = day.getDay() === 5
            return (
              <TouchableOpacity
                key={day.toISOString()}
                onPress={() => setSelectedDate(day)}
                style={{
                  marginRight: 8, alignItems: 'center', paddingVertical: 11, paddingHorizontal: 13,
                  borderRadius: 18, minWidth: 58,
                  backgroundColor: isSelected ? colors.primary : colors.surface,
                  borderWidth: 1, borderColor: isSelected ? colors.primary : colors.border,
                  shadowColor: isSelected ? colors.primary : '#000',
                  shadowOpacity: isSelected ? 0.22 : 0.03,
                  shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: isSelected ? 4 : 1,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 0.4, color: isSelected ? `${colors.primaryContrast}BF` : isFri ? colors.primary : colors.textTertiary }}>
                  {format(day, 'EEE').toUpperCase()}
                </Text>
                <Text style={{ fontSize: 20, fontWeight: '800', marginTop: 3, letterSpacing: -0.3, color: isSelected ? colors.primaryContrast : colors.text }}>
                  {format(day, 'd')}
                </Text>
                {isToday(day) && (
                  <View style={{ width: 5, height: 5, borderRadius: 3, marginTop: 3, backgroundColor: isSelected ? `${colors.primaryContrast}B3` : colors.primary }} />
                )}
              </TouchableOpacity>
            )
          })}
        </ScrollView>

        {isLoading ? (
          <View style={{ alignItems: 'center', padding: 40 }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <>
            {/* Info banner: adhan times are calculated (no schedule, or schedule has blank adhans) */}
            {activeMosqueId && !mosqueTimesLoading && needsAladhan && (
              <View style={{ marginHorizontal: 20, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="information-circle-outline" size={14} color="#9CA3AF" />
                <Text style={{ color: colors.textTertiary, fontSize: 12, flex: 1 }}>
                  {mosqueSchedule ? `Adhan times calculated from ${activeMosqueName}'s location` : `${activeMosqueName} hasn't set times for this date — showing calculated times`}
                </Text>
              </View>
            )}

            {/* No location + no mosque */}
            {!activeMosqueId && !aladhanCoords && !locationLoading && (
              <View style={{ marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: colors.border, gap: 14,
                shadowColor: colors.primary, shadowOpacity: 0.05, shadowOffset: { width: 0, height: 3 }, shadowRadius: 10, elevation: 2 }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 26 }}>📍</Text>
                </View>
                <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: '600', textAlign: 'center', letterSpacing: -0.1 }}>
                  Location needed
                </Text>
                <Text style={{ color: colors.textTertiary, fontSize: 13, textAlign: 'center', lineHeight: 19, marginTop: -6 }}>
                  Allow location access to see prayer times for your area.
                </Text>
                <TouchableOpacity
                  onPress={fetchLocation}
                  style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 28,
                    shadowColor: colors.primary, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 4 }}
                >
                  <Text style={{ color: colors.primaryContrast, fontWeight: '700', fontSize: 14 }}>Allow Location</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Prayer rows */}
            {(mosqueSchedule || aladhanTimings) && (
              <View style={{ marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: colors.border,
                shadowColor: colors.primary, shadowOpacity: 0.06, shadowOffset: { width: 0, height: 4 }, shadowRadius: 14, elevation: 3 }}>
                {PRAYERS.flatMap((prayer, i) => {
                  // Adhan: use mosque's value if set, otherwise fall back to Aladhan calculation
                  const scheduleAdhan = mosqueSchedule
                    ? (mosqueSchedule as any)[`${prayer.key}Adhan`] as string | null
                    : null
                  const adhan = scheduleAdhan || aladhanTimings?.[prayer.aladhanKey]
                  // Iqamah: only from mosque schedule — never calculated
                  const iqamah = mosqueSchedule
                    ? (mosqueSchedule as any)[`${prayer.key}Iqamah`] as string | null
                    : null

                  const row = (
                    <View
                      key={prayer.key}
                      style={{
                        flexDirection: 'row', alignItems: 'center',
                        paddingHorizontal: 16, paddingVertical: 16,
                        borderBottomWidth: i < PRAYERS.length - 1 ? 1 : 0,
                        borderBottomColor: colors.border,
                      }}
                    >
                      {/* Icon */}
                      <Text style={{ fontSize: 21, width: 34 }}>{prayer.icon}</Text>

                      {/* Prayer name */}
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15, letterSpacing: -0.1 }}>{prayer.name}</Text>
                        <Text style={{ color: colors.textTertiary, fontSize: 13, textAlign: 'left', writingDirection: 'ltr', fontWeight: '500' }}>{prayer.arabicName}</Text>
                      </View>

                      {/* Times — adhan + iqamah in separate labeled columns when iqamah exists */}
                      {iqamah ? (
                        <View style={{ flexDirection: 'row', gap: 20, alignItems: 'flex-end' }}>
                          <View style={{ alignItems: 'center' }}>
                            <Text style={{ color: colors.textTertiary, fontSize: 9, fontWeight: '700', marginBottom: 3, letterSpacing: 0.5 }}>ADHAN</Text>
                            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{to12Hour(adhan) ?? '—'}</Text>
                          </View>
                          <View style={{ width: 1, height: 30, backgroundColor: colors.border }} />
                          <View style={{ alignItems: 'center' }}>
                            <Text style={{ color: colors.primary, fontSize: 9, fontWeight: '700', marginBottom: 3, letterSpacing: 0.5 }}>IQAMAH</Text>
                            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 15 }}>{to12Hour(iqamah)}</Text>
                          </View>
                        </View>
                      ) : (
                        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16, letterSpacing: -0.2 }}>{to12Hour(adhan) ?? '—'}</Text>
                      )}
                    </View>
                  )
                  if (prayer.key === 'fajr' && aladhanTimings?.Sunrise) {
                    return [row, (
                      <View key="sunrise" style={{
                        flexDirection: 'row', alignItems: 'center',
                        paddingHorizontal: 16, paddingVertical: 16,
                        borderBottomWidth: 1, borderBottomColor: colors.border,
                      }}>
                        <Text style={{ fontSize: 21, width: 34 }}>🌄</Text>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15, letterSpacing: -0.1 }}>Sunrise</Text>
                          <Text style={{ color: colors.textTertiary, fontSize: 13, fontWeight: '500', textAlign: 'left', writingDirection: 'ltr' }}>الشروق</Text>
                        </View>
                        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16, letterSpacing: -0.2 }}>{to12Hour(aladhanTimings.Sunrise) ?? '—'}</Text>
                      </View>
                    )]
                  }
                  return [row]
                })}
              </View>
            )}

            {/* Jumu'ah — shown whenever a mosque is selected and has schedules */}
            {activeMosqueId && jumuahSchedules.length > 0 && (
              <View style={{ marginHorizontal: 16, marginTop: 18, gap: 8 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 2 }}>
                  JUMU&apos;AH — FRIDAY PRAYER
                </Text>
                {jumuahSchedules.map((j: any, idx: number) => (
                  <View key={j.id ?? idx} style={{ backgroundColor: colors.primary, borderRadius: 16, padding: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <Text style={{ color: colors.primaryContrast, fontWeight: 'bold', fontSize: 16 }}>
                        {jumuahSchedules.length > 1 ? `Jumu'ah ${idx + 1}` : "Friday Prayer"}
                      </Text>
                      {j.language && (
                        <View style={{ backgroundColor: colors.isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                          <Text style={{ color: colors.primaryContrast, fontSize: 11, fontWeight: '600' }}>{j.language}</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 24 }}>
                      <View>
                        <Text style={{ color: colors.isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '600', marginBottom: 2 }}>KHUTBAH</Text>
                        <Text style={{ color: colors.primaryContrast, fontWeight: 'bold', fontSize: 20 }}>
                          {to12Hour(j.khutbahTime) ?? j.khutbahTime ?? '—'}
                        </Text>
                      </View>
                      <View>
                        <Text style={{ color: colors.isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '600', marginBottom: 2 }}>IQAMAH</Text>
                        <Text style={{ color: colors.primaryContrast, fontWeight: 'bold', fontSize: 20 }}>
                          {to12Hour(j.iqamahTime) ?? j.iqamahTime ?? '—'}
                        </Text>
                      </View>
                    </View>
                    {j.imam && (
                      <Text style={{ color: colors.isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 8 }}>Imam: {j.imam}</Text>
                    )}
                    {j.notes && (
                      <Text style={{ color: colors.isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 }}>{j.notes}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Taraweeh — shown when a mosque has taraweeh schedules */}
            {activeMosqueId && taraweehSchedules.length > 0 && (
              <View style={{ marginHorizontal: 16, marginTop: 18, gap: 8 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 2 }}>
                  TARAWEEH — NIGHT PRAYER
                </Text>
                {taraweehSchedules.map((t: any, idx: number) => (
                  <View key={t.id ?? idx} style={{ backgroundColor: '#0F2D48', borderRadius: 16, padding: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>
                        {taraweehSchedules.length > 1 ? `Taraweeh ${idx + 1}` : 'Taraweeh'}
                      </Text>
                      {t.rakaat && (
                        <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                          <Text style={{ color: 'white', fontSize: 11, fontWeight: '600' }}>{t.rakaat} Raka&apos;at</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 24 }}>
                      <View>
                        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '600', marginBottom: 2 }}>START</Text>
                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 20 }}>
                          {to12Hour(t.startTime) ?? t.startTime ?? '—'}
                        </Text>
                      </View>
                      {t.endTime && (
                        <View>
                          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '600', marginBottom: 2 }}>END</Text>
                          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 20 }}>
                            {to12Hour(t.endTime) ?? t.endTime}
                          </Text>
                        </View>
                      )}
                    </View>
                    {t.imam && (
                      <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 8 }}>Imam: {t.imam}</Text>
                    )}
                    {t.notes && (
                      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 }}>{t.notes}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Location mode: no Jumu'ah available */}
            {source === LOCATION_SOURCE && (
              <View style={{ marginHorizontal: 20, marginTop: 12, backgroundColor: colors.primaryLight, borderRadius: 12, padding: 14 }}>
                <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 13, marginBottom: 2 }}>Jumu&apos;ah times not available</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Select a mosque above to see exact Friday prayer times.</Text>
              </View>
            )}

            {/* Follow mosque prompt */}
            {!isSignedIn && (
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/discover')}
                style={{ marginHorizontal: 20, marginTop: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primaryLight, borderRadius: 12, padding: 14 }}
              >
                <Text style={{ fontSize: 20, marginRight: 10 }}>🕌</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 14 }}>Follow a mosque</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 1 }}>Get exact iqamah & Jumu'ah times</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </TouchableOpacity>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}
