import { View, Text, TouchableOpacity } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-expo'
import { router } from 'expo-router'
import { useTheme } from '../contexts/ThemeContext'
import { api } from '../lib/api'

const PRAYER_ORDER = ['FAJR', 'DHUHR', 'ASR', 'MAGHRIB', 'ISHA']
const PRAYER_ICONS: Record<string, string> = {
  FAJR: '🌙', DHUHR: '☀️', ASR: '🌤', MAGHRIB: '🌅', ISHA: '🌃',
}

export function StreakWidget() {
  const { colors } = useTheme()
  const { isSignedIn } = useAuth()

  const { data } = useQuery({
    queryKey: ['streaks'],
    queryFn: () => api.get<any>('/streaks/me'),
    enabled: !!isSignedIn,
    staleTime: 1000 * 60 * 5,
  })

  if (!isSignedIn) return null

  const prayerStreak = data?.data?.prayer?.current ?? 0
  const loginStreak = data?.data?.login?.current ?? 0
  const todayPrayed: string[] = data?.data?.todayPrayed ?? []
  const prayedCount = todayPrayed.length

  return (
    <TouchableOpacity
      onPress={() => router.push('/(tabs)/prayer')}
      activeOpacity={0.85}
      style={{
        marginHorizontal: 16,
        marginBottom: 18,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: 3 },
        shadowRadius: 10,
        elevation: 2,
      }}
    >
      {/* Header row */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 10,
        gap: 8,
      }}>
        <Text style={{ fontSize: 18 }}>🔥</Text>
        <Text style={{ flex: 1, color: colors.text, fontWeight: '700', fontSize: 15, letterSpacing: -0.2 }}>
          Daily Streaks
        </Text>
        <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
          {prayedCount}/5 today
        </Text>
      </View>

      {/* Streak counters */}
      <View style={{
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingBottom: 14,
        gap: 12,
      }}>
        {/* Prayer streak */}
        <View style={{
          flex: 1,
          backgroundColor: prayerStreak > 0 ? colors.primaryLight : colors.surfaceSecondary,
          borderRadius: 14,
          padding: 12,
          alignItems: 'center',
          gap: 4,
        }}>
          <Text style={{ fontSize: 26 }}>🕌</Text>
          <Text style={{
            color: prayerStreak > 0 ? colors.primary : colors.textTertiary,
            fontWeight: '800',
            fontSize: 24,
            letterSpacing: -1,
          }}>
            {prayerStreak}
          </Text>
          <Text style={{
            color: prayerStreak > 0 ? colors.primary : colors.textTertiary,
            fontSize: 11,
            fontWeight: '600',
          }}>
            Prayer Streak
          </Text>
        </View>

        {/* Login streak */}
        <View style={{
          flex: 1,
          backgroundColor: loginStreak > 0
            ? (colors.isDark ? '#2D1F0A' : '#FFF7ED')
            : colors.surfaceSecondary,
          borderRadius: 14,
          padding: 12,
          alignItems: 'center',
          gap: 4,
        }}>
          <Text style={{ fontSize: 26 }}>🔥</Text>
          <Text style={{
            color: loginStreak > 0
              ? (colors.isDark ? '#FB923C' : '#C2410C')
              : colors.textTertiary,
            fontWeight: '800',
            fontSize: 24,
            letterSpacing: -1,
          }}>
            {loginStreak}
          </Text>
          <Text style={{
            color: loginStreak > 0
              ? (colors.isDark ? '#FB923C' : '#C2410C')
              : colors.textTertiary,
            fontSize: 11,
            fontWeight: '600',
          }}>
            Day Streak
          </Text>
        </View>
      </View>

      {/* Today's prayers */}
      <View style={{
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingHorizontal: 16,
        paddingBottom: 14,
      }}>
        {PRAYER_ORDER.map((prayer) => {
          const done = todayPrayed.includes(prayer)
          return (
            <View key={prayer} style={{ alignItems: 'center', gap: 4 }}>
              <View style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: done ? colors.primary : colors.surfaceSecondary,
                borderWidth: done ? 0 : 1,
                borderColor: colors.border,
              }}>
                <Text style={{ fontSize: done ? 16 : 14, opacity: done ? 1 : 0.4 }}>
                  {done ? '✓' : PRAYER_ICONS[prayer]}
                </Text>
              </View>
              <Text style={{
                fontSize: 9,
                fontWeight: '700',
                letterSpacing: 0.3,
                color: done ? colors.primary : colors.textTertiary,
              }}>
                {prayer.slice(0, 3)}
              </Text>
            </View>
          )
        })}
      </View>

      {/* Progress bar */}
      <View style={{ marginHorizontal: 16, marginBottom: 14, height: 4, borderRadius: 2, backgroundColor: colors.surfaceSecondary, overflow: 'hidden' }}>
        <View style={{
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.primary,
          width: `${(prayedCount / 5) * 100}%`,
        }} />
      </View>
    </TouchableOpacity>
  )
}
