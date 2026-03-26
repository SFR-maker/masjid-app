'use client'
import { useState, useEffect, useMemo } from 'react'
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, SectionList,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Location from 'expo-location'
import { router } from 'expo-router'
import { api } from '../../lib/api'
import { MosqueListItem } from '../../components/MosqueListItem'
import { useTheme } from '../../contexts/ThemeContext'
import type { MosqueListItem as TMosqueListItem } from '@masjid/types'

const RADIUS_KM = 32   // 20 miles ≈ 32.2 km
const ZIP_RE = /^\d{5}$/

// State name ↔ abbreviation map
const STATE_MAP: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS',
  missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK',
  oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
}
const STATE_ABBRS = new Set(Object.values(STATE_MAP))
const ABBR_TO_NAME = Object.fromEntries(Object.entries(STATE_MAP).map(([k, v]) => [v, k]))

// Returns a 2-letter abbreviation if the query is a US state name or abbreviation, else null
function detectStateQuery(q: string): string | null {
  const trimmed = q.trim()
  const upper = trimmed.toUpperCase()
  if (STATE_ABBRS.has(upper)) return upper
  const lower = trimmed.toLowerCase()
  if (STATE_MAP[lower]) return STATE_MAP[lower]
  return null
}

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

// Sort results: favorite first → following → rest
function sortByEngagement(items: TMosqueListItem[]): TMosqueListItem[] {
  return [...items].sort((a, b) => {
    const scoreA = a.isFavorite ? 2 : a.isFollowing ? 1 : 0
    const scoreB = b.isFavorite ? 2 : b.isFollowing ? 1 : 0
    return scoreB - scoreA
  })
}

type Section = { title: string; data: TMosqueListItem[] }

function buildSections(items: TMosqueListItem[]): Section[] {
  const favorite = items.filter((m) => m.isFavorite)
  const following = items.filter((m) => m.isFollowing && !m.isFavorite)
  const rest = items.filter((m) => !m.isFollowing && !m.isFavorite)

  const sections: Section[] = []
  if (favorite.length > 0) sections.push({ title: 'Your Mosque', data: favorite })
  if (following.length > 0) sections.push({ title: 'Following', data: following })
  if (rest.length > 0) sections.push({ title: favorite.length + following.length > 0 ? 'All Mosques' : '', data: rest })
  return sections
}

