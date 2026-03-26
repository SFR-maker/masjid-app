import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../contexts/ThemeContext'
import { useLanguage } from '../contexts/LanguageContext'

export const LANGUAGES = [
  { code: 'en', name: 'English',    native: 'English',          rtl: false },
  { code: 'ar', name: 'Arabic',     native: 'العربية',           rtl: true  },
  { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia',  rtl: false },
  { code: 'ur', name: 'Urdu',       native: 'اردو',              rtl: true  },
  { code: 'bn', name: 'Bengali',    native: 'বাংলা',             rtl: false },
  { code: 'tr', name: 'Turkish',    native: 'Türkçe',            rtl: false },
  { code: 'fa', name: 'Persian',    native: 'فارسی',             rtl: true  },
  { code: 'pa', name: 'Punjabi',    native: 'ਪੰਜਾਬੀ',           rtl: false },
  { code: 'hi', name: 'Hindi',      native: 'हिन्दी',            rtl: false },
]

export default function LanguageScreen() {
  const { colors } = useTheme()
  const { t } = useTranslation()
  const { language, setLanguage } = useLanguage()
  const [saving, setSaving] = useState(false)

  async function handleSelect(code: string) {
    if (code === language) {
      router.back()
      return
    }
    setSaving(true)
    await setLanguage(code)
    setSaving(false)

    const isRTL = ['ar', 'ur', 'fa'].includes(code)
    if (isRTL) {
      Alert.alert(
        'Restart Required',
        'Please restart the app to fully apply the right-to-left layout.',
        [{ text: 'OK', onPress: () => router.back() }]
      )
    } else {
      router.back()
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14,
        borderBottomWidth: 1, borderBottomColor: colors.border,
      }}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ marginRight: 12 }}
        >
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{t('language_title')}</Text>
          <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 1 }}>{t('language_subtitle')}</Text>
        </View>
        {saving && <ActivityIndicator size="small" color={colors.primary} />}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 16, paddingHorizontal: 16 }}>
        <View style={{
          backgroundColor: colors.surface, borderRadius: 20,
          borderWidth: 1, borderColor: colors.borderLight,
          overflow: 'hidden',
          shadowColor: colors.primary, shadowOpacity: 0.04,
          shadowOffset: { width: 0, height: 3 }, shadowRadius: 10, elevation: 2,
        }}>
          {LANGUAGES.map((lang, i) => (
            <TouchableOpacity
              key={lang.code}
              onPress={() => handleSelect(lang.code)}
              activeOpacity={0.75}
              style={{
                flexDirection: 'row', alignItems: 'center',
                paddingHorizontal: 16, paddingVertical: 15,
                borderBottomWidth: i < LANGUAGES.length - 1 ? 1 : 0,
                borderBottomColor: colors.borderLight,
                backgroundColor: language === lang.code ? colors.primaryLight + '55' : 'transparent',
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '500', color: colors.text }}>{lang.name}</Text>
                <Text style={{
                  fontSize: 13, color: colors.textSecondary, marginTop: 1,
                  textAlign: lang.rtl ? 'right' : 'left',
                }}>
                  {lang.native}
                </Text>
              </View>
              {language === lang.code
                ? <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                : <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border }} />
              }
            </TouchableOpacity>
          ))}
        </View>

        <Text style={{
          color: colors.textTertiary, fontSize: 12, textAlign: 'center',
          marginTop: 20, lineHeight: 18, paddingHorizontal: 16,
        }}>
          {t('language_select')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}
