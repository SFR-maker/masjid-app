import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { api } from '../lib/api'
import { useTheme } from '../contexts/ThemeContext'

const CATEGORY_ICONS: Record<string, string> = {
  GENERAL: '🕌',
  ZAKAT: '⚖️',
  SADAQAH: '🤲',
  BUILDING_FUND: '🏗️',
  RAMADAN: '🌙',
  EID: '🎉',
  YOUTH_PROGRAMS: '👦',
  EDUCATION: '📚',
  OTHER: '💝',
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function DonationHistoryScreen() {
  const { colors } = useTheme()

  const { data, isLoading } = useQuery({
    queryKey: ['donation-history'],
    queryFn: () => api.get('/users/me/donations'),
  })

  const donations: any[] = data?.data ?? []

  const total = donations.reduce((sum, d) => sum + d.amount, 0)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
        borderBottomWidth: 1, borderBottomColor: colors.surfaceSecondary,
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>Donation History</Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : donations.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 40, marginBottom: 16 }}>🤲</Text>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 6 }}>No donations yet</Text>
          <Text style={{ color: colors.textTertiary, fontSize: 14, textAlign: 'center' }}>
            Your completed donations will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
          {/* Total summary */}
          <View style={{
            backgroundColor: colors.primary, borderRadius: 20, padding: 20, marginBottom: 20,
          }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 }}>
              TOTAL GIVEN
            </Text>
            <Text style={{ color: '#fff', fontSize: 36, fontWeight: '900' }}>
              ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 4 }}>
              {donations.length} donation{donations.length !== 1 ? 's' : ''}
            </Text>
          </View>

          <View style={{ backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.surfaceSecondary }}>
            {donations.map((donation, i) => {
              const isLast = i === donations.length - 1
              return (
                <View
                  key={donation.id}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    paddingHorizontal: 16, paddingVertical: 14,
                    borderBottomWidth: isLast ? 0 : 1,
                    borderBottomColor: colors.surfaceSecondary,
                  }}
                >
                  {/* Mosque logo or category icon */}
                  {donation.mosque?.logoUrl ? (
                    <Image
                      source={{ uri: donation.mosque.logoUrl }}
                      style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={{
                      width: 40, height: 40, borderRadius: 20,
                      backgroundColor: colors.primaryLight,
                      alignItems: 'center', justifyContent: 'center', marginRight: 12,
                    }}>
                      <Text style={{ fontSize: 20 }}>
                        {CATEGORY_ICONS[donation.category] ?? '💝'}
                      </Text>
                    </View>
                  )}

                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }} numberOfLines={1}>
                      {donation.mosque?.name ?? 'Mosque'}
                    </Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 1 }}>
                      {donation.campaign?.title ?? donation.category.replace('_', ' ')} · {formatDate(donation.createdAt)}
                    </Text>
                  </View>

                  <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 15 }}>
                    ${donation.amount.toFixed(2)}
                  </Text>
                </View>
              )
            })}
          </View>

          <Text style={{ color: colors.textTertiary, fontSize: 12, textAlign: 'center', marginTop: 16, lineHeight: 18 }}>
            May Allah accept your sadaqah. 🤲{'\n'}
            Receipts are emailed at the time of donation.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
