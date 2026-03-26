import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useTheme } from '../contexts/ThemeContext'

const sections = [
  {
    title: 'Data We Collect',
    body: 'We collect your name, email address, and location (only when you use Near Me). We do not sell your data to third parties.',
  },
  {
    title: 'Push Notifications',
    body: 'You can opt out of push notifications at any time from your device settings.',
  },
  {
    title: 'Location Data',
    body: 'Location is only accessed when you tap "Near Me" in Discover. It is not stored on our servers.',
  },
  {
    title: 'Account Deletion',
    body: 'To delete your account and all associated data, please contact support@masjidapp.com.',
  },
]

export default function PrivacyScreen() {
  const { colors } = useTheme()
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.surfaceSecondary }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>Privacy Settings</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {sections.map((s) => (
          <View key={s.title} style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.surfaceSecondary }}>
            <Text style={{ fontWeight: '700', color: colors.text, fontSize: 15, marginBottom: 6 }}>{s.title}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20 }}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}
