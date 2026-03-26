import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Location from 'expo-location'
import { router } from 'expo-router'
import { api } from '../../lib/api'
import { MosqueListItem } from '../../components/MosqueListItem'
import { useTheme } from '../../contexts/ThemeContext'

const RADIUS_KM = 32   // 20 miles ≈ 32.2 km
const ZIP_RE = /^\d{5}$/
// City pattern: letters/spaces/commas, optional state, at least 3 chars
const CITY_RE = /^[a-zA-Z][a-zA-Z\s,]{2,}$/

async function geocodeZip(zip: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`)
    if (!res.ok) return null
    const json = await res.json() as any
    const place = json.places?.[0]
    if (!place) return null
    return { lat: parseFloat(place.latitude), lng: parseFloat(place.longitude) }
  } catch {
    return null
  }
}

async function geocodeCity(city: string): Promise<{ lat: number; lng: number; displayName: string } | null> {
  try {
    const q = encodeURIComponent(city)
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&countrycodes=us&format=json&limit=1`,
      { headers: { 'User-Agent': 'MasjidApp/1.0' } }
    )
    if (!res.ok) return null
    const json = await res.json() as any
    if (!json[0]) return null
    return {
      lat: parseFloat(json[0].lat),
      lng: parseFloat(json[0].lon),
      displayName: json[0].display_name.split(',').slice(0, 2).join(',').trim(),
    }
  } catch {
    return null
  }
}

