import { View, Text, TouchableOpacity } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import type { MosqueListItem as TMosqueListItem } from '@masjid/types'
import { useTheme } from '../contexts/ThemeContext'

interface Props {
  mosque: TMosqueListItem
  onPress: () => void
}

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

export function MosqueListItem({ mosque, onPress }: Props) {
  const { colors } = useTheme()
  const distanceMi = mosque.distanceKm !== undefined
    ? (mosque.distanceKm * 0.621371).toFixed(1)
    : null

  const features: string[] = []
  if (mosque.hasWomensPrayer) features.push("Sisters' Section")
  if (mosque.hasYouthPrograms) features.push('Youth Programs')

  const isUnclaimed = mosque.hasOwner === false

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: isUnclaimed ? (colors.isDark ? '#3D2E1A' : '#FED7AA') : colors.border,
        shadowColor: colors.isDark ? '#000' : '#0F4423',
        shadowOpacity: colors.isDark ? 0.25 : 0.07,
        shadowOffset: { width: 0, height: 3 },
        shadowRadius: 12,
        elevation: 3,
      }}
    >
      {/* Logo with verified ring */}
      <View style={{ position: 'relative' }}>
        {mosque.logoUrl ? (
          <Image
            source={{ uri: mosque.logoUrl }}
            style={{
              width: 58, height: 58, borderRadius: 17,
              borderWidth: mosque.isVerified ? 2 : 1,
              borderColor: mosque.isVerified ? '#C9963A' : (colors.isDark ? '#2D3D35' : '#EDE6D5'),
            }}
            contentFit="cover"
          />
        ) : (
          <View style={{
            width: 58, height: 58, borderRadius: 17,
            backgroundColor: colors.isDark ? '#1A3328' : '#F0F7F2',
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 1,
            borderColor: colors.isDark ? '#2D3D35' : '#EDE6D5',
          }}>
            <Text style={{ fontSize: 24 }}>🕌</Text>
          </View>
        )}
        {mosque.isVerified && (
          <View style={{
            position: 'absolute', bottom: -3, right: -3,
            width: 18, height: 18, borderRadius: 9,
            backgroundColor: '#C9963A',
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 2, borderColor: colors.surface,
            shadowColor: '#C9963A', shadowOpacity: 0.5,
            shadowOffset: { width: 0, height: 1 }, shadowRadius: 4,
          }}>
            <Ionicons name="checkmark" size={10} color="white" />
          </View>
        )}
      </View>

      {/* Content */}
      <View style={{ flex: 1, marginLeft: 13 }}>
        <Text
          style={{ color: colors.text, fontWeight: '700', fontSize: 16, letterSpacing: -0.3 }}
          numberOfLines={1}
        >
          {mosque.name}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2, fontWeight: '500' }}>
          {mosque.city}, {mosque.state}
        </Text>

        {/* Tags row */}
        {(isUnclaimed || features.length > 0) && (
          <View style={{ flexDirection: 'row', gap: 5, marginTop: 7, flexWrap: 'wrap' }}>
            {isUnclaimed && (
              <View style={{
                backgroundColor: colors.isDark ? '#2D1F0A' : '#FFF7ED',
                borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2.5,
                borderWidth: 1, borderColor: colors.isDark ? '#5C3D15' : '#FED7AA',
              }}>
                <Text style={{ color: colors.isDark ? '#F59E4A' : '#C2410C', fontSize: 10, fontWeight: '700', letterSpacing: 0.2 }}>
                  UNCLAIMED
                </Text>
              </View>
            )}
            {features.map(f => (
              <View
                key={f}
                style={{
                  backgroundColor: colors.isDark ? '#1A3328' : '#F0F7F2',
                  borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2.5,
                  borderWidth: 1, borderColor: colors.isDark ? '#2D4A3E' : '#C8E6D0',
                }}
              >
                <Text style={{ color: colors.isDark ? '#52BA7A' : '#2D7D4F', fontSize: 10, fontWeight: '600' }}>
                  {f}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Right column */}
      <View style={{ alignItems: 'flex-end', gap: 5, marginLeft: 10 }}>
        {mosque.isFavorite ? (
          <Text style={{ fontSize: 15 }}>⭐</Text>
        ) : mosque.isFollowing ? (
          <Ionicons name="bookmark" size={14} color={colors.primary} />
        ) : null}
        {distanceMi && (
          <View style={{
            backgroundColor: colors.isDark ? '#1A3328' : '#E8F5EC',
            borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4,
          }}>
            <Text style={{ color: colors.isDark ? '#4ADE80' : '#1B6B3A', fontSize: 12, fontWeight: '800', letterSpacing: -0.2 }}>
              {distanceMi} mi
            </Text>
          </View>
        )}
        <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '500' }}>
          {formatFollowers(mosque.followersCount)} followers
        </Text>
        <Ionicons name="chevron-forward" size={13} color={colors.textTertiary} />
      </View>
    </TouchableOpacity>
  )
}