export default function DiscoverScreen() {
  const { colors } = useTheme()
  const [query, setQuery] = useState('')
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [loadingGps, setLoadingGps] = useState(false)
  const [zipLocation, setZipLocation] = useState<{ lat: number; lng: number; zip: string } | null>(null)
  const [cityLocation, setCityLocation] = useState<{ lat: number; lng: number; displayName: string } | null>(null)
  const [stateFilter, setStateFilter] = useState<string | null>(null) // e.g. "TX"
  const [geocoding, setGeocoding] = useState(false)

  useEffect(() => {
    const trimmed = query.trim()

    // ZIP code
    if (ZIP_RE.test(trimmed)) {
      setGeocoding(true)
      setStateFilter(null)
      setCityLocation(null)
      const timer = setTimeout(async () => {
        const coords = await geocodeZip(trimmed)
        setGeocoding(false)
        if (coords) {
          setZipLocation({ ...coords, zip: trimmed })
          setGpsLocation(null)
        }
      }, 400)
      return () => { clearTimeout(timer); setGeocoding(false) }
    }

    // State name or abbreviation
    const stateAbbr = detectStateQuery(trimmed)
    if (stateAbbr) {
      setZipLocation(null)
      setCityLocation(null)
      setStateFilter(stateAbbr)
      setGpsLocation(null)
      return
    }

    // City/text geocode
    if (trimmed.length >= 3) {
      setZipLocation(null)
      setStateFilter(null)
      setGeocoding(true)
      const timer = setTimeout(async () => {
        const result = await geocodeCity(trimmed)
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
    setStateFilter(null)
  }, [query])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['mosques', query, gpsLocation, zipLocation, cityLocation, stateFilter],
    queryFn: () => {
      const params = new URLSearchParams()
      const geoCoords = zipLocation ?? cityLocation ?? gpsLocation

      if (stateFilter) {
        params.set('state', stateFilter)
        params.set('limit', '100')
      } else if (geoCoords) {
        params.set('lat', String(geoCoords.lat))
        params.set('lng', String(geoCoords.lng))
        params.set('radius', String(RADIUS_KM))
      } else if (query.trim()) {
        params.set('q', query.trim())
      }

      return api.get(`/mosques?${params.toString()}`)
    },
    staleTime: 30000,
    enabled: !geocoding,
  })

  const rawItems: TMosqueListItem[] = data?.data?.items ?? []
  const sections = useMemo(() => buildSections(rawItems), [rawItems])
  const hasEngagement = rawItems.some((m) => m.isFollowing || m.isFavorite)

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
      const last = await Location.getLastKnownPositionAsync()
      if (last) setGpsLocation({ lat: last.coords.latitude, lng: last.coords.longitude })
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 8000,
      })
      setGpsLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude })
      setZipLocation(null)
      setStateFilter(null)
      setQuery('')
    } finally {
      setLoadingGps(false)
    }
  }

  function handleClearQuery() {
    setQuery('')
    setZipLocation(null)
    setCityLocation(null)
    setStateFilter(null)
  }

  const nearMeActive = gpsLocation !== null

  const statusLine = stateFilter
    ? `All mosques in ${ABBR_TO_NAME[stateFilter] ? ABBR_TO_NAME[stateFilter].replace(/\b\w/g, c => c.toUpperCase()) : stateFilter}`
    : zipLocation
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
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <View>
            <Text style={{ fontSize: 28, fontWeight: '800', letterSpacing: -0.7, color: colors.text }}>
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
              color: nearMeActive ? (colors.isDark ? '#0F2D1F' : '#fff') : colors.primary,
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
          borderColor: stateFilter
            ? colors.primary
            : colors.isDark ? '#334155' : '#E8E0D0',
          borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12,
          shadowColor: colors.isDark ? '#000' : '#0F4423',
          shadowOpacity: colors.isDark ? 0.3 : 0.06,
          shadowOffset: { width: 0, height: 3 }, shadowRadius: 10,
          elevation: 2,
        }}>
          <Ionicons
            name={stateFilter ? 'map-outline' : 'search-outline'}
            size={17}
            color={stateFilter ? colors.primary : colors.textTertiary}
          />
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
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: 6 }}>Connection error</Text>
          <Text style={{ color: colors.textTertiary, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
            Make sure the API is running and try again
          </Text>
        </View>
      ) : rawItems.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 34 }}>🕌</Text>
          </View>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: 6 }}>No mosques found</Text>
          <Text style={{ color: colors.textTertiary, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
            {stateFilter
              ? `No mosques found in ${stateFilter}`
              : zipLocation
              ? `No mosques within 20 miles of ${zipLocation.zip}`
              : query
              ? `No results for "${query}"`
              : 'Try searching by name, city, state, or zip code'}
          </Text>
        </View>
      ) : hasEngagement ? (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) =>
            section.title ? (
              <View style={{ paddingTop: 4, paddingBottom: 8 }}>
                <Text style={{
                  fontSize: 11, fontWeight: '800', letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  color: section.title === 'Your Mosque' ? '#C9963A' : colors.textTertiary,
                }}>
                  {section.title}
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <MosqueListItem
              mosque={item}
              onPress={() => router.push(`/mosque/${item.id}`)}
            />
          )}
        />
      ) : (
        <FlatList
          data={rawItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          renderItem={({ item }) => (
            <MosqueListItem
              mosque={item}
              onPress={() => router.push(`/mosque/${item.id}`)}
            />
          )}
        />
      )}
    </SafeAreaView>
  )
}
