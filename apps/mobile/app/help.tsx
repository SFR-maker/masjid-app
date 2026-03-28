import { View, Text, TouchableOpacity, ScrollView, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useTheme } from '../contexts/ThemeContext'

const faqs = [
  { q: 'How do I follow a mosque?', a: 'Open the mosque\'s page from Discover and tap the Follow button.' },
  { q: 'Why are prayer times not showing?', a: 'Prayer times are set by mosque admins. If times are missing, the mosque hasn\'t added them yet.' },
  { q: 'How do I RSVP to an event?', a: 'Go to a mosque\'s page, open an event, and tap RSVP.' },
  { q: 'Can I add my mosque to the app?', a: 'Contact us at support@masjidly.app to get your mosque listed.' },
]

export default function HelpScreen() {
  const { colors } = useTheme()
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.surfaceSecondary }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>Help & Support</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12 }}>FAQ</Text>
        {faqs.map((item) => (
          <View key={item.q} style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.surfaceSecondary }}>
            <Text style={{ fontWeight: '600', color: colors.text, fontSize: 14, marginBottom: 4 }}>{item.q}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>{item.a}</Text>
          </View>
        ))}
        <TouchableOpacity
          onPress={() => Linking.openURL('mailto:support@masjidly.app')}
          style={{ marginTop: 8, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
        >
          <Text style={{ color: colors.primaryContrast, fontWeight: '600' }}>Email Support</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}
