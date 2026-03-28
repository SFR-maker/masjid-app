import { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Alert, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useAuth } from '@clerk/clerk-expo'
import { api } from '../lib/api'
import { useTheme } from '../contexts/ThemeContext'

export default function AdminDashboard() {
  const { colors } = useTheme()
  const { signOut } = useAuth()
  const queryClient = useQueryClient()
  const [selectedMosqueId, setSelectedMosqueId] = useState<string | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-mosques'],
    queryFn: () => api.get<any>('/users/me/admin-mosques'),
    staleTime: 30_000,
  })

  const adminData = data?.data ?? {}
  const mosques: any[] = adminData.items ?? []
  const isSuperAdmin: boolean = adminData.isSuperAdmin ?? false

  const selectedMosque = selectedMosqueId ? mosques.find((m) => m.id === selectedMosqueId) : null

  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut().then(() => router.replace('/(auth)/sign-in' as any)) },
    ])
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  if (mosques.length === 0 && !isSuperAdmin) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Text style={{ fontSize: 32, marginBottom: 16 }}>🕌</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8 }}>No Mosque Access</Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 }}>
            Your account is not linked to any mosque as an admin. Contact your mosque to be added.
          </Text>
          <TouchableOpacity
            onPress={() => router.replace('/(tabs)')}
            style={{ marginTop: 24, backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
          >
            <Text style={{ color: colors.primaryContrast, fontWeight: '700' }}>Go to App</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // Mosque detail view
  if (selectedMosque) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <TouchableOpacity onPress={() => setSelectedMosqueId(null)} style={{ marginRight: 12, padding: 4 }}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }} numberOfLines={1}>{selectedMosque.name}</Text>
            <Text style={{ fontSize: 11, color: colors.textTertiary }}>{selectedMosque.city}, {selectedMosque.state}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push(`/mosque/${selectedMosque.id}` as any)} style={{ padding: 4 }}>
            <Ionicons name="open-outline" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} showsVerticalScrollIndicator={false}>
          {/* Stats row */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[
              { label: 'Followers', value: selectedMosque.followersCount ?? 0, icon: 'people' },
              { label: 'Events', value: selectedMosque.eventsCount ?? 0, icon: 'calendar' },
              { label: 'Posts', value: selectedMosque.announcementsCount ?? 0, icon: 'megaphone' },
              { label: 'Videos', value: selectedMosque.videosCount ?? 0, icon: 'videocam' },
            ].map((stat) => (
              <View key={stat.label} style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
                <Ionicons name={stat.icon as any} size={18} color={colors.primary} />
                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 4 }}>{stat.value}</Text>
                <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 2 }}>{stat.label}</Text>
              </View>
            ))}
          </View>

          {/* Quick actions */}
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 8 }}>Quick Actions</Text>
          <View style={{ gap: 10 }}>
            {[
              { label: 'Post Announcement', icon: 'megaphone-outline', action: () => router.push(`/mosque/${selectedMosque.id}` as any) },
              { label: 'Manage Events', icon: 'calendar-outline', action: () => router.push(`/mosque/${selectedMosque.id}` as any) },
              { label: 'View Messages', icon: 'mail-outline', action: () => router.push('/messages' as any) },
              { label: 'Manage Videos', icon: 'videocam-outline', action: () => router.push(`/mosque/${selectedMosque.id}` as any) },
              { label: 'View Full Dashboard', icon: 'desktop-outline', action: () => router.push(`/mosque/${selectedMosque.id}` as any) },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                onPress={item.action}
                activeOpacity={0.8}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: colors.border }}
              >
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={item.icon as any} size={18} color={colors.primary} />
                </View>
                <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: colors.text }}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>

          {isSuperAdmin && (
            <>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 8 }}>Super Admin</Text>
              <TouchableOpacity
                onPress={() => Alert.alert('Global VO Upload', 'Use the API or web admin panel to upload global VOs to the feed.')}
                activeOpacity={0.8}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#FEF3C7', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: '#F59E0B' }}
              >
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#FDE68A', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="globe-outline" size={18} color="#D97706" />
                </View>
                <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: '#92400E' }}>Upload Global VO</Text>
                <Ionicons name="chevron-forward" size={16} color="#D97706" />
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    )
  }

  // Mosque list view
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.4 }}>Admin Dashboard</Text>
          {isSuperAdmin && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <Ionicons name="shield-checkmark" size={12} color="#D97706" />
              <Text style={{ fontSize: 11, color: '#D97706', fontWeight: '700' }}>Super Admin</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={{ marginRight: 8, padding: 8 }}>
          <Ionicons name="home-outline" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSignOut} style={{ padding: 8 }}>
          <Ionicons name="log-out-outline" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
      >
        <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 4 }}>
          {mosques.length === 1 ? 'You manage 1 mosque' : `You manage ${mosques.length} mosques`}
        </Text>

        {mosques.map((mosque) => (
          <TouchableOpacity
            key={mosque.id}
            onPress={() => setSelectedMosqueId(mosque.id)}
            activeOpacity={0.85}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 1 }}
          >
            {mosque.logoUrl ? (
              <Image source={{ uri: mosque.logoUrl }} style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: colors.border }} contentFit="cover" />
            ) : (
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 24 }}>🕌</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }} numberOfLines={1}>{mosque.name}</Text>
                {mosque.isVerified && <Ionicons name="checkmark-circle" size={14} color={colors.primary} />}
              </View>
              <Text style={{ fontSize: 12, color: colors.textTertiary, marginBottom: 4 }}>{mosque.city}, {mosque.state}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={{ fontSize: 11, color: colors.textSecondary }}>{mosque.followersCount ?? 0} followers</Text>
                <View style={{ backgroundColor: colors.primaryLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 10, color: colors.primary, fontWeight: '700' }}>{mosque.role}</Text>
                </View>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </TouchableOpacity>
        ))}

        {/* Switch to user mode */}
        <TouchableOpacity
          onPress={() => router.replace('/(tabs)')}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, marginTop: 8 }}
        >
          <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
          <Text style={{ fontSize: 14, color: colors.textSecondary }}>Switch to User Mode</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}
