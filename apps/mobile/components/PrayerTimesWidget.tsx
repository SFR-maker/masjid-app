import { View, Text, TouchableOpacity, Pressable } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { router } from 'expo-router'
import * as Location from 'expo-location'
import { api } from '../lib/api'
import { useSelectedMosque } from '../hooks/useSelectedMosque'
import { useTheme } from '../contexts/ThemeContext'

const PRAYER_KEYS = ['fajrAdhan', 'dhuhrAdhan', 'asrAdhan', 'maghribAdhan', 'ishaAdhan']
const PRAYER_NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

function getNextPrayer(schedule: any, now: Date): { name: string; time: string; diffMs: number } | null {
  if (!schedule) return null
  for (let i = 0; i < PRAYER_KEYS.length; i++) {
    const time = schedule[PRAYER_KEYS[i]]
    if (!time) continue
    const [h, m] = time.split(':').map(Number)
    const prayerTime = new Date(now)
    prayerTime.setHours(h, m, 0, 0)
    if (prayerTime > now) return { name: PRAYER_NAMES[i], time, diffMs: prayerTime.getTime() - now.getTime() }
  }
  // All prayers passed — calculate countdown to tomorrow's Fajr
  if (schedule.fajrAdhan) {
    const [h, m] = schedule.fajrAdhan.split(':').map(Number)
    const tomorrowFajr = new Date(now)
    tomorrowFajr.setDate(tomorrowFajr.getDate() + 1)
    tomorrowFajr.setHours(h, m, 0, 0)
    return { name: 'Fajr', time: schedule.fajrAdhan, diffMs: tomorrowFajr.getTime() - now.getTime() }
  }
  return null
}

function formatCountdown(diffMs: number): string {
  if (diffMs <= 0) return ''
  const totalSecs = Math.floor(diffMs / 1000)
  const h = Math.floor(totalSecs / 3600)
  const m = Math.floor((totalSecs % 3600) / 60)
  const s = totalSecs % 60
  if (h > 0) return `in ${h}h ${m}m`
  if (m > 0) return `in ${m}m ${s}s`
  return `in ${s}s`
}

interface PrayerTimesWidgetProps {
  overrideMosqueId?: string
  overrideMosqueName?: string
}

