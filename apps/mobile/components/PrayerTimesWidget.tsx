import { View, Text, TouchableOpacity, Pressable } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { router } from 'expo-router'
import { api } from '../lib/api'
import { useSelectedMosque } from '../hooks/useSelectedMosque'
import { useTheme } from '../contexts/ThemeContext'

const PRAYER_KEYS = ['fajrAdhan', 'dhuhrAdhan', 'asrAdhan', 'maghribAdhan', 'ishaAdhan']
const PRAYER_NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

function getNextPrayer(schedule: any): { name: string; time: string } | null {
  if (!schedule) return null
  const now = new Date()
  for (let i = 0; i < PRAYER_KEYS.length; i++) {
    const time = schedule[PRAYER_KEYS[i]]
    if (!time) continue
    const [h, m] = time.split(':').map(Number)
    const prayerTime = new Date()
    prayerTime.setHours(h, m, 0, 0)
    if (prayerTime > now) return { name: PRAYER_NAMES[i], time }
  }
  // All prayers passed — return tomorrow's Fajr
  return schedule.fajrAdhan ? { name: 'Fajr', time: schedule.fajrAdhan } : null
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

  const { data } = useQuery({
    queryKey: ['prayer-widget', mosqueId, today],
    queryFn: () => api.get(`/mosques/${mosqueId}/prayer-times?date=${today}`),
    enabled: !!mosqueId,
    staleTime: 1000 * 60 * 10,
  })

  const schedule = data?.data
  const next = getNextPrayer(schedule)

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
        </View>
      ) : (
        <Text style={{ color: colors.isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '500' }}>Tap to view prayer times →</Text>
      )}
    </TouchableOpacity>
  )
}
