import { View, Text, ActivityIndicator, TouchableOpacity, ScrollView, RefreshControl } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { api } from '../../lib/api'
import { PollCard } from '../../components/PollCard'
import { useTheme } from '../../contexts/ThemeContext'

export default function PollScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { colors } = useTheme()

  const { data, isLoading, error, refetch, isRefetching, isFetching } = useQuery({
    queryKey: ['poll', id],
    queryFn: () => api.get(`/polls/${id}`),
    enabled: !!id,
  })

  const poll = data?.data

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ marginRight: 12 }}
        >
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, letterSpacing: -0.3 }}>Poll</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 8 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching || isFetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
      >
        {isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : error || !poll ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
            <Text style={{ fontSize: 32, marginBottom: 12 }}>📊</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 15, textAlign: 'center' }}>
              This poll is no longer available.
            </Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16 }}>
            <PollCard poll={poll} queryKey={['poll', id]} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
