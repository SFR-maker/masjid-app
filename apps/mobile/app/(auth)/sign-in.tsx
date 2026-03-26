import { useState, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform, Alert, ScrollView,
} from 'react-native'
import { useSignIn, useOAuth } from '@clerk/clerk-expo'
import * as WebBrowser from 'expo-web-browser'
import { Link, router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'

WebBrowser.maybeCompleteAuthSession()

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn()
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' })
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
        router.replace('/(tabs)')
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
        router.replace('/(tabs)')
      }
    } catch (err: any) {
      Alert.alert('Google Sign In Failed', err.errors?.[0]?.message ?? 'Please try again.')
    } finally {
      setGoogleLoading(false)
    }
  }, [startOAuthFlow])

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
          <View style={{ alignItems: 'center', marginBottom: 48 }}>
            <Text style={{ color: 'white', fontSize: 48, fontWeight: 'bold' }}>مسجد</Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 22, marginTop: 4 }}>Masjid</Text>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 4 }}>
              Your mosque community
            </Text>
          </View>

          {/* Form */}
          <View
            style={{
              backgroundColor: 'white',
              borderRadius: 24,
              padding: 24,
              shadowColor: '#000',
              shadowOpacity: 0.15,
              shadowRadius: 20,
              elevation: 8,
            }}
          >
            <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 24 }}>
              Welcome back
            </Text>

            {/* Google Sign In */}
            <TouchableOpacity
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
                paddingVertical: 14, marginBottom: 20, gap: 10,
              }}
              onPress={handleGoogleSignIn}
              disabled={googleLoading}
            >
              {googleLoading ? (
                <ActivityIndicator color="#4B5563" size="small" />
              ) : (
                <>
                  <Text style={{ fontSize: 18 }}>G</Text>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#1A1A1A' }}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: '#E5E7EB' }} />
              <Text style={{ color: '#9CA3AF', fontSize: 13, marginHorizontal: 12 }}>or</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: '#E5E7EB' }} />
            </View>

            <Text style={{ fontSize: 13, fontWeight: '600', color: '#4B5563', marginBottom: 8 }}>
              Email
            </Text>
            <TextInput
              style={{
                borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
                paddingHorizontal: 16, paddingVertical: 12, fontSize: 16,
                backgroundColor: '#F9FAFB', marginBottom: 16, color: '#1A1A1A',
              }}
              placeholder="your@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />

            <Text style={{ fontSize: 13, fontWeight: '600', color: '#4B5563', marginBottom: 8 }}>
              Password
            </Text>
            <TextInput
              style={{
                borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
                paddingHorizontal: 16, paddingVertical: 12, fontSize: 16,
                backgroundColor: '#F9FAFB', marginBottom: 24, color: '#1A1A1A',
              }}
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <TouchableOpacity
              style={{
                backgroundColor: '#1B4332', borderRadius: 12,
                paddingVertical: 16, alignItems: 'center', marginBottom: 16,
              }}
              onPress={handleSignIn}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>Sign In</Text>
              )}
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
              <Text style={{ color: '#6B7280', fontSize: 14 }}>Don't have an account? </Text>
              <Link href="/(auth)/sign-up">
                <Text style={{ color: '#1B4332', fontSize: 14, fontWeight: '600' }}>Sign up</Text>
              </Link>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  )
}
