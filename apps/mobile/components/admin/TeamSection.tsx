import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Image } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { api } from '../../lib/api'
import { useTheme } from '../../contexts/ThemeContext'

export function TeamSection({ mosqueId }: { mosqueId: string }) {
  const { colors } = useTheme()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['mosque-admins', mosqueId],
    queryFn: () => api.get(`/mosques/${mosqueId}/admins`),
    staleTime: 30_000,
  })
  const admins: any[] = data?.data?.items ?? []

  const { data: searchData, isLoading: searching } = useQuery({
    queryKey: ['user-search', search],
    queryFn: () => api.get(`/admin/users/search?q=${encodeURIComponent(search)}`),
    enabled: search.trim().length >= 2,
    staleTime: 5_000,
  })
  const searchResults: any[] = searchData?.data?.items ?? []

  const addMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api.post(`/mosques/${mosqueId}/admins`, { userId, role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mosque-admins', mosqueId] })
      setSearch('')
      setShowAdd(false)
    },
    onError: (e: any) => Alert.alert('Error', e.message ?? 'Could not add team member.'),
  })

  const removeMutation = useMutation({
    mutationFn: (adminId: string) => api.delete(`/mosques/${mosqueId}/admins/${adminId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mosque-admins', mosqueId] }),
    onError: (e: any) => Alert.alert('Error', e.message ?? 'Could not remove team member.'),
  })

  const roleColor = (role: string) => {
    if (role === 'OWNER') return '#7C3AED'
    if (role === 'ADMIN') return colors.primary
    return colors.textSecondary
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
        <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>Team</Text>
        <TouchableOpacity
          onPress={() => setShowAdd(!showAdd)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 }}
        >
          <Ionicons name={showAdd ? 'close' : 'person-add-outline'} size={15} color={colors.primaryContrast} />
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primaryContrast }}>{showAdd ? 'Cancel' : 'Add'}</Text>
        </TouchableOpacity>
      </View>

      {showAdd && (
        <View style={{ marginHorizontal: 16, marginBottom: 12, backgroundColor: colors.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Search Users</Text>
          <TextInput
            style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.border }}
            placeholder="Name or email..."
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
          {searching && <ActivityIndicator size="small" color={colors.primary} />}
          {searchResults.map((u) => (
            <View key={u.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                {u.avatarUrl ? (
                  <Image source={{ uri: u.avatarUrl }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                ) : (
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '700' }}>{u.name?.[0] ?? '?'}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{u.name}</Text>
                  <Text style={{ fontSize: 11, color: colors.textTertiary }}>{u.email}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity
                  onPress={() => addMutation.mutate({ userId: u.id, role: 'EDITOR' })}
                  activeOpacity={0.8}
                  style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: colors.border }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary }}>Editor</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => addMutation.mutate({ userId: u.id, role: 'ADMIN' })}
                  activeOpacity={0.8}
                  style={{ backgroundColor: colors.primaryLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>Admin</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : admins.length === 0 ? (
        <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
          <Ionicons name="people-outline" size={40} color={colors.textTertiary} />
          <Text style={{ color: colors.textTertiary, fontSize: 14 }}>No team members yet</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 100 }}>
          {admins.map((admin) => (
            <View key={admin.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border }}>
              {admin.user.avatarUrl ? (
                <Image source={{ uri: admin.user.avatarUrl }} style={{ width: 44, height: 44, borderRadius: 22 }} />
              ) : (
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 18, color: colors.primary, fontWeight: '700' }}>{admin.user.name?.[0] ?? '?'}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{admin.user.name}</Text>
                <Text style={{ fontSize: 12, color: colors.textTertiary }}>{admin.user.email}</Text>
                <View style={{ backgroundColor: `${roleColor(admin.role)}22`, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 4 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: roleColor(admin.role) }}>{admin.role}</Text>
                </View>
              </View>
              {admin.role !== 'OWNER' && (
                <TouchableOpacity
                  onPress={() => Alert.alert('Remove', `Remove ${admin.user.name} from team?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: () => removeMutation.mutate(admin.id) },
                  ])}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ padding: 12 }}
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  )
}
