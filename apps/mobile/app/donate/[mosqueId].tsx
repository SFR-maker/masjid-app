import { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Switch, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { useStripe } from '@stripe/stripe-react-native'
import { api } from '../../lib/api'
import { useTheme } from '../../contexts/ThemeContext'

const PRESET_AMOUNTS = [5, 10, 25, 50, 100, 250]

const CATEGORY_LABELS: Record<string, string> = {
  GENERAL: 'General',
  ZAKAT: 'Zakat',
  SADAQAH: 'Sadaqah',
  BUILDING_FUND: 'Building Fund',
  RAMADAN: 'Ramadan',
  EID: 'Eid',
  YOUTH_PROGRAMS: 'Youth Programs',
  EDUCATION: 'Education',
  OTHER: 'Other',
}

export default function DonateScreen() {
  const { mosqueId } = useLocalSearchParams<{ mosqueId: string }>()
  const { colors } = useTheme()
  const { initPaymentSheet, presentPaymentSheet } = useStripe()

  const [selectedAmount, setSelectedAmount] = useState<number>(25)
  const [customAmount, setCustomAmount] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null)
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const { data: mosqueData } = useQuery({
    queryKey: ['mosque', mosqueId],
    queryFn: () => api.get(`/mosques/${mosqueId}`),
    enabled: !!mosqueId,
  })

  const { data: campaignsData } = useQuery({
    queryKey: ['mosque-campaigns', mosqueId],
    queryFn: () => api.get(`/mosques/${mosqueId}/donations`),
    enabled: !!mosqueId,
  })

  const mosque = mosqueData?.data
  const campaigns: any[] = campaignsData?.data ?? []

  const finalAmount = useCustom
    ? Math.round(parseFloat(customAmount || '0') * 100)
    : selectedAmount * 100

  async function handleDonate() {
    if (finalAmount < 100) {
      Alert.alert('Minimum donation is $1.00')
      return
    }

    setIsLoading(true)
    try {
      const res = await api.post(`/mosques/${mosqueId}/donations/payment-intent`, {
        amount: finalAmount,
        currency: 'usd',
        campaignId: selectedCampaign ?? undefined,
        isAnonymous,
        category: selectedCampaign ? undefined : 'GENERAL',
      })

      const { clientSecret, publishableKey } = res.data

      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: mosque?.name ?? 'Mosque',
        allowsDelayedPaymentMethods: false,
      })

      if (initError) {
        Alert.alert('Payment Error', initError.message)
        setIsLoading(false)
        return
      }

      const { error: presentError } = await presentPaymentSheet()

      if (presentError) {
        if (presentError.code !== 'Canceled') {
          Alert.alert('Payment Failed', presentError.message)
        }
      } else {
        setSuccess(true)
      }
    } catch {
      Alert.alert('Error', 'Could not process donation. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <View style={{
            width: 88, height: 88, borderRadius: 44,
            backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center',
            marginBottom: 24,
          }}>
            <Ionicons name="checkmark-circle" size={52} color="#16A34A" />
          </View>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800', marginBottom: 8, textAlign: 'center' }}>
            JazakAllahu Khayran!
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 8 }}>
            Your donation of ${(finalAmount / 100).toFixed(2)} to {mosque?.name} has been received.
          </Text>
          <Text style={{ color: colors.textTertiary, fontSize: 13, textAlign: 'center', marginBottom: 32 }}>
            A receipt has been sent to your email address.
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              backgroundColor: colors.primary, borderRadius: 14,
              paddingVertical: 14, paddingHorizontal: 40,
            }}
          >
            <Text style={{ color: colors.primaryContrast, fontWeight: '700', fontSize: 16 }}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
        borderBottomWidth: 1, borderBottomColor: colors.surfaceSecondary,
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>Donate</Text>
          {mosque?.name ? (
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>{mosque.name}</Text>
          ) : null}
        </View>
        <Ionicons name="heart" size={22} color={colors.primary} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Amount picker */}
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, marginBottom: 14 }}>
          Choose an amount
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          {PRESET_AMOUNTS.map((amt) => {
            const isSelected = !useCustom && selectedAmount === amt
            return (
              <TouchableOpacity
                key={amt}
                onPress={() => { setSelectedAmount(amt); setUseCustom(false) }}
                style={{
                  flex: 1, minWidth: '28%',
                  paddingVertical: 13,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: isSelected ? colors.primary : colors.surfaceSecondary,
                  backgroundColor: isSelected ? colors.primaryLight : colors.surface,
                  alignItems: 'center',
                }}
              >
                <Text style={{
                  fontWeight: '700', fontSize: 16,
                  color: isSelected ? colors.primary : colors.text,
                }}>
                  ${amt}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Custom amount */}
        <TouchableOpacity
          onPress={() => setUseCustom(true)}
          style={{
            flexDirection: 'row', alignItems: 'center',
            borderRadius: 12, borderWidth: 2,
            borderColor: useCustom ? colors.primary : colors.surfaceSecondary,
            backgroundColor: useCustom ? colors.primaryLight : colors.surface,
            paddingHorizontal: 16, paddingVertical: 13,
            marginBottom: 24,
          }}
        >
          <Text style={{ color: useCustom ? colors.primary : colors.textSecondary, fontWeight: '600', marginRight: 8, fontSize: 16 }}>
            $
          </Text>
          <TextInput
            value={customAmount}
            onChangeText={(t) => { setCustomAmount(t.replace(/[^0-9.]/g, '')); setUseCustom(true) }}
            placeholder="Custom amount"
            placeholderTextColor={colors.textTertiary}
            keyboardType="decimal-pad"
            style={{ flex: 1, color: colors.text, fontSize: 16 }}
          />
        </TouchableOpacity>

        {/* Campaign picker */}
        {campaigns.length > 0 && (
          <>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, marginBottom: 12 }}>
              Designate your gift (optional)
            </Text>
            <View style={{ backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.surfaceSecondary, marginBottom: 24 }}>
              <TouchableOpacity
                onPress={() => setSelectedCampaign(null)}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  paddingHorizontal: 16, paddingVertical: 14,
                  borderBottomWidth: 1, borderBottomColor: colors.surfaceSecondary,
                }}
              >
                <View style={{
                  width: 20, height: 20, borderRadius: 10, borderWidth: 2,
                  borderColor: selectedCampaign === null ? colors.primary : colors.border,
                  backgroundColor: selectedCampaign === null ? colors.primary : colors.surface,
                  alignItems: 'center', justifyContent: 'center', marginRight: 12,
                }}>
                  {selectedCampaign === null && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primaryContrast }} />}
                </View>
                <Text style={{ color: colors.text, fontWeight: '500' }}>General Fund</Text>
              </TouchableOpacity>
              {campaigns.map((c, i) => {
                const isLast = i === campaigns.length - 1
                return (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => setSelectedCampaign(c.id)}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      paddingHorizontal: 16, paddingVertical: 14,
                      borderBottomWidth: isLast ? 0 : 1,
                      borderBottomColor: colors.surfaceSecondary,
                    }}
                  >
                    <View style={{
                      width: 20, height: 20, borderRadius: 10, borderWidth: 2,
                      borderColor: selectedCampaign === c.id ? colors.primary : colors.border,
                      backgroundColor: selectedCampaign === c.id ? colors.primary : colors.surface,
                      alignItems: 'center', justifyContent: 'center', marginRight: 12,
                    }}>
                      {selectedCampaign === c.id && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primaryContrast }} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: '500' }}>{c.title}</Text>
                      {c.goalAmount ? (
                        <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                          ${c.totalRaised.toFixed(0)} raised of ${Number(c.goalAmount).toLocaleString()} goal
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>
          </>
        )}

        {/* Anonymous toggle */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: colors.surface, borderRadius: 16,
          borderWidth: 1, borderColor: colors.surfaceSecondary,
          paddingHorizontal: 16, paddingVertical: 14, marginBottom: 28,
        }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>Donate anonymously</Text>
            <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 1 }}>
              Your name will not be shown to the mosque
            </Text>
          </View>
          <Switch
            value={isAnonymous}
            onValueChange={setIsAnonymous}
            trackColor={{ false: colors.border, true: '#86EFAC' }}
            thumbColor={isAnonymous ? colors.primary : colors.textTertiary}
          />
        </View>

        {/* Summary */}
        <View style={{
          backgroundColor: colors.primaryLight, borderRadius: 14,
          padding: 16, marginBottom: 20, borderWidth: 1, borderColor: colors.primary + '33',
        }}>
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14, marginBottom: 4 }}>
            Donation Summary
          </Text>
          <Text style={{ color: colors.primary, fontSize: 28, fontWeight: '900' }}>
            ${((finalAmount || 0) / 100).toFixed(2)}
          </Text>
          {selectedCampaign && campaigns.find((c) => c.id === selectedCampaign) ? (
            <Text style={{ color: colors.primary, fontSize: 12, marginTop: 2 }}>
              → {campaigns.find((c) => c.id === selectedCampaign)?.title}
            </Text>
          ) : (
            <Text style={{ color: colors.primary, fontSize: 12, marginTop: 2 }}>→ General Fund</Text>
          )}
        </View>

        {/* Donate button */}
        <TouchableOpacity
          onPress={handleDonate}
          disabled={isLoading || finalAmount < 100}
          style={{
            backgroundColor: finalAmount >= 100 ? colors.primary : colors.border,
            borderRadius: 16, paddingVertical: 16,
            alignItems: 'center', marginBottom: 12,
          }}
        >
          {isLoading
            ? <ActivityIndicator color={colors.primaryContrast} />
            : (
              <Text style={{ color: colors.primaryContrast, fontWeight: '800', fontSize: 17 }}>
                Donate ${((finalAmount || 0) / 100).toFixed(2)}
              </Text>
            )
          }
        </TouchableOpacity>

        <Text style={{ color: colors.textTertiary, fontSize: 11, textAlign: 'center', lineHeight: 16 }}>
          Payments are processed securely via Stripe. A receipt will be emailed to you.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}