export function PrayerTimesWidget({ overrideMosqueId, overrideMosqueName }: PrayerTimesWidgetProps = {}) {
  const { colors } = useTheme()
  const { mosqueId: storedId, mosqueName: storedName } = useSelectedMosque()
  const mosqueId = overrideMosqueId ?? storedId
  const mosqueName = overrideMosqueName ?? storedName
  const today = format(new Date(), 'yyyy-MM-dd')
  const [now, setNow] = useState(new Date())
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null)

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Get location for Aladhan fallback
  useEffect(() => {
    Location.getForegroundPermissionsAsync().then(async ({ status }) => {
      if (status !== 'granted') {
        // Request permission silently — won't show dialog if already denied
        const { status: newStatus } = await Location.requestForegroundPermissionsAsync()
        if (newStatus !== 'granted') return
      }
      // Try last known first (fast), then fall back to current position
      const last = await Location.getLastKnownPositionAsync()
      if (last) { setCoords(last.coords); return }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      if (current) setCoords(current.coords)
    })
  }, [])

  const { data } = useQuery({
    queryKey: ['prayer-widget', mosqueId, today],
    queryFn: () => api.get(`/mosques/${mosqueId}/prayer-times?date=${today}`),
    enabled: !!mosqueId,
    staleTime: 1000 * 60 * 10,
  })

  const mosqueSchedule = data?.data
  const mosqueLocation = data?.mosqueLocation

  // Always fetch Aladhan when we have any coords — used to fill gaps in mosque schedule too
  const aladhanCoords = mosqueLocation ?? coords
  const needsAladhan = !!aladhanCoords

  const { data: aladhanData } = useQuery({
    queryKey: ['prayer-widget-aladhan', aladhanCoords?.latitude, aladhanCoords?.longitude, today],
    queryFn: async () => {
      const res = await fetch(
        `https://api.aladhan.com/v1/timings/${today}?latitude=${aladhanCoords!.latitude}&longitude=${aladhanCoords!.longitude}&method=2`
      )
      return res.json() as Promise<any>
    },
    enabled: needsAladhan,
    staleTime: 1000 * 60 * 60,
  })

  const aladhanTimings = aladhanData?.data?.timings

  // Merge: mosque times take priority, Aladhan fills any missing fields
  const aladhanSchedule = aladhanTimings ? {
    fajrAdhan:    aladhanTimings.Fajr,
    dhuhrAdhan:   aladhanTimings.Dhuhr,
    asrAdhan:     aladhanTimings.Asr,
    maghribAdhan: aladhanTimings.Maghrib,
    ishaAdhan:    aladhanTimings.Isha,
  } : null
  const schedule = (mosqueSchedule || aladhanSchedule) ? {
    fajrAdhan:    mosqueSchedule?.fajrAdhan    ?? aladhanSchedule?.fajrAdhan,
    dhuhrAdhan:   mosqueSchedule?.dhuhrAdhan   ?? aladhanSchedule?.dhuhrAdhan,
    asrAdhan:     mosqueSchedule?.asrAdhan     ?? aladhanSchedule?.asrAdhan,
    maghribAdhan: mosqueSchedule?.maghribAdhan ?? aladhanSchedule?.maghribAdhan,
    ishaAdhan:    mosqueSchedule?.ishaAdhan    ?? aladhanSchedule?.ishaAdhan,
  } : null

  const next = getNextPrayer(schedule, now)
  const countdown = next && next.diffMs > 0 ? formatCountdown(next.diffMs) : ''

  if (!mosqueId) {
    // If we have GPS-based prayer times, show the countdown even without a mosque
    if (next) {
      return (
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/prayer')}
          activeOpacity={0.88}
          style={{
            backgroundColor: colors.primary, borderRadius: 20, padding: 18,
            shadowColor: colors.primary, shadowOpacity: 0.35, shadowOffset: { width: 0, height: 6 }, shadowRadius: 16, elevation: 5,
          }}
        >
          <Text style={{ color: colors.isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 10 }}>
            YOUR LOCATION
          </Text>
          <Text style={{ color: colors.isDark ? 'rgba(15,23,42,0.6)' : 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 4 }}>NEXT PRAYER</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
            <Text style={{ color: colors.primaryContrast, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}>{next.name}</Text>
            <Text style={{ color: colors.isDark ? 'rgba(15,23,42,0.8)' : 'rgba(255,255,255,0.85)', fontSize: 22, fontWeight: '600' }}>{next.time}</Text>
          </View>
          {countdown ? (
            <Text style={{ color: colors.isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600', marginTop: 4 }}>
              {countdown}
            </Text>
          ) : null}
        </TouchableOpacity>
      )
    }
    return (
      <TouchableOpacity
        onPress={() => router.push('/(tabs)/discover')}
        activeOpacity={0.88}
        style={{
          backgroundColor: colors.primary, borderRadius: 20, padding: 18,
          flexDirection: 'row', alignItems: 'center', gap: 14,
          shadowColor: colors.primary, shadowOpacity: 0.35, shadowOffset: { width: 0, height: 6 }, shadowRadius: 16, elevation: 5,
        }}
      >
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 22 }}>🕌</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.primaryContrast, fontWeight: '800', fontSize: 15, letterSpacing: -0.2 }}>Find your mosque</Text>
          <Text style={{ color: colors.isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 3 }}>
            Tap to see prayer times →
          </Text>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <TouchableOpacity
      onPress={() => router.push('/(tabs)/prayer')}
      activeOpacity={0.88}
      style={{
        backgroundColor: colors.primary, borderRadius: 20, padding: 18,
        shadowColor: colors.primary, shadowOpacity: 0.35, shadowOffset: { width: 0, height: 6 }, shadowRadius: 16, elevation: 5,
      }}
    >
      <Pressable
        onPress={(e) => { e.stopPropagation(); router.push(`/mosque/${mosqueId}` as any) }}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        style={{ alignSelf: 'flex-start', marginBottom: 10 }}
      >
        {({ pressed }) => (
          <Text style={{ color: colors.isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600', letterSpacing: 0.5, opacity: pressed ? 0.7 : 1 }}>
            {mosqueName?.toUpperCase()}
          </Text>
        )}
      </Pressable>
      {next ? (
        <View>
          <Text style={{ color: colors.isDark ? 'rgba(15,23,42,0.6)' : 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 4 }}>NEXT PRAYER</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
            <Text style={{ color: colors.primaryContrast, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}>{next.name}</Text>
            <Text style={{ color: colors.isDark ? 'rgba(15,23,42,0.8)' : 'rgba(255,255,255,0.85)', fontSize: 22, fontWeight: '600' }}>{next.time}</Text>
          </View>
          {countdown ? (
            <Text style={{ color: colors.isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600', marginTop: 4 }}>
              {countdown}
            </Text>
          ) : null}
        </View>
      ) : (
        <Text style={{ color: colors.isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '500' }}>Tap to view prayer times →</Text>
      )}
    </TouchableOpacity>
  )
}
