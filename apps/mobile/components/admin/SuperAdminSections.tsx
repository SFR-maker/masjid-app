import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { api } from '../../lib/api'
import { useTheme } from '../../contexts/ThemeContext'
import { format } from 'date-fns'

// ── Verifications ─────────────────────────────────────────────────────────────
export function VerificationsSection() {
  const { colors } = useTheme()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-verifications'],
    queryFn: () => api.get('/admin/verification'),
    staleTime: 30_000,
  })
  const requests: any[] = data?.data ?? []

  const actionMutation = useMutation({
    mutationFn: ({ id, action, notes }: { id: string; action: 'approve' | 'reject'; notes?: string }) =>
      api.put(`/admin/verification/${id}`, { action, adminNotes: notes }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-verifications'] }),
    onError: (e: any) => Alert.alert('Error', e.message ?? 'Action failed.'),
  })

  const handleAction = (id: string, action: 'approve' | 'reject') => {
    const label = action === 'approve' ? 'Approve' : 'Reject'
    Alert.alert(label, `${label} this mosque verification?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: label, style: action === 'reject' ? 'destructive' : 'default', onPress: () => actionMutation.mutate({ id, action }) },
    ])
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
        <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>Mosque Verifications</Text>
        {!isLoading && (
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
            {requests.length} pending request{requests.length !== 1 ? 's' : ''}
          </Text>
        )}
      </View>
      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : requests.length === 0 ? (
        <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
          <Ionicons name="checkmark-circle-outline" size={40} color={colors.textTertiary} />
          <Text style={{ color: colors.textTertiary, fontSize: 14 }}>No pending verifications</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 100 }}>
          {requests.map((r) => (
            <View key={r.id} style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>{r.mosque?.name}</Text>
                  <Text style={{ fontSize: 12, color: colors.textTertiary }}>
                    {r.mosque?.city}, {r.mosque?.state} · by {r.requester?.name}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textTertiary }}>{r.requester?.email}</Text>
                </View>
                <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>PENDING</Text>
                </View>
              </View>
              {r.notes && <Text style={{ fontSize: 13, color: colors.textSecondary, backgroundColor: colors.surfaceSecondary, borderRadius: 10, padding: 10 }}>{r.notes}</Text>}
              <Text style={{ fontSize: 11, color: colors.textTertiary }}>Submitted {format(new Date(r.createdAt), 'MMM d, yyyy')}</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  onPress={() => handleAction(r.id, 'approve')}
                  activeOpacity={0.8}
                  style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
                >
                  <Ionicons name="checkmark-circle-outline" size={16} color={colors.primaryContrast} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primaryContrast }}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleAction(r.id, 'reject')}
                  activeOpacity={0.8}
                  style={{ flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: 12, paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.border }}
                >
                  <Ionicons name="close-circle-outline" size={16} color="#EF4444" />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#EF4444' }}>Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  )
}

// ── Reports ───────────────────────────────────────────────────────────────────
export function ReportsSection() {
  const { colors } = useTheme()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'RESOLVED' | 'DISMISSED'>('PENDING')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-reports', statusFilter],
    queryFn: () => api.get(`/admin/reports?status=${statusFilter}`),
    staleTime: 30_000,
  })
  const reports: any[] = data?.data ?? []

  const resolveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'RESOLVED' | 'DISMISSED' }) =>
      api.put(`/admin/reports/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-reports'] }),
    onError: (e: any) => Alert.alert('Error', e.message ?? 'Action failed.'),
  })

  const contentTypeLabel = (t: string) => t?.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
        <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>Content Reports</Text>
      </View>

      <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12 }}>
        {(['PENDING', 'RESOLVED', 'DISMISSED'] as const).map((s) => (
          <TouchableOpacity
            key={s}
            onPress={() => setStatusFilter(s)}
            activeOpacity={0.8}
            style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: statusFilter === s ? colors.primary : colors.surface, borderWidth: 1, borderColor: statusFilter === s ? colors.primary : colors.border }}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: statusFilter === s ? colors.primaryContrast : colors.textSecondary }}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : reports.length === 0 ? (
        <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
          <Ionicons name="flag-outline" size={40} color={colors.textTertiary} />
          <Text style={{ color: colors.textTertiary, fontSize: 14 }}>No {statusFilter.toLowerCase()} reports</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 100 }}>
          {reports.map((r) => (
            <View key={r.id} style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{contentTypeLabel(r.contentType)}</Text>
                  <Text style={{ fontSize: 11, color: colors.textTertiary }}>by {r.reporter?.name} · {format(new Date(r.createdAt), 'MMM d, yyyy')}</Text>
                </View>
                <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>{r.reason}</Text>
                </View>
              </View>
              {r.details && <Text style={{ fontSize: 13, color: colors.textSecondary }}>{r.details}</Text>}
              {r.status === 'PENDING' && (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => resolveMutation.mutate({ id: r.id, status: 'RESOLVED' })}
                    activeOpacity={0.8}
                    style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primaryContrast }}>Resolve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => resolveMutation.mutate({ id: r.id, status: 'DISMISSED' })}
                    activeOpacity={0.8}
                    style={{ flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary }}>Dismiss</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  )
}

// ── Platform Stats ─────────────────────────────────────────────────────────────
export function PlatformStatsSection() {
  const { colors } = useTheme()

  const { data, isLoading } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: () => api.get('/admin/stats'),
    staleTime: 60_000,
  })
  const stats = data?.data ?? {}

  const statItems = [
    { label: 'Total Users', value: stats.users ?? 0, icon: 'people-outline', color: colors.primary },
    { label: 'Active Mosques', value: stats.mosques ?? 0, icon: 'business-outline', color: '#059669' },
    { label: 'Published Events', value: stats.events ?? 0, icon: 'calendar-outline', color: '#7C3AED' },
    { label: 'Published Videos', value: stats.videos ?? 0, icon: 'videocam-outline', color: '#D97706' },
  ]

  const healthRows = [
    { label: 'User-to-Mosque Ratio', value: stats.mosques ? `${(stats.users / stats.mosques).toFixed(1)} users/mosque` : '—' },
    { label: 'Events per Mosque', value: stats.mosques ? `${(stats.events / stats.mosques).toFixed(1)} avg` : '—' },
    { label: 'Videos per Mosque', value: stats.mosques ? `${(stats.videos / stats.mosques).toFixed(1)} avg` : '—' },
  ]

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
        <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>Platform Statistics</Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>Live platform-wide data</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {statItems.map((s) => (
              <View key={s.label} style={{ flex: 1, minWidth: 140, backgroundColor: colors.surface, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: colors.border, alignItems: 'center', gap: 8 }}>
                <View style={{ width: 48, height: 48, backgroundColor: `${s.color}18`, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={s.icon as any} size={24} color={s.color} />
                </View>
                <Text style={{ fontSize: 28, fontWeight: '900', color: colors.text }}>{s.value.toLocaleString()}</Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, textAlign: 'center' }}>{s.label}</Text>
              </View>
            ))}
          </View>

          <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: 4 }}>Platform Health</Text>
            {healthRows.map((item, i) => (
              <View key={item.label} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: colors.border }}>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>{item.label}</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{item.value}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  )
}
