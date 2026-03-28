import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Modal } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { api } from '../../lib/api'
import { useTheme } from '../../contexts/ThemeContext'
import { format } from 'date-fns'

const SERVICE_TYPES = [
  'QURAN_CLASSES', 'WOMENS_HALAQA', 'ISLAMIC_SCHOOL', 'SPECIAL_NEEDS',
  'MARRIAGE_SERVICES', 'JANAZAH_SERVICES', 'FACILITY_RENTAL', 'YOUTH_PROGRAMS', 'OTHER',
]

const SERVICE_LABELS: Record<string, string> = {
  QURAN_CLASSES: "Qur'an Classes",
  WOMENS_HALAQA: "Women's Halaqa",
  ISLAMIC_SCHOOL: 'Islamic School',
  SPECIAL_NEEDS: 'Special Needs',
  MARRIAGE_SERVICES: 'Marriage Services',
  JANAZAH_SERVICES: 'Janazah Services',
  FACILITY_RENTAL: 'Facility Rental',
  YOUTH_PROGRAMS: 'Youth Programs',
  OTHER: 'Other',
}

const emptyForm = { type: 'OTHER', name: '', description: '', schedule: '', contact: '', pricing: '' }

export function ServicesSection({ mosqueId }: { mosqueId: string }) {
  const { colors } = useTheme()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'services' | 'requests'>('services')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })

  const { data, isLoading } = useQuery({
    queryKey: ['mosque-services', mosqueId],
    queryFn: () => api.get(`/mosques/${mosqueId}/services`),
    staleTime: 30_000,
  })
  const services: any[] = data?.data?.items ?? []

  const { data: reqData, isLoading: reqLoading } = useQuery({
    queryKey: ['service-requests', mosqueId],
    queryFn: () => api.get(`/mosques/${mosqueId}/service-requests?limit=50`),
    enabled: tab === 'requests',
    staleTime: 30_000,
  })
  const requests: any[] = reqData?.data?.items ?? []

  const createMutation = useMutation({
    mutationFn: () => api.post(`/mosques/${mosqueId}/services`, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mosque-services', mosqueId] })
      setShowForm(false)
      setForm({ ...emptyForm })
    },
    onError: (e: any) => Alert.alert('Error', e.message ?? 'Could not create service.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/mosques/${mosqueId}/services/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mosque-services', mosqueId] }),
    onError: () => Alert.alert('Error', 'Could not delete service.'),
  })

  const updateRequestMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.put(`/mosques/${mosqueId}/service-requests/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['service-requests', mosqueId] }),
    onError: () => Alert.alert('Error', 'Could not update request.'),
  })

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const statusColor = (s: string) => s === 'APPROVED' ? '#059669' : s === 'REJECTED' ? '#EF4444' : colors.textSecondary

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Services</Text>
        {tab === 'services' && (
          <TouchableOpacity
            onPress={() => setShowForm(true)}
            activeOpacity={0.8}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 }}
          >
            <Ionicons name="add" size={16} color={colors.primaryContrast} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primaryContrast }}>Add</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Sub-tabs */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12 }}>
        {(['services', 'requests'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            activeOpacity={0.8}
            style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: tab === t ? colors.primary : colors.surface, borderWidth: 1, borderColor: tab === t ? colors.primary : colors.border }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: tab === t ? colors.primaryContrast : colors.textSecondary }}>
              {t === 'services' ? 'Services' : 'Requests'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'services' ? (
        isLoading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> :
        services.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
            <Ionicons name="layers-outline" size={40} color={colors.textTertiary} />
            <Text style={{ color: colors.textTertiary, fontSize: 14 }}>No services added yet</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 100 }}>
            {services.map((svc) => (
              <View key={svc.id} style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{svc.name}</Text>
                    <View style={{ backgroundColor: colors.primaryLight, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 4 }}>
                      <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '700' }}>{SERVICE_LABELS[svc.type] ?? svc.type}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => Alert.alert('Delete', `Delete "${svc.name}"?`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(svc.id) },
                    ])}
                    activeOpacity={0.7}
                    style={{ padding: 10 }}
                  >
                    <Ionicons name="trash-outline" size={17} color="#EF4444" />
                  </TouchableOpacity>
                </View>
                {svc.description ? <Text style={{ fontSize: 13, color: colors.textSecondary }}>{svc.description}</Text> : null}
                {svc.schedule ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="time-outline" size={13} color={colors.textTertiary} />
                    <Text style={{ fontSize: 12, color: colors.textTertiary }}>{svc.schedule}</Text>
                  </View>
                ) : null}
                {svc.pricing ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="pricetag-outline" size={13} color={colors.textTertiary} />
                    <Text style={{ fontSize: 12, color: colors.textTertiary }}>{svc.pricing}</Text>
                  </View>
                ) : null}
              </View>
            ))}
          </ScrollView>
        )
      ) : (
        reqLoading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> :
        requests.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
            <Ionicons name="clipboard-outline" size={40} color={colors.textTertiary} />
            <Text style={{ color: colors.textTertiary, fontSize: 14 }}>No service requests</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 100 }}>
            {requests.map((r) => (
              <View key={r.id} style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{r.name}</Text>
                    <Text style={{ fontSize: 12, color: colors.textTertiary }}>{r.service?.name} · {format(new Date(r.createdAt), 'MMM d, yyyy')}</Text>
                  </View>
                  <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: statusColor(r.status) }}>{r.status}</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>{r.message}</Text>
                {r.status === 'PENDING' && (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => updateRequestMutation.mutate({ id: r.id, status: 'APPROVED' })}
                      activeOpacity={0.8}
                      style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primaryContrast }}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => updateRequestMutation.mutate({ id: r.id, status: 'REJECTED' })}
                      activeOpacity={0.8}
                      style={{ flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#EF4444' }}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        )
      )}

      {/* Add Service Modal */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Add Service</Text>
            <TouchableOpacity onPress={() => setShowForm(false)} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ padding: 8 }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
            <View>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>Service Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {SERVICE_TYPES.map((t) => (
                    <TouchableOpacity
                      key={t}
                      onPress={() => set('type', t)}
                      activeOpacity={0.8}
                      style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: form.type === t ? colors.primary : colors.surface, borderWidth: 1, borderColor: form.type === t ? colors.primary : colors.border }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: form.type === t ? colors.primaryContrast : colors.textSecondary }}>{SERVICE_LABELS[t]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
            {[
              { label: 'Service Name *', key: 'name', placeholder: 'e.g. Saturday Qur\'an Class' },
              { label: 'Description', key: 'description', placeholder: 'What does this service offer?' },
              { label: 'Schedule', key: 'schedule', placeholder: 'e.g. Saturdays 10am–12pm' },
              { label: 'Contact', key: 'contact', placeholder: 'Email or phone for inquiries' },
              { label: 'Pricing', key: 'pricing', placeholder: 'Free / $50/month / etc.' },
            ].map(({ label, key, placeholder }) => (
              <View key={key}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 5 }}>{label}</Text>
                <TextInput
                  style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.border }}
                  placeholder={placeholder}
                  placeholderTextColor={colors.textTertiary}
                  value={(form as any)[key]}
                  onChangeText={(v) => set(key, v)}
                  autoCapitalize="none"
                />
              </View>
            ))}
            <TouchableOpacity
              onPress={() => createMutation.mutate()}
              disabled={!form.name.trim() || createMutation.isPending}
              activeOpacity={0.8}
              style={{ backgroundColor: form.name.trim() ? colors.primary : colors.border, borderRadius: 14, paddingVertical: 15, alignItems: 'center' }}
            >
              {createMutation.isPending ? <ActivityIndicator color={colors.primaryContrast} /> : (
                <Text style={{ color: colors.primaryContrast, fontSize: 15, fontWeight: '700' }}>Add Service</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  )
}
