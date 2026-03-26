import { useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, TextInput,
} from 'react-native'
import { Image } from 'expo-image'
import { useQuery } from '@tanstack/react-query'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { api } from '../../lib/api'
import { useTheme } from '../../contexts/ThemeContext'

const CATEGORIES = ['All', 'LECTURE', 'QURAN', 'KHUTBAH', 'EDUCATIONAL', 'DUA']

const CATEGORY_LABELS: Record<string, string> = {
  All: 'All',
  LECTURE: 'Lecture',
  QURAN: 'Quran',
  KHUTBAH: 'Khutbah',
  EDUCATIONAL: 'Educational',
  DUA: "Du'a",
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  LECTURE:     { bg: '#EDE9FE', text: '#6D28D9' },
  QURAN:       { bg: '#D1FAE5', text: '#065F46' },
  KHUTBAH:     { bg: '#DBEAFE', text: '#1D4ED8' },
  EDUCATIONAL: { bg: '#FEF3C7', text: '#92400E' },
  DUA:         { bg: '#FCE7F3', text: '#BE185D' },
}

export default function VideosScreen() {
  const { colors } = useTheme()
  const [category, setCategory] = useState('All')
  const [query, setQuery] = useState('')

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['videos-feed', category, query],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '20' })
      if (category !== 'All') params.set('category', category)
      if (query) params.set('q', query)
      return api.get(`/videos?${params.toString()}`)
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  })

  const videos = data?.data?.items ?? []

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.6, marginBottom: 4 }}>
          Videos
        </Text>
        <Text style={{ fontSize: 13, color: colors.textTertiary, fontWeight: '500', marginBottom: 14 }}>
          Lectures, khutbahs & more
        </Text>
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
          borderRadius: 18, paddingHorizontal: 14, paddingVertical: 13,
          shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6,
          elevation: 1,
        }}>
          <Ionicons name="search" size={17} color={colors.textTertiary} />
          <TextInput
            style={{ flex: 1, marginLeft: 9, fontSize: 15, color: colors.text }}
            placeholder="Search lectures, khutbahs…"
            placeholderTextColor={colors.textTertiary}
            value={query}
            onChangeText={setQuery}
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={17} color={colors.textTertiary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Category chips */}
      <View style={{ marginTop: 12, marginBottom: 4 }}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATEGORIES}
          keyExtractor={(c) => c}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          renderItem={({ item: c }) => {
            const active = c === category
            return (
              <TouchableOpacity
                onPress={() => setCategory(c)}
                style={{
                  paddingHorizontal: 16, paddingVertical: 8, borderRadius: 22,
                  backgroundColor: active ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                  shadowColor: active ? colors.primary : '#000',
                  shadowOpacity: active ? 0.18 : 0.03,
                  shadowOffset: { width: 0, height: 2 }, shadowRadius: 6,
                  elevation: active ? 3 : 1,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: active ? colors.primaryContrast : colors.text, letterSpacing: 0.1 }}>
                  {CATEGORY_LABELS[c] ?? c}
                </Text>
              </TouchableOpacity>
            )
          }}
        />
      </View>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={videos}
          keyExtractor={(v: any) => v.id}
          onRefresh={refetch}
          refreshing={isRefetching}
          contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          renderItem={({ item: v }: { item: any }) => {
            const catStyle = CATEGORY_COLORS[v.category] ?? { bg: '#F3F4F6', text: '#4B5563' }
            return (
              <TouchableOpacity
                style={{
                  flex: 1, backgroundColor: colors.surface, borderRadius: 18,
                  overflow: 'hidden', marginBottom: 12,
                  borderWidth: 1, borderColor: colors.border,
                  shadowColor: colors.primary, shadowOpacity: 0.05,
                  shadowOffset: { width: 0, height: 3 }, shadowRadius: 10,
                  elevation: 2,
                }}
                onPress={() => router.push(`/video/${v.id}`)}
                activeOpacity={0.85}
              >
                {/* Thumbnail */}
                <View style={{ width: '100%', aspectRatio: 16 / 9, position: 'relative' }}>
                  {v.thumbnailUrl ? (
                    <Image source={{ uri: v.thumbnailUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                  ) : (
                    <View style={{ flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name="play-circle" size={30} color="rgba(255,255,255,0.4)" />
                    </View>
                  )}
                  {/* Play overlay */}
                  {v.thumbnailUrl && (
                    <View style={{ position: 'absolute', bottom: 6, right: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="play" size={11} color="white" style={{ marginLeft: 1 }} />
                    </View>
                  )}
                </View>

                {/* Content */}
                <View style={{ padding: 10 }}>
                  <View style={{ backgroundColor: catStyle.bg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start', marginBottom: 5 }}>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: catStyle.text, letterSpacing: 0.3 }}>
                      {(v.category ?? '').replace('_', ' ')}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, lineHeight: 18, letterSpacing: -0.1 }} numberOfLines={2}>
                    {v.title}
                  </Text>
                  {v.mosque && (
                    <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 4, fontWeight: '500' }} numberOfLines={1}>{v.mosque.name}</Text>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 5 }}>
                    <Ionicons name="eye-outline" size={11} color="#C4C9D4" />
                    <Text style={{ fontSize: 11, color: colors.textTertiary, fontWeight: '500' }}>{(v.viewCount ?? 0).toLocaleString()}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )
          }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 72, paddingHorizontal: 40 }}>
              <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 34 }}>🎬</Text>
              </View>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 6 }}>No videos found</Text>
              <Text style={{ fontSize: 14, color: colors.textTertiary, textAlign: 'center', lineHeight: 20 }}>Follow mosques to see their lectures and video content</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}
