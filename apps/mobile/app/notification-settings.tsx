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
import { setNearMeAlertsEnabled, getNearMeAlertsEnabled } from '../hooks/useNearMeAlerts'

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
  JUMUAH_REMINDER:  'notif_JUMUAH_REMINDER',
  AYAH_OF_DAY:      'notif_AYAH_OF_DAY',
  RSVP_REMINDER:    'notif_RSVP_REMINDER',
}

// Notifications pushed from mosques
const MASJID_TYPES = [
  { type: 'EVENT_REMINDER',  label: 'Event Reminders',       description: 'Upcoming event alerts from your mosque', icon: '📅' },
  { type: 'JUMUAH_REMINDER', label: "Jumu'ah Reminders",     description: "30-minute reminder every Friday",         icon: '🕋' },
  { type: 'ANNOUNCEMENT',    label: 'Announcements',          description: 'News and updates from your mosque',       icon: '📢' },
  { type: 'NEW_VIDEO',       label: 'New Videos',             description: 'When a new lecture or video is posted',   icon: '🎬' },
  { type: 'RSVP_CONFIRMED',  label: 'RSVP Confirmations',    description: 'When your RSVP is confirmed',             icon: '✅' },
  { type: 'RSVP_REMINDER',   label: 'Event Start Alerts',    description: '1-hour reminder before events you RSVPd', icon: '⏰' },
  { type: 'GENERAL',         label: 'General Notifications',  description: 'Other updates and alerts',                icon: '🔔' },
]

// Personal / location-based
const MY_LOCATION_TYPES = [
  { type: 'PRAYER_REMINDER', label: 'Prayer Reminders', description: 'Get reminded before each prayer', icon: '🕌' },
  { type: 'AYAH_OF_DAY',    label: 'Ayah of the Day',  description: 'Daily morning Quran verse',       icon: '📖' },
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
    NEAR_ME:         false,
    JUMUAH_REMINDER: true,
    AYAH_OF_DAY:     true,
    RSVP_REMINDER:   true,
  })
  const [selectedAdhan, setSelectedAdhan] = useState<AdhanId>('mishary')
  const [previewingId, setPreviewingId] = useState<string | null>(null)

  useEffect(() => {
    const keys = Object.values(STORAGE_KEYS)
    AsyncStorage.multiGet([...keys, ADHAN_SELECTION_KEY]).then(async (pairs) => {
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
      updates.NEAR_ME = await getNearMeAlertsEnabled()
      if (Object.keys(updates).length > 0) setPrefs(p => ({ ...p, ...updates }))
    })
  }, [])

  function toggle(key: string, value: boolean) {
    setPrefs(p => ({ ...p, [key]: value }))
    if (key === 'NEAR_ME') {
      setNearMeAlertsEnabled(value)
    } else if (STORAGE_KEYS[key]) {
      AsyncStorage.setItem(STORAGE_KEYS[key], String(value))
    }
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
      setTimeout(() => setPreviewingId(prev => (prev === id ? null : prev)), 15000)
    }
  }

  function NotifRow({ item, index, total, hasSub }: {
    item: { type: string; label: string; description: string; icon: string }
    index: number
    total: number
    hasSub?: boolean
  }) {
    return (
      <View
        style={{
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 16, paddingVertical: 14,
          borderBottomWidth: hasSub ? 0 : (index < total - 1 ? 1 : 0),
          borderBottomColor: colors.borderLight,
          borderTopLeftRadius: index === 0 ? 16 : 0,
          borderTopRightRadius: index === 0 ? 16 : 0,
          borderBottomLeftRadius: index === total - 1 && !hasSub ? 16 : 0,
          borderBottomRightRadius: index === total - 1 && !hasSub ? 16 : 0,
        }}
      >
        <Text style={{ fontSize: 22, width: 34 }}>{item.icon}</Text>
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
    )
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

        {/* ── Masjid ─────────────────────────────────────────────────── */}
        <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '800', letterSpacing: 0.7, marginBottom: 8 }}>
          MASJID
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 12, lineHeight: 17 }}>
          Notifications sent by mosques you follow.
        </Text>
        <View style={{ backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.surfaceSecondary, marginBottom: 28 }}>
          {MASJID_TYPES.map((item, i) => (
            <NotifRow key={item.type} item={item} index={i} total={MASJID_TYPES.length} />
          ))}
        </View>

        {/* ── My Location ────────────────────────────────────────────── */}
        <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '800', letterSpacing: 0.7, marginBottom: 8 }}>
          MY LOCATION
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 12, lineHeight: 17 }}>
          Personal reminders based on your prayer times and location.
        </Text>
        <View style={{ backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.surfaceSecondary, marginBottom: 8 }}>
          {MY_LOCATION_TYPES.map((item, i) => {
            const isLast = i === MY_LOCATION_TYPES.length - 1
            const showSub = item.type === 'PRAYER_REMINDER' && prefs.PRAYER_REMINDER
            return (
              <View key={item.type}>
                <NotifRow item={item} index={i} total={MY_LOCATION_TYPES.length} hasSub={showSub} />
                {showSub && (
                  <View style={{
                    backgroundColor: colors.background,
                    borderTopWidth: 1, borderTopColor: colors.surfaceSecondary,
                    borderBottomWidth: isLast ? 0 : 1, borderBottomColor: colors.background,
                    borderBottomLeftRadius: isLast ? 16 : 0,
                    borderBottomRightRadius: isLast ? 16 : 0,
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
                        alignItems: 'center', justifyContent: 'center', marginLeft: 34, marginRight: 12,
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
                        alignItems: 'center', justifyContent: 'center', marginLeft: 34, marginRight: 12,
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
            )
          })}
        </View>

        {/* Near Me */}
        <View style={{ backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.surfaceSecondary, marginBottom: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16 }}>
            <Text style={{ fontSize: 22, width: 34 }}>📍</Text>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>Nearby Mosque Alerts</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 1 }}>
                {prefs.NEAR_ME
                  ? 'Notifies you when a mosque is nearby at prayer time'
                  : 'Alert when a mosque is within 2 km at prayer time'}
              </Text>
            </View>
            <Switch
              value={prefs.NEAR_ME ?? false}
              onValueChange={(val) => toggle('NEAR_ME', val)}
              trackColor={{ false: colors.border, true: '#86EFAC' }}
              thumbColor={(prefs.NEAR_ME ?? false) ? colors.primary : colors.textTertiary}
            />
          </View>
        </View>
        <Text style={{ color: colors.textTertiary, fontSize: 12, marginBottom: 28, marginHorizontal: 4, lineHeight: 17 }}>
          Requires location permission. Your location is never sent to our servers — detection happens on-device only.
        </Text>

        {/* ── Adhan Audio ────────────────────────────────────────────── */}
        <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '800', letterSpacing: 0.7, marginBottom: 8 }}>
          ADHAN AUDIO
        </Text>
        <View style={{ backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.surfaceSecondary }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
            <Text style={{ fontSize: 22, width: 34 }}>🔊</Text>
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
                    <View style={{
                      width: 20, height: 20, borderRadius: 10, borderWidth: 2,
                      borderColor: isSelected ? colors.primary : colors.border,
                      backgroundColor: isSelected ? colors.primary : colors.surface,
                      alignItems: 'center', justifyContent: 'center', marginRight: 12,
                    }}>
                      {isSelected && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primaryContrast }} />}
                    </View>
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
