import { useState, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform, Alert, ScrollView,
} from 'react-native'
import { useSignIn, useOAuth } from '@clerk/clerk-expo'
import * as WebBrowser from 'expo-web-browser'
import { Link, router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '../../contexts/ThemeContext'
import { api } from '../../lib/api'

WebBrowser.maybeCompleteAuthSession()

type LoginMode = 'user' | 'mosque'

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn()
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' })
  const { colors } = useTheme()
  const [mode, setMode] = useState<LoginMode>('user')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  async function handleSignIn() {
    if (!isLoaded) return
    setLoading(true)
    try {
      const result = await signIn.create({ identifier: email, password })
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId })
        await redirectAfterLogin()
      }
    } catch (err: any) {
      Alert.alert('Sign In Failed', err.errors?.[0]?.message ?? 'Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = useCallback(async () => {
    setGoogleLoading(true)
    try {
      const { createdSessionId, setActive: setActiveOAuth } = await startOAuthFlow()
      if (createdSessionId) {
        await setActiveOAuth!({ session: createdSessionId })
        await redirectAfterLogin()
      }
    } catch (err: any) {
      Alert.alert('Google Sign In Failed', err.errors?.[0]?.message ?? 'Please try again.')
    } finally {
      setGoogleLoading(false)
    }
  }, [startOAuthFlow, mode])

  async function redirectAfterLogin() {
    if (mode === 'mosque') {
      try {
        const res = await api.get<any>('/users/me/admin-mosques')
        const { isSuperAdmin, items } = res?.data ?? {}
        if (isSuperAdmin || (items?.length ?? 0) > 0) {
          router.replace('/admin' as any)
          return
        }
        Alert.alert('No mosque access', 'Your account is not linked to any mosque as an admin. Contact your mosque to be added as an admin.')
      } catch {
        router.replace('/(tabs)')
      }
    } else {
      router.replace('/(tabs)')
    }
  }

  const inputStyle = {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12, fontSize: 16,
    backgroundColor: colors.surfaceSecondary, marginBottom: 16, color: colors.text,
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient colors={['#1B4332', '#2D6A4F']} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <Text style={{ color: 'white', fontSize: 48, fontWeight: 'bold' }}>مسجد</Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 22, marginTop: 4 }}>Masjidly</Text>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 4 }}>
              Your mosque community
            </Text>
          </View>

          {/* Mode Tabs */}
          <View style={{ flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 14, padding: 4, marginBottom: 20 }}>
            {(['user', 'mosque'] as LoginMode[]).map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => setMode(m)}
                style={{
                  flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
                  backgroundColor: mode === m ? 'white' : 'transparent',
                }}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: mode === m ? '#1B4332' : 'rgba(255,255,255,0.7)' }}>
                  {m === 'user' ? '🙋 User' : '🕌 Mosque Admin'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Form */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 24,
              padding: 24,
              shadowColor: '#000',
              shadowOpacity: 0.15,
              shadowRadius: 20,
              elevation: 8,
            }}
          >
            <Text style={{ fontSize: 22, fontWeight: 'bold', color: colors.text, marginBottom: 6 }}>
              {mode === 'mosque' ? 'Admin Sign In' : 'Welcome back'}
            </Text>
            {mode === 'mosque' && (
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 20, lineHeight: 18 }}>
                Sign in with your mosque admin account to access your dashboard.
              </Text>
            )}
            {mode === 'user' && <View style={{ height: 16 }} />}

            {/* Google Sign In */}
            <TouchableOpacity
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                borderWidth: 1, borderColor: colors.border, borderRadius: 12,
                paddingVertical: 14, marginBottom: 20, gap: 10,
              }}
              onPress={handleGoogleSignIn}
              disabled={googleLoading}
            >
              {googleLoading ? (
                <ActivityIndicator color={colors.textSecondary} size="small" />
              ) : (
                <>
                  <Text style={{ fontSize: 18 }}>G</Text>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              <Text style={{ color: colors.textTertiary, fontSize: 13, marginHorizontal: 12 }}>or</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            </View>

            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
              Email
            </Text>
            <TextInput
              style={inputStyle}
              placeholder="your@email.com"
              placeholderTextColor={colors.textTertiary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />

            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
              Password
            </Text>
            <TextInput
              style={inputStyle}
              placeholder="••••••••"
              placeholderTextColor={colors.textTertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <TouchableOpacity
              style={{
                backgroundColor: colors.primary, borderRadius: 12,
                paddingVertical: 16, alignItems: 'center', marginBottom: 16,
              }}
              onPress={handleSignIn}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryContrast} />
              ) : (
                <Text style={{ color: colors.primaryContrast, fontWeight: '600', fontSize: 16 }}>
                  {mode === 'mosque' ? 'Sign In as Admin' : 'Sign In'}
                </Text>
              )}
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
              <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Don't have an account? </Text>
              <Link href="/(auth)/sign-up">
                <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>Sign up</Text>
              </Link>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  )
}
