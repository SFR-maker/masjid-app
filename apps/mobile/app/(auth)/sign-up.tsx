import { useState, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform, Alert, ScrollView,
} from 'react-native'
import { useSignUp, useOAuth } from '@clerk/clerk-expo'
import * as WebBrowser from 'expo-web-browser'
import { Link, router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'

WebBrowser.maybeCompleteAuthSession()

export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp()
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' })
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [pendingVerification, setPendingVerification] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const handleGoogleSignUp = useCallback(async () => {
    setGoogleLoading(true)
    try {
      const { createdSessionId, setActive: setActiveOAuth } = await startOAuthFlow()
      if (createdSessionId) {
        await setActiveOAuth!({ session: createdSessionId })
        router.replace('/(tabs)')
      }
    } catch (err: any) {
      Alert.alert('Google Sign Up Failed', err.errors?.[0]?.message ?? 'Please try again.')
    } finally {
      setGoogleLoading(false)
    }
  }, [startOAuthFlow])

  async function handleSignUp() {
    if (!isLoaded) return
    setLoading(true)
    try {
      await signUp.create({
        emailAddress: email,
        password,
        firstName: name.split(' ')[0],
        lastName: name.split(' ').slice(1).join(' ') || undefined,
      })
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
      setPendingVerification(true)
    } catch (err: any) {
      Alert.alert('Sign Up Failed', err.errors?.[0]?.message ?? 'Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify() {
    if (!isLoaded) return
    setLoading(true)
    try {
      const result = await signUp.attemptEmailAddressVerification({ code })
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId })
        router.replace('/(tabs)')
      }
    } catch (err: any) {
      Alert.alert('Verification Failed', err.errors?.[0]?.message ?? 'Invalid code.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12, fontSize: 16,
    backgroundColor: '#F9FAFB', marginBottom: 16, color: '#1A1A1A',
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <LinearGradient colors={['#1B4332', '#2D6A4F']} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <Text style={{ color: 'white', fontSize: 28, fontWeight: 'bold' }}>Join Masjid</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 4 }}>
              Connect with your community
            </Text>
          </View>

          <View style={{ backgroundColor: 'white', borderRadius: 24, padding: 24 }}>
            {!pendingVerification ? (
              <>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 20 }}>
                  Create account
                </Text>

                {/* Google Sign Up */}
                <TouchableOpacity
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
                    paddingVertical: 14, marginBottom: 20, gap: 10,
                  }}
                  onPress={handleGoogleSignUp}
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

                <Text style={{ fontSize: 13, fontWeight: '600', color: '#4B5563', marginBottom: 6 }}>Full Name</Text>
                <TextInput style={inputStyle} placeholder="Your name" value={name} onChangeText={setName} autoCapitalize="words" />

                <Text style={{ fontSize: 13, fontWeight: '600', color: '#4B5563', marginBottom: 6 }}>Email</Text>
                <TextInput style={inputStyle} placeholder="your@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

                <Text style={{ fontSize: 13, fontWeight: '600', color: '#4B5563', marginBottom: 6 }}>Password</Text>
                <TextInput style={inputStyle} placeholder="••••••••" value={password} onChangeText={setPassword} secureTextEntry />

                <TouchableOpacity
                  style={{ backgroundColor: '#1B4332', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 16 }}
                  onPress={handleSignUp}
                  disabled={loading || !name || !email || !password}
                >
                  {loading ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>Create Account</Text>}
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
                  <Text style={{ color: '#6B7280', fontSize: 14 }}>Already have an account? </Text>
                  <Link href="/(auth)/sign-in">
                    <Text style={{ color: '#1B4332', fontSize: 14, fontWeight: '600' }}>Sign in</Text>
                  </Link>
                </View>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 8 }}>Verify email</Text>
                <Text style={{ color: '#6B7280', fontSize: 14, marginBottom: 20 }}>Enter the code sent to {email}</Text>
                <TextInput
                  style={{ ...inputStyle, textAlign: 'center', fontSize: 28, letterSpacing: 8 }}
                  placeholder="000000"
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  maxLength={6}
                />
                <TouchableOpacity
                  style={{ backgroundColor: '#1B4332', borderRadius: 12, paddingVertical: 16, alignItems: 'center' }}
                  onPress={handleVerify}
                  disabled={loading || code.length < 6}
                >
                  {loading ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>Verify & Continue</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  )
}
