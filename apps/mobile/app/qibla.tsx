import { useState, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, Animated, ActivityIndicator, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import * as Location from 'expo-location'
import { useTheme } from '../contexts/ThemeContext'

const KAABA_LAT = 21.4225
const KAABA_LNG = 39.8262

function bearingToCardinal(bearing: number): string {
  const dirs = ['North', 'North East', 'East', 'South East', 'South', 'South West', 'West', 'North West']
  return dirs[Math.round(bearing / 45) % 8]
}

function calculateQiblaDirection(lat: number, lng: number): number {
  const φ1 = (lat * Math.PI) / 180
  const φ2 = (KAABA_LAT * Math.PI) / 180
  const Δλ = ((KAABA_LNG - lng) * Math.PI) / 180
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  const bearing = (Math.atan2(y, x) * 180) / Math.PI
  return (bearing + 360) % 360
}

export default function QiblaScreen() {
  const { colors } = useTheme()
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [deviceHeading, setDeviceHeading] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasCompass, setHasCompass] = useState(true)
  const rotateAnim = useRef(new Animated.Value(0)).current
  const prevRotation = useRef(0)
  const headingSub = useRef<Location.LocationSubscription | null>(null)

  useEffect(() => {
    ;(async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        setError('Location permission is required to find Qibla direction.')
        setLoading(false)
        return
      }
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
        setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude })
      } catch {
        setError('Could not determine your location. Please try again.')
        setLoading(false)
        return
      }

      // Start compass heading subscription (native only — not available on web)
      if (Platform.OS !== 'web') {
        try {
          headingSub.current = await Location.watchHeadingAsync((heading) => {
            // Use trueHeading when available (GPS-corrected), else magnetic
            const h = heading.trueHeading >= 0 ? heading.trueHeading : heading.magHeading
            setDeviceHeading(h)
          })
        } catch {
          // Device has no magnetometer — show static direction only
          setHasCompass(false)
        }
      } else {
        setHasCompass(false)
      }

      setLoading(false)
    })()

    return () => { if (Platform.OS !== 'web') headingSub.current?.remove() }
  }, [])

  const qiblaAngle = location ? calculateQiblaDirection(location.lat, location.lng) : 0

  // Needle = qibla direction relative to where the phone is currently pointing.
  // When the phone faces Mecca: deviceHeading === qiblaAngle → needleTarget = 0 (points up).
  useEffect(() => {
    if (!location) return
    const target = qiblaAngle - deviceHeading
    // Shortest-path rotation to avoid spinning 350° instead of -10°
    const delta = ((target - prevRotation.current) % 360 + 540) % 360 - 180
    const next = prevRotation.current + delta
    prevRotation.current = next
    Animated.spring(rotateAnim, {
      toValue: next,
      useNativeDriver: true,
      tension: 60,
      friction: 10,
    }).start()
  }, [deviceHeading, qiblaAngle, location])

  const rotate = rotateAnim.interpolate({
    inputRange: [-3600, 3600],
    outputRange: ['-3600deg', '3600deg'],
  })

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.surfaceSecondary }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>Qibla Finder</Text>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        {loading && <ActivityIndicator size="large" color={colors.primary} />}

        {error && (
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>📍</Text>
            <Text style={{ color: colors.textSecondary, textAlign: 'center', fontSize: 14, lineHeight: 22 }}>{error}</Text>
          </View>
        )}

        {location && !error && (
          <>
            <Text style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 40, textAlign: 'center' }}>
              {hasCompass
                ? 'Rotate your phone until the arrow points up'
                : 'Point the arrow toward Mecca (no compass detected)'}
            </Text>

            {/* Compass */}
            <View style={{ width: 260, height: 260, alignItems: 'center', justifyContent: 'center', marginBottom: 40 }}>
              {/* Static compass ring with N/E/S/W labels */}
              <View style={{
                position: 'absolute', width: 260, height: 260, borderRadius: 130,
                borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface,
                shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, elevation: 8,
              }}>
                {['N', 'E', 'S', 'W'].map((dir, i) => {
                  const rad = (i * 90 - 90) * (Math.PI / 180)
                  const r = 110
                  return (
                    <Text key={dir} style={{
                      position: 'absolute',
                      left: 130 + r * Math.cos(rad) - 8,
                      top: 130 + r * Math.sin(rad) - 10,
                      fontWeight: '700', fontSize: 13,
                      color: dir === 'N' ? '#EF4444' : colors.textTertiary,
                    }}>{dir}</Text>
                  )
                })}
              </View>

              {/* Rotating Qibla needle */}
              <Animated.View style={{ transform: [{ rotate }], alignItems: 'center' }}>
                {/* Arrow tip */}
                <View style={{
                  width: 0, height: 0,
                  borderLeftWidth: 10, borderRightWidth: 10, borderBottomWidth: 18,
                  borderLeftColor: 'transparent', borderRightColor: 'transparent',
                  borderBottomColor: colors.primary,
                  marginBottom: -1,
                }} />
                {/* Upper shaft */}
                <View style={{ width: 6, height: 72, borderRadius: 3, backgroundColor: colors.primary }} />
                {/* Kaaba at center */}
                <Text style={{ fontSize: 26, marginVertical: -4 }}>🕋</Text>
                {/* Lower shaft (grey) */}
                <View style={{ width: 6, height: 44, borderRadius: 3, backgroundColor: colors.border }} />
                {/* Tail dot */}
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.textTertiary, marginTop: -1 }} />
              </Animated.View>
            </View>

            <View style={{ backgroundColor: colors.primaryLight, borderRadius: 16, padding: 16, alignItems: 'center', width: '100%' }}>
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                Qibla Direction
              </Text>
              <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 26 }}>
                {bearingToCardinal(qiblaAngle)}
              </Text>
              <Text style={{ color: colors.primary, fontSize: 14, marginTop: 2 }}>
                {Math.round(qiblaAngle)}° from North
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                {location.lat.toFixed(4)}°{location.lat >= 0 ? 'N' : 'S'}, {Math.abs(location.lng).toFixed(4)}°{location.lng >= 0 ? 'E' : 'W'}
              </Text>
            </View>

            {!hasCompass && (
              <View style={{ backgroundColor: colors.isDark ? '#422006' : '#FEF3C7', borderRadius: 12, padding: 12, marginTop: 16, width: '100%' }}>
                <Text style={{ color: colors.isDark ? '#fde68a' : '#92400E', fontSize: 12, textAlign: 'center' }}>
                  Compass sensor not available on this device. The arrow shows the direction from North.
                </Text>
              </View>
            )}

            {hasCompass && Platform.OS !== 'web' && (
              <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 16, textAlign: 'center', lineHeight: 18 }}>
                Keep away from metal objects for best accuracy.
              </Text>
            )}

            {Platform.OS === 'web' && (
              <View style={{ backgroundColor: colors.isDark ? '#422006' : '#FEF3C7', borderRadius: 12, padding: 12, marginTop: 16, width: '100%' }}>
                <Text style={{ color: colors.isDark ? '#fde68a' : '#92400E', fontSize: 12, textAlign: 'center' }}>
                  Compass requires the native app. The arrow shows the direction from North.
                </Text>
              </View>
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  )
}
