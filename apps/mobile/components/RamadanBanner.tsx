import { View, Text, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import { useTheme } from '../contexts/ThemeContext'

function toHijri(date: Date) {
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
  return { day: hDay, month: hMonth } // 1-indexed month
}

function getSuhoorIftar(coords?: { latitude: number; longitude: number } | null): null {
  // Placeholder — actual calculation uses the same Aladhan API the prayer screen uses
  return null
}

export function RamadanBanner() {
  const { colors } = useTheme()
  const today = new Date()
  const hijri = toHijri(today)

  // Ramadan = Hijri month 9 (1-indexed)
  const isRamadan = hijri.month === 9
  // Also show last few days of Sha'ban (month 8) as a heads-up
  const isShabanEnd = hijri.month === 8 && hijri.day >= 25

  if (!isRamadan && !isShabanEnd) return null

  const daysLeft = isRamadan ? 30 - hijri.day : null
  const daysUntil = isShabanEnd ? 30 - hijri.day + 1 : null

  return (
    <TouchableOpacity
      onPress={() => router.push('/(tabs)/prayer')}
      activeOpacity={0.88}
      style={{
        marginHorizontal: 16,
        marginBottom: 18,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: '#0C2340',
      }}
    >
      {/* Stars background decoration */}
      <View style={{ position: 'absolute', top: 10, right: 16, opacity: 0.4 }}>
        <Text style={{ fontSize: 40 }}>✨</Text>
      </View>

      <View style={{ padding: 18 }}>
        {isShabanEnd && !isRamadan ? (
          <>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 4 }}>
              RAMADAN APPROACHING
            </Text>
            <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 20, letterSpacing: -0.4, marginBottom: 6 }}>
              🌙 {daysUntil} day{daysUntil !== 1 ? 's' : ''} until Ramadan
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 18 }}>
              Prepare your intentions and set up your prayer times
            </Text>
          </>
        ) : (
          <>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 4 }}>
              RAMADAN {new Date().getFullYear()}
            </Text>
            <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 22, letterSpacing: -0.5, marginBottom: 2 }}>
              🌙 Day {hijri.day} of Ramadan
            </Text>
            {daysLeft !== null && daysLeft > 0 && (
              <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginBottom: 10 }}>
                {daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining · Laylat al-Qadr on night 27
              </Text>
            )}

            {/* Juz tracker */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' }}>
                📖 Today's Juz: {hijri.day}/30
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/quran')}
                style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}
              >
                <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>Open Quran →</Text>
              </TouchableOpacity>
            </View>

            {/* Progress strip */}
            <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' }}>
              <View style={{
                height: 4,
                borderRadius: 2,
                backgroundColor: '#A78BFA',
                width: `${(hijri.day / 30) * 100}%`,
              }} />
            </View>

            {hijri.day >= 21 && (
              <View style={{ marginTop: 10, backgroundColor: 'rgba(167,139,250,0.2)', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)' }}>
                <Text style={{ color: '#A78BFA', fontWeight: '700', fontSize: 12 }}>
                  ✨ Last 10 nights — seek Laylat al-Qadr
                </Text>
              </View>
            )}
          </>
        )}
      </View>
    </TouchableOpacity>
  )
}
