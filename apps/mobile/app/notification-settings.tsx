import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Switch, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  ADHANS, ADHAN_SELECTION_KEY, type AdhanId,
  previewAdhan, stopAdhanPreview,
} from '../hooks/useAdhanScheduler'
import { useTheme } from '../contexts/ThemeContext'

const STORAGE_KEYS: Record<string, string> = {
  PRAYER_REMINDER:  'notif_PRAYER_REMINDER',
  EVENT_REMINDER:   'notif_EVENT_REMINDER',
  ANNOUNCEMENT:     'notif_ANNOUNCEMENT',
  NEW_VIDEO:        'notif_NEW_VIDEO',
  RSVP_CONFIRMED:   'notif_RSVP_CONFIRMED',
  GENERAL:          'notif_GENERAL',
  ADHAN_AUDIO:      'adhan_audio_enabled',
  PRAYER_AT_TIME:   'prayer_reminder_at_time',
  PRAYER_15MIN:     'prayer_reminder_15min_before',
}

const NOTIFICATION_TYPES = [
  { type: 'PRAYER_REMINDER', label: 'Prayer Reminders', description: 'Get reminded before each prayer', icon: '🕌' },
  { type: 'EVENT_REMINDER',  label: 'Event Reminders',  description: 'Upcoming event alerts', icon: '📅' },
  { type: 'ANNOUNCEMENT',    label: 'Announcements',    description: 'News and updates from your mosque', icon: '📢' },
  { type: 'NEW_VIDEO',       label: 'New Videos',       description: 'When a new lecture or video is posted', icon: '🎬' },
  { type: 'RSVP_CONFIRMED',  label: 'RSVP Confirmations', description: 'When your RSVP is confirmed', icon: '✅' },
  { type: 'GENERAL',         label: 'General Notifications', description: 'Other updates and alerts', icon: '🔔' },
]

