import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { formatDistanceToNow, isPast } from 'date-fns'
import { useAuth } from '@clerk/clerk-expo'
import { api } from '../lib/api'
import { useTheme } from '../contexts/ThemeContext'

interface PollOption {
  id: string
  text: string
  voteCount: number
}

interface PollProps {
  poll: {
    id: string
    mosqueId: string
    question: string
    totalVotes: number
    userVote: string | null
    endsAt: string | null
    createdAt: string
    options: PollOption[]
    mosque?: { name: string; logoUrl?: string } | null
  }
  queryKey?: unknown[]
}

export function PollCard({ poll, queryKey }: PollProps) {
  const { colors } = useTheme()
  const GREEN = colors.primary
  const GREEN_LIGHT = colors.primaryLight
  const { isSignedIn } = useAuth()
  const queryClient = useQueryClient()
  const hasVoted = !!poll.userVote

  let ended = false
  try { ended = poll.endsAt ? isPast(new Date(poll.endsAt)) : false } catch { ended = false }

  const showResults = hasVoted || ended

  const voteMutation = useMutation({
    mutationFn: (optionId: string) => api.post(`/polls/${poll.id}/vote`, { optionId }),
    onSuccess: (res) => {
      const update = (p: any) =>
        p.id === poll.id
          ? { ...p, userVote: res.data.userVote, totalVotes: res.data.totalVotes, options: res.data.options }
          : p

      // Update home feed (infinite query — pages structure)
      queryClient.setQueryData(['home-feed'], (old: any) => {
        if (!old?.pages) return old
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: { ...page.data, items: (page.data?.items ?? []).map(update) },
          })),
        }
      })

      // Update any other queryKey provided (mosque page polls, standalone, etc)
      if (queryKey) {
        queryClient.setQueryData(queryKey, (old: any) => {
          if (old?.data?.items) {
            return { ...old, data: { ...old.data, items: old.data.items.map(update) } }
          }
          // Standalone poll query — update the poll directly
          if (old?.data?.id === poll.id) {
            return { ...old, data: { ...old.data, ...res.data } }
          }
          return old
        })
      }
    },
    onError: () => Alert.alert('Error', 'Could not submit vote. Please try again.'),
  })

  function handleVote(optionId: string) {
    if (!isSignedIn) { Alert.alert('Sign in required', 'Please sign in to vote.'); return }
    if (ended) return
    voteMutation.mutate(optionId)
  }

  // Compute percentages with remainder distribution to sum to 100
  const total = poll.totalVotes
  const rawPcts = poll.options.map(o => total > 0 ? Math.floor((o.voteCount / total) * 100) : 0)
  const remainder = 100 - rawPcts.reduce((s, p) => s + p, 0)
  const pcts = rawPcts.map((p, i) => (i < remainder ? p + 1 : p))

  return (
    <View style={{
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 14,
      overflow: 'hidden',
      shadowColor: colors.primary,
      shadowOpacity: 0.06,
      shadowOffset: { width: 0, height: 3 },
      shadowRadius: 12,
      elevation: 2,
    }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10, gap: 10 }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: GREEN_LIGHT, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 16 }}>📊</Text>
        </View>
        <Text style={{ flex: 1, color: colors.text, fontWeight: '600', fontSize: 13, letterSpacing: -0.1 }}>
          {poll.mosque?.name ?? 'Poll'}
        </Text>
        {ended ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.3 }}>ENDED</Text>
          </View>
        ) : poll.endsAt ? (
          <View style={{ backgroundColor: colors.isDark ? '#2D1F0A' : '#FEF3C7', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: colors.isDark ? '#FB923C' : '#92400E', fontSize: 11, fontWeight: '600' }}>
              {formatDistanceToNow(new Date(poll.endsAt), { addSuffix: true })}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Divider */}
      <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 14 }} />

      {/* Question + Options */}
      <View style={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 14 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, lineHeight: 23, marginBottom: 14, letterSpacing: -0.3 }}>
          {poll.question}
        </Text>

        <View style={{ gap: 9 }}>
          {poll.options.map((option, idx) => {
            const isSelected = poll.userVote === option.id
            const pct = pcts[idx] ?? 0

            if (showResults) {
              return (
                <View key={option.id} style={{
                  borderRadius: 14, overflow: 'hidden',
                  borderWidth: isSelected ? 1.5 : 1,
                  borderColor: isSelected ? GREEN : colors.border,
                  backgroundColor: colors.surfaceSecondary,
                }}>
                  {/* Progress fill */}
                  <View style={{
                    position: 'absolute', top: 0, left: 0, bottom: 0,
                    width: `${pct}%`,
                    backgroundColor: isSelected ? GREEN_LIGHT : colors.border,
                    opacity: colors.isDark ? 0.85 : 0.6,
                  }} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 11 }}>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={15} color={GREEN} />
                      )}
                      <Text style={{
                        fontSize: 14, lineHeight: 20,
                        color: isSelected ? GREEN : colors.textSecondary,
                        fontWeight: isSelected ? '600' : '400',
                        flex: 1,
                      }}>
                        {option.text}
                      </Text>
                    </View>
                    <Text style={{
                      fontSize: 13, fontWeight: '700',
                      color: isSelected ? GREEN : colors.textTertiary,
                      minWidth: 36, textAlign: 'right',
                    }}>
                      {pct}%
                    </Text>
                  </View>
                </View>
              )
            }

            // Voting buttons
            return (
              <TouchableOpacity
                key={option.id}
                onPress={() => handleVote(option.id)}
                disabled={voteMutation.isPending}
                activeOpacity={0.75}
                style={{
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: colors.border,
                  paddingHorizontal: 14, paddingVertical: 12,
                  backgroundColor: colors.surface,
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                }}
              >
                <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border }} />
                <Text style={{ fontSize: 14, color: colors.textSecondary, fontWeight: '400', flex: 1 }}>
                  {option.text}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Footer */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.border }} />
            <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
              {poll.totalVotes.toLocaleString()} vote{poll.totalVotes !== 1 ? 's' : ''}
            </Text>
          </View>
          {voteMutation.isPending
            ? <ActivityIndicator size="small" color={GREEN} />
            : hasVoted
            ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="checkmark-circle" size={13} color={GREEN} />
                <Text style={{ color: GREEN, fontSize: 12, fontWeight: '600' }}>Voted</Text>
              </View>
            : null
          }
        </View>
      </View>
    </View>
  )
}
