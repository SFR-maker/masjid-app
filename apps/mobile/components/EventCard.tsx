import { View, Text, TouchableOpacity } from 'react-native'
import { Image } from 'expo-image'
import { format } from 'date-fns'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { EventListItem } from '@masjid/types'
import { useTheme } from '../contexts/ThemeContext'


const CATEGORY_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  HALAQA:     { bg: '#EDE9FE', text: '#6D28D9', dot: '#8B5CF6' },
  YOUTH:      { bg: '#DBEAFE', text: '#1D4ED8', dot: '#3B82F6' },
  SISTERS:    { bg: '#FCE7F3', text: '#BE185D', dot: '#EC4899' },
  FUNDRAISER: { bg: '#D1FAE5', text: '#065F46', dot: '#10B981' },
  JANAZAH:    { bg: '#F3F4F6', text: '#4B5563', dot: '#9CA3AF' },
  EID:        { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B' },
  RAMADAN:    { bg: '#FEF9C3', text: '#713F12', dot: '#EAB308' },
  GENERAL:    { bg: '#D8F3DC', text: '#14532D', dot: '#22C55E' },
}

interface Props {
  item: EventListItem & { mosqueId?: string; mosqueName?: string; mosque?: { id?: string; name: string; logoUrl?: string }; mosqueLogoUrl?: string }
}

export function EventCard({ item }: Props) {
  const { colors } = useTheme()
  const style = CATEGORY_STYLES[item.category] ?? CATEGORY_STYLES.GENERAL
  const mosqueName = item.mosqueName ?? (item as any).mosque?.name
  const mosqueLogoUrl = (item as any).mosqueLogoUrl ?? (item as any).mosque?.logoUrl
  const mosqueId = item.mosqueId ?? (item as any).mosque?.id
  const startDate = new Date(item.startTime)
  const isGoing = item.userRsvp === 'GOING'
  const isMaybe = item.userRsvp === 'MAYBE'

  return (
    <TouchableOpacity
      onPress={() => router.push(`/event/${item.id}`)}
      activeOpacity={0.9}
      style={{
        marginHorizontal: 16, marginBottom: 14,
        backgroundColor: colors.surface, borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1, borderColor: colors.border,
        shadowColor: colors.primary, shadowOpacity: 0.07,
        shadowOffset: { width: 0, height: 4 }, shadowRadius: 16,
        elevation: 3,
      }}
    >
      {/* Header row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10, gap: 10 }}>
        {mosqueLogoUrl ? (
          <Image source={{ uri: mosqueLogoUrl }} style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: '#F0F0F0' }} contentFit="cover" />
        ) : (
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#D8F3DC', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 15 }}>🕌</Text>
          </View>
        )}
        <TouchableOpacity
          style={{ flex: 1 }}
          onPress={(e) => { e.stopPropagation?.(); if (mosqueId) router.push(`/mosque/${mosqueId}` as any) }}
          activeOpacity={0.7}
          disabled={!mosqueId}
        >
          <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13, letterSpacing: -0.1 }} numberOfLines={1}>
            {mosqueName ?? 'Mosque'}
          </Text>
        </TouchableOpacity>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 5,
          backgroundColor: style.bg, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4,
        }}>
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: style.dot }} />
          <Text style={{ color: style.text, fontSize: 11, fontWeight: '700', letterSpacing: 0.2 }}>
            {item.category.replace('_', ' ')}
          </Text>
        </View>
      </View>

      {/* Image */}
      {(item as any).imageUrl && (
        <Image
          source={{ uri: (item as any).imageUrl }}
          style={{ width: '100%', aspectRatio: 16 / 9 }}
          contentFit="cover"
        />
      )}

      {/* Content */}
      <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, lineHeight: 22, marginBottom: 10, letterSpacing: -0.2 }}>
          {item.title}
        </Text>

        {/* Date + Location strip */}
        <View style={{ backgroundColor: colors.background, borderRadius: 12, padding: 10, gap: 6, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 12 }}>📅</Text>
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '500' }}>
              {format(startDate, 'EEEE, MMM d')}
              {'  ·  '}
              <Text style={{ color: colors.primary, fontWeight: '700' }}>{format(startDate, 'h:mm a')}</Text>
            </Text>
          </View>
          {item.location && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }}>
                <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }} numberOfLines={1}>{item.location}</Text>
            </View>
          )}
        </View>

        {/* Footer row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ flexDirection: 'row', marginRight: 4 }}>
              {[...Array(Math.min(3, item.rsvpCount ?? 0))].map((_, i) => (
                <View key={i} style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colors.primaryLight, borderWidth: 1.5, borderColor: colors.surface, marginLeft: i === 0 ? 0 : -5, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="person" size={9} color={colors.primary} />
                </View>
              ))}
            </View>
            <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
              {item.rsvpCount ?? 0} {(item.rsvpCount ?? 0) === 1 ? 'person' : 'people'} going
            </Text>
          </View>
          <View style={{
            borderRadius: 12,
            paddingHorizontal: 16, paddingVertical: 7,
            backgroundColor: isGoing ? colors.primary : isMaybe ? (colors.isDark ? '#2D1F0A' : '#FEF3C7') : colors.surface,
            borderWidth: isGoing ? 0 : 1,
            borderColor: isMaybe ? (colors.isDark ? '#78350F' : '#D97706') : colors.border,
          }}>
            <Text style={{
              fontSize: 12, fontWeight: '700',
              color: isGoing ? 'white' : isMaybe ? (colors.isDark ? '#FB923C' : '#92400E') : colors.textSecondary,
              letterSpacing: 0.2,
            }}>
              {isGoing ? '✓ Going' : isMaybe ? '? Maybe' : 'RSVP'}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  )
}
