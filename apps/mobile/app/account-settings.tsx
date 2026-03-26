import { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useUser, useClerk } from '@clerk/clerk-expo'
import { useQueryClient } from '@tanstack/react-query'
import { useTheme } from '../contexts/ThemeContext'

type Section = 'main' | 'change-email' | 'change-password' | 'change-name'

export default function AccountSettingsScreen() {
  const { colors } = useTheme()
  const { user } = useUser()
  const { signOut } = useClerk()
  const queryClient = useQueryClient()
  const [section, setSection] = useState<Section>('main')

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14,
          borderBottomWidth: 1, borderBottomColor: colors.border,
        }}>
          <TouchableOpacity
            onPress={() => section === 'main' ? router.back() : setSection('main')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ marginRight: 12 }}
          >
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
            {section === 'main' ? 'Account Settings'
              : section === 'change-email' ? 'Change Email'
              : section === 'change-password' ? 'Change Password'
              : 'Change Name'}
          </Text>
        </View>

        {section === 'main' && (
          <MainSection
            user={user}
            colors={colors}
            onNavigate={setSection}
            onDeleteAccount={async () => {
              Alert.alert(
                'Delete Account',
                'This will permanently delete your account and all your data. This cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete Account',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await user?.delete()
                        queryClient.clear()
                        router.replace('/(auth)/sign-in')
                      } catch (e: any) {
                        Alert.alert('Error', e?.errors?.[0]?.message ?? 'Could not delete account.')
                      }
                    },
                  },
                ]
              )
            }}
          />
        )}
        {section === 'change-name' && (
          <ChangeNameSection user={user} colors={colors} onDone={() => setSection('main')} />
        )}
        {section === 'change-email' && (
          <ChangeEmailSection user={user} colors={colors} onDone={() => setSection('main')} />
        )}
        {section === 'change-password' && (
          <ChangePasswordSection user={user} colors={colors} onDone={() => setSection('main')} />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ─── Main Section ──────────────────────────────────────────────────────────────

function MainSection({ user, colors, onNavigate, onDeleteAccount }: {
  user: any; colors: any
  onNavigate: (s: Section) => void
  onDeleteAccount: () => void
}) {
  const cardStyle = {
    backgroundColor: colors.surface, borderRadius: 20,
    borderWidth: 1, borderColor: colors.borderLight, marginBottom: 20,
    shadowColor: colors.primary, shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 3 }, shadowRadius: 10, elevation: 2,
  }
  const rowStyle = (last = false) => ({
    flexDirection: 'row' as const, alignItems: 'center' as const,
    paddingHorizontal: 16, paddingVertical: 15,
    borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.borderLight,
  })
  const iconBg = (bg = colors.primaryLight) => ({
    width: 34, height: 34, borderRadius: 10, backgroundColor: bg,
    alignItems: 'center' as const, justifyContent: 'center' as const, marginRight: 13,
  })

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
      {/* Profile info */}
      <View style={cardStyle}>
        <View style={rowStyle()}>
          <View style={iconBg()}>
            <Ionicons name="person-outline" size={17} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: colors.textTertiary, fontWeight: '600', marginBottom: 1 }}>NAME</Text>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }}>
              {user?.fullName ?? '—'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => onNavigate('change-name')}>
            <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>Edit</Text>
          </TouchableOpacity>
        </View>

        <View style={rowStyle()}>
          <View style={iconBg()}>
            <Ionicons name="mail-outline" size={17} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: colors.textTertiary, fontWeight: '600', marginBottom: 1 }}>EMAIL</Text>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }} numberOfLines={1}>
              {user?.primaryEmailAddress?.emailAddress ?? '—'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => onNavigate('change-email')}>
            <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>Change</Text>
          </TouchableOpacity>
        </View>

        <View style={rowStyle(true)}>
          <View style={iconBg()}>
            <Ionicons name="lock-closed-outline" size={17} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: colors.textTertiary, fontWeight: '600', marginBottom: 1 }}>PASSWORD</Text>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }}>••••••••</Text>
          </View>
          <TouchableOpacity onPress={() => onNavigate('change-password')}>
            <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>Change</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Connected accounts */}
      {user?.externalAccounts?.length > 0 && (
        <>
          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textTertiary, letterSpacing: 0.8, marginBottom: 8 }}>CONNECTED ACCOUNTS</Text>
          <View style={cardStyle}>
            {user.externalAccounts.map((acc: any, i: number) => (
              <View key={acc.id} style={rowStyle(i === user.externalAccounts.length - 1)}>
                <View style={iconBg('#EEF2FF')}>
                  <Ionicons name={acc.provider === 'google' ? 'logo-google' : 'person-outline'} size={17} color="#4F46E5" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500', textTransform: 'capitalize' }}>{acc.provider}</Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 1 }}>{acc.emailAddress}</Text>
                </View>
                <View style={{ backgroundColor: '#D1FAE5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: '#065F46', fontSize: 11, fontWeight: '600' }}>Connected</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Danger zone */}
      <Text style={{ fontSize: 11, fontWeight: '700', color: '#EF4444', letterSpacing: 0.8, marginBottom: 8 }}>DANGER ZONE</Text>
      <View style={{ ...cardStyle, borderColor: '#FCA5A5' }}>
        <TouchableOpacity onPress={onDeleteAccount} style={rowStyle(true)}>
          <View style={iconBg('#FEE2E2')}>
            <Ionicons name="trash-outline" size={17} color="#EF4444" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#EF4444', fontSize: 15, fontWeight: '600' }}>Delete Account</Text>
            <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 1 }}>Permanently remove your account and data</Text>
          </View>
          <Ionicons name="chevron-forward" size={15} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

// ─── Change Name ───────────────────────────────────────────────────────────────

function ChangeNameSection({ user, colors, onDone }: { user: any; colors: any; onDone: () => void }) {
  const [firstName, setFirstName] = useState(user?.firstName ?? '')
  const [lastName, setLastName] = useState(user?.lastName ?? '')
  const [loading, setLoading] = useState(false)

  async function save() {
    if (!firstName.trim()) { Alert.alert('Error', 'First name is required.'); return }
    setLoading(true)
    try {
      await user?.update({ firstName: firstName.trim(), lastName: lastName.trim() })
      Alert.alert('Saved', 'Your name has been updated.')
      onDone()
    } catch (e: any) {
      Alert.alert('Error', e?.errors?.[0]?.message ?? 'Could not update name.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20 }}>
      <InputField label="First Name" value={firstName} onChangeText={setFirstName} colors={colors} autoCapitalize="words" />
      <InputField label="Last Name" value={lastName} onChangeText={setLastName} colors={colors} autoCapitalize="words" />
      <SaveButton label="Save Name" loading={loading} onPress={save} colors={colors} />
    </ScrollView>
  )
}

// ─── Change Email ──────────────────────────────────────────────────────────────

function ChangeEmailSection({ user, colors, onDone }: { user: any; colors: any; onDone: () => void }) {
  const [step, setStep] = useState<'enter' | 'verify'>('enter')
  const [newEmail, setNewEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingEmailId, setPendingEmailId] = useState<string | null>(null)

  async function sendCode() {
    if (!newEmail.trim() || !newEmail.includes('@')) {
      Alert.alert('Error', 'Enter a valid email address.')
      return
    }
    setLoading(true)
    try {
      const emailAddr = await user?.createEmailAddress({ email: newEmail.trim() })
      await emailAddr?.prepareVerification({ strategy: 'email_code' })
      setPendingEmailId(emailAddr?.id ?? null)
      setStep('verify')
    } catch (e: any) {
      Alert.alert('Error', e?.errors?.[0]?.message ?? 'Could not send verification code.')
    } finally {
      setLoading(false)
    }
  }

  async function verify() {
    if (!code.trim()) { Alert.alert('Error', 'Enter the 6-digit code.'); return }
    setLoading(true)
    try {
      const emailAddr = user?.emailAddresses?.find((e: any) => e.id === pendingEmailId)
      await emailAddr?.attemptVerification({ code: code.trim() })
      // Make it primary
      await user?.update({ primaryEmailAddressId: pendingEmailId! })
      Alert.alert('Success', 'Your email has been updated.')
      onDone()
    } catch (e: any) {
      Alert.alert('Error', e?.errors?.[0]?.message ?? 'Verification failed. Check the code and try again.')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'enter') {
    return (
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 20, lineHeight: 21 }}>
          Enter your new email address. We'll send a verification code to confirm it.
        </Text>
        <InputField
          label="New Email Address"
          value={newEmail}
          onChangeText={setNewEmail}
          colors={colors}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <SaveButton label="Send Verification Code" loading={loading} onPress={sendCode} colors={colors} />
      </ScrollView>
    )
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20 }}>
      <View style={{ backgroundColor: colors.primaryLight, borderRadius: 14, padding: 14, marginBottom: 20 }}>
        <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>
          Verification code sent to {newEmail}
        </Text>
      </View>
      <InputField
        label="6-Digit Code"
        value={code}
        onChangeText={setCode}
        colors={colors}
        keyboardType="number-pad"
        maxLength={6}
        placeholder="000000"
      />
      <SaveButton label="Verify & Update Email" loading={loading} onPress={verify} colors={colors} />
      <TouchableOpacity onPress={() => setStep('enter')} style={{ alignItems: 'center', marginTop: 12 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Use a different email</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

// ─── Change Password ───────────────────────────────────────────────────────────

function ChangePasswordSection({ user, colors, onDone }: { user: any; colors: any; onDone: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)

  async function save() {
    if (!current) { Alert.alert('Error', 'Enter your current password.'); return }
    if (next.length < 8) { Alert.alert('Error', 'New password must be at least 8 characters.'); return }
    if (next !== confirm) { Alert.alert('Error', 'Passwords do not match.'); return }
    setLoading(true)
    try {
      await user?.updatePassword({ currentPassword: current, newPassword: next })
      Alert.alert('Success', 'Your password has been updated.')
      onDone()
    } catch (e: any) {
      Alert.alert('Error', e?.errors?.[0]?.message ?? 'Could not update password. Check your current password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20 }}>
      {/* Current password */}
      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>Current Password</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 14, marginBottom: 16 }}>
        <TextInput
          value={current}
          onChangeText={setCurrent}
          secureTextEntry={!showCurrent}
          placeholder="Enter current password"
          placeholderTextColor={colors.textTertiary}
          style={{ flex: 1, fontSize: 15, color: colors.text, paddingVertical: 13 }}
        />
        <TouchableOpacity onPress={() => setShowCurrent(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name={showCurrent ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* New password */}
      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>New Password</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 14, marginBottom: 8 }}>
        <TextInput
          value={next}
          onChangeText={setNext}
          secureTextEntry={!showNext}
          placeholder="Min. 8 characters"
          placeholderTextColor={colors.textTertiary}
          style={{ flex: 1, fontSize: 15, color: colors.text, paddingVertical: 13 }}
        />
        <TouchableOpacity onPress={() => setShowNext(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name={showNext ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* Password strength */}
      {next.length > 0 && (
        <PasswordStrength password={next} colors={colors} />
      )}

      {/* Confirm */}
      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: 16 }}>Confirm New Password</Text>
      <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: confirm && confirm !== next ? '#EF4444' : colors.border, borderRadius: 14, paddingHorizontal: 14, marginBottom: 4 }}>
        <TextInput
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          placeholder="Re-enter new password"
          placeholderTextColor={colors.textTertiary}
          style={{ fontSize: 15, color: colors.text, paddingVertical: 13 }}
        />
      </View>
      {confirm.length > 0 && confirm !== next && (
        <Text style={{ color: '#EF4444', fontSize: 12, marginBottom: 4 }}>Passwords do not match</Text>
      )}

      <View style={{ height: 20 }} />
      <SaveButton label="Update Password" loading={loading} onPress={save} colors={colors} />
    </ScrollView>
  )
}

// ─── Password Strength Indicator ──────────────────────────────────────────────

function PasswordStrength({ password, colors }: { password: string; colors: any }) {
  const checks = [
    { label: 'At least 8 characters', pass: password.length >= 8 },
    { label: 'Uppercase letter',       pass: /[A-Z]/.test(password) },
    { label: 'Number',                 pass: /\d/.test(password) },
    { label: 'Special character',      pass: /[^A-Za-z0-9]/.test(password) },
  ]
  const score = checks.filter(c => c.pass).length
  const barColor = score <= 1 ? '#EF4444' : score === 2 ? '#F59E0B' : score === 3 ? '#3B82F6' : '#10B981'
  const label = score <= 1 ? 'Weak' : score === 2 ? 'Fair' : score === 3 ? 'Good' : 'Strong'

  return (
    <View style={{ marginBottom: 4 }}>
      <View style={{ flexDirection: 'row', gap: 4, marginBottom: 6 }}>
        {[1, 2, 3, 4].map(i => (
          <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= score ? barColor : colors.border }} />
        ))}
      </View>
      <Text style={{ fontSize: 11, color: barColor, fontWeight: '600', marginBottom: 6 }}>{label}</Text>
      {checks.map(c => (
        <View key={c.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <Ionicons name={c.pass ? 'checkmark-circle' : 'ellipse-outline'} size={13} color={c.pass ? '#10B981' : colors.textTertiary} />
          <Text style={{ fontSize: 12, color: c.pass ? colors.text : colors.textTertiary }}>{c.label}</Text>
        </View>
      ))}
    </View>
  )
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function InputField({ label, value, onChangeText, colors, placeholder, ...props }: {
  label: string; value: string; onChangeText: (v: string) => void; colors: any; placeholder?: string; [key: string]: any
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? label}
        placeholderTextColor={colors.textTertiary}
        style={{
          backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
          borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13,
          fontSize: 15, color: colors.text,
        }}
        {...props}
      />
    </View>
  )
}

function SaveButton({ label, loading, onPress, colors }: { label: string; loading: boolean; onPress: () => void; colors: any }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading}
      style={{
        backgroundColor: colors.primary, borderRadius: 16,
        paddingVertical: 15, alignItems: 'center',
        opacity: loading ? 0.7 : 1, marginTop: 4,
      }}
    >
      {loading
        ? <ActivityIndicator size="small" color="white" />
        : <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>{label}</Text>
      }
    </TouchableOpacity>
  )
}