export default function DiscoverScreen() {
  const { colors } = useTheme()
  const [query, setQuery] = useState('')
  // GPS location from "Near Me"
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [loadingGps, setLoadingGps] = useState(false)
  // Geocoded zip location
  const [zipLocation, setZipLocation] = useState<{ lat: number; lng: number; zip: string } | null>(null)
  // Geocoded city location
  const [cityLocation, setCityLocation] = useState<{ lat: number; lng: number; displayName: string } | null>(null)
  const [geocoding, setGeocoding] = useState(false)

  // Geocode on zip or city entry (debounced 500ms)
  useEffect(() => {
    if (ZIP_RE.test(query)) {
      setGeocoding(true)
      setCityLocation(null)
      const timer = setTimeout(async () => {
        const coords = await geocodeZip(query)
        setGeocoding(false)
        if (coords) {
          setZipLocation({ ...coords, zip: query })
          setGpsLocation(null)
        }
      }, 400)
      return () => { clearTimeout(timer); setGeocoding(false) }
    }

    if (CITY_RE.test(query) && query.length >= 3) {
      setZipLocation(null)
      setGeocoding(true)
      const timer = setTimeout(async () => {
        const result = await geocodeCity(query)
        setGeocoding(false)
        if (result) {
          setCityLocation(result)
          setGpsLocation(null)
        } else {
          setCityLocation(null)
        }
      }, 500)
      return () => { clearTimeout(timer); setGeocoding(false) }
    }

    setZipLocation(null)
    setCityLocation(null)
  }, [query])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['mosques', query, gpsLocation, zipLocation, cityLocation],
    queryFn: () => {
      const params = new URLSearchParams()
      const geoCoords = zipLocation ?? cityLocation ?? gpsLocation

      if (geoCoords) {
        // Radius search — coords override text query
        params.set('lat', String(geoCoords.lat))
        params.set('lng', String(geoCoords.lng))
        params.set('radius', String(RADIUS_KM))
      } else if (query) {
        params.set('q', query)
      }

      return api.get(`/mosques?${params.toString()}`)
    },
    staleTime: 30000,
    enabled: !geocoding,
  })

  async function handleNearMeToggle() {
    if (gpsLocation) {
      setGpsLocation(null)
      return
    }
    setLoadingGps(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Location Required', 'Please allow location access to find nearby mosques.')
        return
      }
      const loc = await Location.getCurrentPositionAsync({})
      setGpsLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude })
      setZipLocation(null) // GPS overrides zip
      setQuery('')
    } finally {
      setLoadingGps(false)
    }
  }

  function handleClearQuery() {
    setQuery('')
    setZipLocation(null)
    setCityLocation(null)
  }

  const nearMeActive = gpsLocation !== null

  // Status line shown below the search bar
  const statusLine = zipLocation
    ? `Mosques within 20 miles of ${zipLocation.zip}`
    : cityLocation
    ? `Mosques within 20 miles of ${cityLocation.displayName}`
    : nearMeActive
    ? 'Mosques within 20 miles of your location'
    : null

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14 }}>
        {/* Title row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <View>
            <Text style={{
              fontSize: 28, fontWeight: '800', letterSpacing: -0.7,
              color: colors.text,
            }}>
              Discover
            </Text>
            <Text style={{ fontSize: 13, color: colors.textTertiary, fontWeight: '500', marginTop: 2 }}>
              {statusLine ?? 'Find mosques near you'}
            </Text>
          </View>
          {/* Near Me pill */}
          <TouchableOpacity
            onPress={handleNearMeToggle}
            disabled={loadingGps}
            activeOpacity={0.8}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 5,
              borderRadius: 20, paddingHorizontal: 13, paddingVertical: 8,
              backgroundColor: nearMeActive
                ? (colors.isDark ? '#4ADE80' : colors.primary)
                : (colors.isDark ? '#1E293B' : '#F0F7F2'),
              borderWidth: 1,
              borderColor: nearMeActive
                ? (colors.isDark ? '#4ADE80' : colors.primary)
                : (colors.isDark ? '#334155' : '#C8E6D0'),
            }}
          >
            {loadingGps ? (
              <ActivityIndicator size="small" color={nearMeActive ? '#fff' : colors.primary} />
            ) : (
              <Ionicons
                name={nearMeActive ? 'location' : 'location-outline'}
                size={13}
                color={nearMeActive ? (colors.isDark ? '#0F2D1F' : '#fff') : colors.primary}
              />
            )}
            <Text style={{
              fontSize: 12.5, fontWeight: '700',
              color: nearMeActive
                ? (colors.isDark ? '#0F2D1F' : '#fff')
                : colors.primary,
            }}>
              {nearMeActive ? 'Near Me ✕' : 'Near Me'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: colors.isDark ? '#1E293B' : '#fff',
          borderWidth: 1.5,
          borderColor: colors.isDark ? '#334155' : '#E8E0D0',
          borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12,
          shadowColor: colors.isDark ? '#000' : '#0F4423',
          shadowOpacity: colors.isDark ? 0.3 : 0.06,
          shadowOffset: { width: 0, height: 3 }, shadowRadius: 10,
          elevation: 2,
        }}>
          <Ionicons name="search-outline" size={17} color={colors.textTertiary} />
          <TextInput
            style={{ flex: 1, marginLeft: 9, fontSize: 15, color: colors.text, fontWeight: '500' }}
            placeholder="Name, city, state, or zip…"
            placeholderTextColor={colors.textTertiary}
            value={query}
            onChangeText={setQuery}
            keyboardType="default"
          />
          {geocoding ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 4 }} />
          ) : query ? (
            <TouchableOpacity onPress={handleClearQuery} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <View style={{
                width: 20, height: 20, borderRadius: 10,
                backgroundColor: colors.isDark ? '#334155' : '#EDE6D5',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="close" size={12} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {isLoading || geocoding ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <ActivityIndicator color={colors.primary} />
          {geocoding && (
            <Text style={{ color: colors.textTertiary, fontSize: 13, fontWeight: '500' }}>Looking up location…</Text>
          )}
        </View>
      ) : isError ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <Ionicons name="wifi-outline" size={28} color="#EF4444" />
          </View>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: 6 }}>
            Connection error
          </Text>
          <Text style={{ color: colors.textTertiary, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
            Make sure the API is running and try again
          </Text>
        </View>
      ) : (
        <FlatList
          data={data?.data?.items ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          renderItem={({ item }) => (
            <MosqueListItem
              mosque={item}
              onPress={() => router.push(`/mosque/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 72, paddingHorizontal: 40 }}>
              <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 34 }}>🕌</Text>
              </View>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: 6 }}>No mosques found</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
                {zipLocation
                  ? `No mosques within 20 miles of ${zipLocation.zip}`
                  : query
                  ? `No results for "${query}"`
                  : 'Try searching by name, city, or zip code'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}
