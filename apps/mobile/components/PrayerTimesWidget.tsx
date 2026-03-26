import { View, Text, TouchableOpacity } from 'react-native'
import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, addDays } from 'date-fns'
import { router } from 'expo-router'
import { api } from '../lib/api'
import { useSelectedMosque } from '../hooks/useSelectedMosque'
import { useTheme } from '../contexts/ThemeContext'

const PRAYER_KEYS = ['fajrAdhan', 'dhuhrAdhan', 'asrAdhan', 'maghribAdhan', 'ishaAdhan']
const PRAYER_NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

interface NextPrayer {
  name: string
  time: string
  isTomorrow: boolean
}

/**
 * Returns the next upcoming prayer.
 * FIX: was returning today's (past) fajrAdhan after Isha — now uses tomorrowSchedule
 * to show the correct upcoming Fajr.
 */
export function getNextPrayer(schedule: any, tomorrowSchedule?: any): NextPrayer | null {
  if (!schedule) return null
  const now = new Date()
  for (let i = 0; i < PRAYER_KEYS.length; i++) {
    const time = schedule[PRAYER_KEYS[i]]
    if (!time) continue
    const [h, m] = time.split(':').map(Number)
    const prayerTime = new Date()
    prayerTime.setHours(h, m, 0, 0)
    if (prayerTime > now) return { name: PRAYER_NAMES[i], time, isTomorrow: false }
  }
  // All today's prayers have passed — use tomorrow's Fajr (not today's which is in the past)
  const tomorrowFajr = tomorrowSchedule?.fajrAdhan
  if (tomorrowFajr) return { name: 'Fajr', time: tomorrowFajr, isTomorrow: true }
  return null
}

/** Live countdown string that ticks every second. */
function useCountdown(next: NextPrayer | null): string {
  const [label, setLabel] = useState('')
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!next) { setLabel(''); return }

    function tick() {
      const now = new Date()
      const [h, m] = next!.time.split(':').map(Number)
      const target = new Date()
      target.setHours(h, m, 0, 0)
      // If tomorrow's prayer or target already passed today, shift to next day
      if (next!.isTomorrow || target <= now) target.setDate(target.getDate() + 1)
      const diffMs = target.getTime() - now.getTime()
      if (diffMs <= 0) { setLabel('Now'); return }
      const total = Math.floor(diffMs / 1000)
      const hrs = Math.floor(total / 3600)
      const mins = Math.floor((total % 3600) / 60)
      const secs = total % 60
      if (hrs > 0) {
        setLabel(`in ${hrs}h ${String(mins).padStart(2, '0')}m`)
      } else {
        setLabel(`in ${mins}m ${String(secs).padStart(2, '0')}s`)
      }
    }

    tick()
    ref.current = setInterval(tick, 1000)
    return () => { if (ref.current) clearInterval(ref.current) }
  }, [next?.name, next?.time, next?.isTomorrow])

  return label
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
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd')

  const { data } = useQuery({
    queryKey: ['prayer-widget', mosqueId, today],
    queryFn: () => api.get(`/mosques/${mosqueId}/prayer-times?date=${today}`),
    enabled: !!mosqueId,
    staleTime: 1000 * 60 * 10,
  })

  // Pre-fetch tomorrow so post-Isha rollover shows the correct upcoming Fajr
  const { data: tomorrowData } = useQuery({
    queryKey: ['prayer-widget', mosqueId, tomorrow],
    queryFn: () => api.get(`/mosques/${mosqueId}/prayer-times?date=${tomorrow}`),
    enabled: !!mosqueId,
    staleTime: 1000 * 60 * 10,
  })

  const schedule = data?.data
  const tomorrowSchedule = tomorrowData?.data
  const next = getNextPrayer(schedule, tomorrowSchedule)
  const countdown = useCountdown(next)

  if (!mosqueId) {
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
      <TouchableOpacity
        onPress={() => router.push(`/mosque/${mosqueId}` as any)}
        activeOpacity={0.7}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        style={{ alignSelf: 'flex-start', marginBottom: 10 }}
      >
        <Text style={{ color: colors.isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600', letterSpacing: 0.5 }}>
          {mosqueName?.toUpperCase()}
        </Text>
      </TouchableOpacity>

      {next ? (
        <View>
          <Text style={{ color: colors.isDark ? 'rgba(15,23,42,0.6)' : 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 4 }}>
            NEXT PRAYER{next.isTomorrow ? ' · TOMORROW' : ''}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
            <Text style={{ color: colors.primaryContrast, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}>{next.name}</Text>
            <Text style={{ color: colors.isDark ? 'rgba(15,23,42,0.8)' : 'rgba(255,255,255,0.85)', fontSize: 22, fontWeight: '600' }}>{next.time}</Text>
          </View>
          {countdown ? (
            <Text style={{ color: colors.isDark ? 'rgba(15,23,42,0.55)' : 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '500', marginTop: 4 }}>
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
