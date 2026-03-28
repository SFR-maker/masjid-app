import { useState, useEffect } from 'react'
import { View, Text, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Switch, Platform } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { api } from '../../lib/api'
import { useTheme } from '../../contexts/ThemeContext'

function Field({ label, value, onChangeText, placeholder, multiline, keyboardType }: any) {
  const { colors } = useTheme()
  return (
    <View>
      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 5 }}>{label}</Text>
      <TextInput
        style={{ backgroundColor: colors.inputBackground ?? colors.surfaceSecondary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.border, ...(multiline ? { minHeight: 80 } : {}) }}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize="none"
      />
    </View>
  )
}

function Toggle({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (v: boolean) => void }) {
  const { colors } = useTheme()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Text style={{ fontSize: 14, color: colors.text }}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ false: colors.border, true: colors.primary }} />
    </View>
  )
}

export function SettingsSection({ mosqueId }: { mosqueId: string }) {
  const { colors } = useTheme()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'info' | 'social' | 'features'>('info')
  const [form, setForm] = useState<Record<string, any>>({})
  const [loaded, setLoaded] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['mosque-profile', mosqueId],
    queryFn: () => api.get(`/mosques/${mosqueId}`),
    staleTime: 30_000,
  })

  const mosque = data?.data
  useEffect(() => {
    if (mosque && !loaded) {
      setForm({
        name: mosque.name ?? '',
        description: mosque.description ?? '',
        address: mosque.address ?? '',
        city: mosque.city ?? '',
        state: mosque.state ?? '',
        country: mosque.country ?? 'US',
        zipCode: mosque.zipCode ?? '',
        phone: mosque.phone ?? '',
        email: mosque.email ?? '',
        website: mosque.website ?? '',
        imamName: mosque.imamName ?? '',
        capacityMen: mosque.capacityMen ? String(mosque.capacityMen) : '',
        capacityWomen: mosque.capacityWomen ? String(mosque.capacityWomen) : '',
        facebookUrl: mosque.facebookUrl ?? '',
        twitterUrl: mosque.twitterUrl ?? '',
        instagramUrl: mosque.instagramUrl ?? '',
        youtubeUrl: mosque.youtubeUrl ?? '',
        hasWomensPrayer: mosque.hasWomensPrayer ?? false,
        hasYouthPrograms: mosque.hasYouthPrograms ?? false,
        hasParking: mosque.hasParking ?? false,
        isAccessible: mosque.isAccessible ?? false,
        hasWuduFacility: mosque.hasWuduFacility ?? false,
        hasQuranClasses: mosque.hasQuranClasses ?? false,
        hasFuneralServices: mosque.hasFuneralServices ?? false,
        hasMarriageServices: mosque.hasMarriageServices ?? false,
        isOpenToVisitors: mosque.isOpenToVisitors ?? true,
      })
      setLoaded(true)
    }
  }, [mosque, loaded])

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }))

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, any> = { ...form }
      if (form.capacityMen) payload.capacityMen = Number(form.capacityMen)
      else delete payload.capacityMen
      if (form.capacityWomen) payload.capacityWomen = Number(form.capacityWomen)
      else delete payload.capacityWomen
      return api.put(`/mosques/${mosqueId}`, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mosque-profile', mosqueId] })
      queryClient.invalidateQueries({ queryKey: ['admin-mosques'] })
      Alert.alert('Saved', 'Mosque settings updated successfully.')
    },
    onError: (e: any) => Alert.alert('Error', e.message ?? 'Could not save settings.'),
  })

  if (isLoading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />

  const TABS: { key: typeof tab; label: string; icon: string }[] = [
    { key: 'info', label: 'Info', icon: 'information-circle-outline' },
    { key: 'social', label: 'Social', icon: 'share-social-outline' },
    { key: 'features', label: 'Features', icon: 'options-outline' },
  ]

  return (
    <View style={{ flex: 1 }}>
      {/* Tabs — scrollable so they never clip on small screens */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: 'row' }} style={{ borderBottomWidth: 1, borderBottomColor: colors.border, flexGrow: 0 }}>
        {TABS.map((t) => (
          <TouchableOpacity key={t.key} onPress={() => setTab(t.key)} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: tab === t.key ? colors.primary : colors.surface, borderWidth: 1, borderColor: tab === t.key ? colors.primary : colors.border }}>
            <Ionicons name={t.icon as any} size={13} color={tab === t.key ? colors.primaryContrast : colors.textSecondary} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: tab === t.key ? colors.primaryContrast : colors.textSecondary }}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">

        {tab === 'info' && (
          <>
            <Field label="Mosque Name *" value={form.name} onChangeText={(v: string) => set('name', v)} placeholder="Islamic Center of..." />
            <Field label="Description" value={form.description} onChangeText={(v: string) => set('description', v)} placeholder="About your mosque..." multiline />
            <Field label="Street Address" value={form.address} onChangeText={(v: string) => set('address', v)} placeholder="123 Main St" />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 2 }}><Field label="City" value={form.city} onChangeText={(v: string) => set('city', v)} placeholder="Dallas" /></View>
              <View style={{ flex: 1 }}><Field label="State" value={form.state} onChangeText={(v: string) => set('state', v)} placeholder="TX" /></View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Field label="ZIP Code" value={form.zipCode} onChangeText={(v: string) => set('zipCode', v)} placeholder="75001" keyboardType="numeric" /></View>
              <View style={{ flex: 1 }}><Field label="Country" value={form.country} onChangeText={(v: string) => set('country', v)} placeholder="US" /></View>
            </View>
            <Field label="Phone" value={form.phone} onChangeText={(v: string) => set('phone', v)} placeholder="+1 (555) 000-0000" keyboardType="phone-pad" />
            <Field label="Email" value={form.email} onChangeText={(v: string) => set('email', v)} placeholder="info@mosque.org" keyboardType="email-address" />
            <Field label="Website" value={form.website} onChangeText={(v: string) => set('website', v)} placeholder="https://mosque.org" keyboardType="url" />
            <Field label="Imam / Director Name" value={form.imamName} onChangeText={(v: string) => set('imamName', v)} placeholder="Sheikh Ahmed" />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Field label="Men's Capacity" value={form.capacityMen} onChangeText={(v: string) => set('capacityMen', v)} placeholder="500" keyboardType="numeric" /></View>
              <View style={{ flex: 1 }}><Field label="Women's Capacity" value={form.capacityWomen} onChangeText={(v: string) => set('capacityWomen', v)} placeholder="200" keyboardType="numeric" /></View>
            </View>
          </>
        )}

        {tab === 'social' && (
          <>
            <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>Add your social media links so followers can connect with your mosque.</Text>
            {[
              { label: 'Facebook URL', key: 'facebookUrl', placeholder: 'https://facebook.com/yourmosque', icon: 'logo-facebook' },
              { label: 'Instagram URL', key: 'instagramUrl', placeholder: 'https://instagram.com/yourmosque', icon: 'logo-instagram' },
              { label: 'Twitter / X URL', key: 'twitterUrl', placeholder: 'https://twitter.com/yourmosque', icon: 'logo-twitter' },
              { label: 'YouTube URL', key: 'youtubeUrl', placeholder: 'https://youtube.com/@yourmosque', icon: 'logo-youtube' },
            ].map(({ label, key, placeholder, icon }) => (
              <View key={key}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <Ionicons name={icon as any} size={16} color={colors.textSecondary} />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>{label}</Text>
                </View>
                <TextInput
                  style={{ backgroundColor: colors.inputBackground ?? colors.surfaceSecondary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.border }}
                  placeholder={placeholder}
                  placeholderTextColor={colors.textTertiary}
                  value={form[key]}
                  onChangeText={(v) => set(key, v)}
                  keyboardType="url"
                  autoCapitalize="none"
                />
              </View>
            ))}
          </>
        )}

        {tab === 'features' && (
          <>
            <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>
              Enable the features your mosque offers. These appear on your public profile.
            </Text>
            <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border }}>
              {[
                { key: 'hasWomensPrayer', label: "Women's Prayer Area" },
                { key: 'hasYouthPrograms', label: 'Youth Programs' },
                { key: 'hasParking', label: 'Parking Available' },
                { key: 'isAccessible', label: 'Wheelchair Accessible' },
                { key: 'hasWuduFacility', label: 'Wudu Facility' },
                { key: 'hasQuranClasses', label: "Qur'an Classes" },
                { key: 'hasFuneralServices', label: 'Funeral / Janazah Services' },
                { key: 'hasMarriageServices', label: 'Marriage Services' },
                { key: 'isOpenToVisitors', label: 'Open to Non-Muslim Visitors' },
              ].map(({ key, label }) => (
                <Toggle key={key} label={label} value={!!form[key]} onValueChange={(v) => set(key, v)} />
              ))}
            </View>
          </>
        )}

        <TouchableOpacity
          onPress={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10 }}
        >
          {saveMutation.isPending ? <ActivityIndicator color={colors.primaryContrast} /> : <Ionicons name="save-outline" size={18} color={colors.primaryContrast} />}
          <Text style={{ color: colors.primaryContrast, fontSize: 15, fontWeight: '700' }}>{saveMutation.isPending ? 'Saving…' : 'Save Settings'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}