export default function NotificationSettingsScreen() {
  const { colors } = useTheme()
  const [prefs, setPrefs] = useState<Record<string, boolean>>({
    PRAYER_REMINDER: true,
    EVENT_REMINDER:  true,
    ANNOUNCEMENT:    true,
    NEW_VIDEO:       true,
    RSVP_CONFIRMED:  true,
    GENERAL:         true,
    ADHAN_AUDIO:     true,
    PRAYER_AT_TIME:  true,
    PRAYER_15MIN:    false,
  })
  const [selectedAdhan, setSelectedAdhan] = useState<AdhanId>('mishary')
  const [previewingId, setPreviewingId] = useState<string | null>(null)

  useEffect(() => {
    const keys = Object.values(STORAGE_KEYS)
    AsyncStorage.multiGet([...keys, ADHAN_SELECTION_KEY]).then((pairs) => {
      const updates: Record<string, boolean> = {}
      for (const [storageKey, val] of pairs) {
        if (storageKey === ADHAN_SELECTION_KEY) {
          if (val) setSelectedAdhan(val as AdhanId)
          continue
        }
        if (val !== null) {
          const prefKey = Object.entries(STORAGE_KEYS).find(([, v]) => v === storageKey)?.[0]
          if (prefKey) updates[prefKey] = val === 'true'
        }
      }
      if (Object.keys(updates).length > 0) setPrefs(p => ({ ...p, ...updates }))
    })
  }, [])

  function toggle(key: string, value: boolean) {
    setPrefs(p => ({ ...p, [key]: value }))
    AsyncStorage.setItem(STORAGE_KEYS[key], String(value))
  }

  async function selectAdhan(id: AdhanId) {
    setSelectedAdhan(id)
    await AsyncStorage.setItem(ADHAN_SELECTION_KEY, id)
  }

  async function handlePreview(id: AdhanId) {
    if (previewingId === id) {
      setPreviewingId(null)
      await stopAdhanPreview()
    } else {
      setPreviewingId(id)
      await previewAdhan(id)
      // Auto-clear after 15s
      setTimeout(() => setPreviewingId(prev => (prev === id ? null : prev)), 15000)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.surfaceSecondary }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>Notification Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 16 }}>
          Control which notifications you receive from your mosques.
        </Text>

        <View style={{ backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.surfaceSecondary }}>
          {NOTIFICATION_TYPES.map((item, i) => (
            <View key={item.type}>
              <View
                style={{
                  flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
                  borderBottomWidth: (item.type === 'PRAYER_REMINDER' && prefs.PRAYER_REMINDER) ? 0 : (i < NOTIFICATION_TYPES.length - 1 ? 1 : 0),
                  borderBottomColor: colors.background,
                  borderTopLeftRadius: i === 0 ? 16 : 0,
                  borderTopRightRadius: i === 0 ? 16 : 0,
                  borderBottomLeftRadius: i === NOTIFICATION_TYPES.length - 1 ? 16 : 0,
                  borderBottomRightRadius: i === NOTIFICATION_TYPES.length - 1 ? 16 : 0,
                }}
              >
                <Text style={{ fontSize: 24, width: 36 }}>{item.icon}</Text>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>{item.label}</Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 1 }}>{item.description}</Text>
                </View>
                <Switch
                  value={prefs[item.type] ?? true}
                  onValueChange={(val) => toggle(item.type, val)}
                  trackColor={{ false: colors.border, true: '#86EFAC' }}
                  thumbColor={(prefs[item.type] ?? true) ? colors.primary : colors.textTertiary}
                />
              </View>

              {/* Prayer Reminder sub-options */}
              {item.type === 'PRAYER_REMINDER' && prefs.PRAYER_REMINDER && (
                <View style={{
                  backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.surfaceSecondary,
                  borderBottomWidth: i < NOTIFICATION_TYPES.length - 1 ? 1 : 0, borderBottomColor: colors.background,
                }}>
                  <TouchableOpacity
                    onPress={() => toggle('PRAYER_AT_TIME', !prefs.PRAYER_AT_TIME)}
                    activeOpacity={0.7}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.surfaceSecondary }}
                  >
                    <View style={{
                      width: 20, height: 20, borderRadius: 6, borderWidth: 2,
                      borderColor: prefs.PRAYER_AT_TIME ? colors.primary : colors.border,
                      backgroundColor: prefs.PRAYER_AT_TIME ? colors.primary : colors.surface,
                      alignItems: 'center', justifyContent: 'center', marginLeft: 36, marginRight: 12,
                    }}>
                      {prefs.PRAYER_AT_TIME && <Ionicons name="checkmark" size={13} color={colors.primaryContrast} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '500' }}>At prayer time</Text>
                      <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 1 }}>Notify exactly when each prayer begins</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => toggle('PRAYER_15MIN', !prefs.PRAYER_15MIN)}
                    activeOpacity={0.7}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}
                  >
                    <View style={{
                      width: 20, height: 20, borderRadius: 6, borderWidth: 2,
                      borderColor: prefs.PRAYER_15MIN ? colors.primary : colors.border,
                      backgroundColor: prefs.PRAYER_15MIN ? colors.primary : colors.surface,
                      alignItems: 'center', justifyContent: 'center', marginLeft: 36, marginRight: 12,
                    }}>
                      {prefs.PRAYER_15MIN && <Ionicons name="checkmark" size={13} color={colors.primaryContrast} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '500' }}>15 minutes before</Text>
                      <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 1 }}>Remind you before the next prayer</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Adhan Audio Toggle */}
        <View style={{ marginTop: 20, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.surfaceSecondary }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
            <Text style={{ fontSize: 24, width: 36 }}>🔊</Text>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>Adhan Audio</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 1 }}>
                {prefs.ADHAN_AUDIO ? 'Adhan will play at prayer times' : 'Prayer times are silent'}
              </Text>
            </View>
            <Switch
              value={prefs.ADHAN_AUDIO ?? true}
              onValueChange={(val) => toggle('ADHAN_AUDIO', val)}
              trackColor={{ false: colors.border, true: '#86EFAC' }}
              thumbColor={(prefs.ADHAN_AUDIO ?? true) ? colors.primary : colors.textTertiary}
            />
          </View>

          {/* Adhan selection — visible when audio is on */}
          {prefs.ADHAN_AUDIO && (
            <View style={{ borderTopWidth: 1, borderTopColor: colors.surfaceSecondary }}>
              <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textTertiary, letterSpacing: 0.5 }}>
                  CHOOSE ADHAN
                </Text>
              </View>
              {ADHANS.map((adhan, i) => {
                const isSelected = selectedAdhan === adhan.id
                const isPreviewing = previewingId === adhan.id
                const isLast = i === ADHANS.length - 1
                return (
                  <TouchableOpacity
                    key={adhan.id}
                    onPress={() => selectAdhan(adhan.id)}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      paddingHorizontal: 16, paddingVertical: 12,
                      borderBottomWidth: isLast ? 0 : 1, borderBottomColor: colors.background,
                      borderBottomLeftRadius: isLast ? 16 : 0,
                      borderBottomRightRadius: isLast ? 16 : 0,
                    }}
                  >
                    {/* Radio circle */}
                    <View style={{
                      width: 20, height: 20, borderRadius: 10, borderWidth: 2,
                      borderColor: isSelected ? colors.primary : colors.border,
                      backgroundColor: isSelected ? colors.primary : colors.surface,
                      alignItems: 'center', justifyContent: 'center', marginRight: 12,
                    }}>
                      {isSelected && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primaryContrast }} />}
                    </View>

                    {/* Label */}
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ color: colors.text, fontSize: 14, fontWeight: isSelected ? '600' : '400' }}>
                          {adhan.label}
                        </Text>
                        {'isDefault' in adhan && adhan.isDefault && (
                          <View style={{ backgroundColor: colors.primaryLight, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 }}>
                            <Text style={{ fontSize: 10, color: colors.primary, fontWeight: '600' }}>DEFAULT</Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 1 }}>{adhan.description}</Text>
                    </View>

                    {/* Preview button */}
                    <TouchableOpacity
                      onPress={() => handlePreview(adhan.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 4,
                        paddingHorizontal: 10, paddingVertical: 5,
                        backgroundColor: isPreviewing ? colors.primary : colors.surfaceSecondary,
                        borderRadius: 8,
                      }}
                    >
                      {isPreviewing
                        ? <ActivityIndicator size="small" color={colors.primaryContrast} />
                        : <Ionicons name="play" size={12} color={colors.textSecondary} />
                      }
                      <Text style={{ fontSize: 11, fontWeight: '600', color: isPreviewing ? colors.primaryContrast : colors.primary }}>
                        {isPreviewing ? 'Stop' : 'Preview'}
                      </Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}
        </View>
        <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 8, marginHorizontal: 4, lineHeight: 17 }}>
          Adhan plays through your device speaker at prayer times. Ensure volume is up and Do Not Disturb is off.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}
