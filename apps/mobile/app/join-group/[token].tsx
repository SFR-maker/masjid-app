import { useEffect, useState } from 'react'
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@clerk/clerk-expo'
import { api } from '../../lib/api'
import { useTheme } from '../../contexts/ThemeContext'

export default function JoinGroupScreen() {
  const { token } = useLocalSearchParams<{ token: string }>()
  const { isSignedIn, isLoaded } = useAuth()
  const { colors } = useTheme()
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'auth_required'>('loading')
  const [groupName, setGroupName] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      setStatus('auth_required')
      return
    }
    if (!token) {
      setStatus('error')
      setErrorMessage('Invalid invite link.')
      return
    }

    api.post(`/group-invite/${token}/join`, {})
      .then((res) => {
        setGroupName(res?.data?.groupName ?? null)
        setStatus('success')
      })
      .catch((err) => {
        const msg = err?.message ?? 'Could not join group.'
        setErrorMessage(msg.includes('404') ? 'Invite link is invalid or expired.' : msg)
        setStatus('error')
      })
  }, [isLoaded, isSignedIn, token])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
        <TouchableOpacity
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginLeft: 8 }}>Join Group</Text>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        {status === 'loading' && (
          <>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={{ color: colors.textSecondary, fontSize: 15, marginTop: 16, textAlign: 'center' }}>
              Joining group...
            </Text>
          </>
        )}

        {status === 'auth_required' && (
          <>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <Ionicons name="lock-closed-outline" size={32} color={colors.primary} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 8, textAlign: 'center' }}>
              Sign in to join
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 28 }}>
              You need to be signed in to join this group.
            </Text>
            <TouchableOpacity
              onPress={() => router.replace('/(auth)/sign-in')}
              style={{ backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 32 }}
            >
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Sign In</Text>
            </TouchableOpacity>
          </>
        )}

        {status === 'success' && (
          <>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#D8F3DC', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <Ionicons name="checkmark-circle" size={40} color={colors.primary} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 8, textAlign: 'center' }}>
              You're in!
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 28 }}>
              {groupName ? `You've joined "${groupName}".` : 'You\'ve successfully joined the group.'}
            </Text>
            <TouchableOpacity
              onPress={() => router.replace('/messages')}
              style={{ backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 32 }}
            >
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Open Messages</Text>
            </TouchableOpacity>
          </>
        )}

        {status === 'error' && (
          <>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <Ionicons name="close-circle" size={40} color="#EF4444" />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 8, textAlign: 'center' }}>
              Could not join
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 28 }}>
              {errorMessage}
            </Text>
            <TouchableOpacity
              onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}
              style={{ backgroundColor: colors.surface, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 32, borderWidth: 1, borderColor: colors.border }}
            >
              <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 16 }}>Go Back</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  )
}
