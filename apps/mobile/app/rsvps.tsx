import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import * as Calendar from 'expo-calendar'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { api } from '../lib/api'
import { useTheme } from '../contexts/ThemeContext'

function formatICSDate(d: Date) {
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

function buildICS(event: { title: string; startTime: string; endTime?: string; location?: string; description?: string }) {
  const start = new Date(event.startTime)
  const end = event.endTime ? new Date(event.endTime) : new Date(start.getTime() + 60 * 60 * 1000)
  const uid = `${Date.now()}@masjidapp`
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Masjidly//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatICSDate(new Date())}`,
    `DTSTART:${formatICSDate(start)}`,
    `DTEND:${formatICSDate(end)}`,
    `SUMMARY:${event.title}`,
    event.location ? `LOCATION:${event.location}` : '',
    event.description ? `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')
}

async function addEventToCalendar(event: { title: string; startTime: string; endTime?: string; location?: string; description?: string }) {
  if (Platform.OS === 'web') {
    const ics = buildICS(event)
    const blob = new Blob([ics], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const a = (globalThis as any).document.createElement('a')
    a.href = url
    a.download = `${event.title.replace(/\s+/g, '_')}.ics`
    a.click()
    URL.revokeObjectURL(url)
    return
  }

  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync()
    if (status === 'granted') {
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT)
      const writableCal = calendars.find(c => c.allowsModifications)
      if (writableCal) {
        const startDate = new Date(event.startTime)
        const endDate = event.endTime ? new Date(event.endTime) : new Date(startDate.getTime() + 60 * 60 * 1000)
        await Calendar.createEventAsync(writableCal.id, {
          title: event.title,
          startDate,
          endDate,
          location: event.location,
          notes: event.description,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        })
        Alert.alert('Added to Calendar', `"${event.title}" is now in your calendar.`)
        return
      }
    }
  } catch {
    // fall through to ICS share
  }

  try {
    const ics = buildICS(event)
    const fs = FileSystem as any
    const filename = `${fs.cacheDirectory}event.ics`
    await fs.writeAsStringAsync(filename, ics, { encoding: 'utf8' })
    const canShare = await Sharing.isAvailableAsync()
    if (canShare) {
      await Sharing.shareAsync(filename, { mimeType: 'text/calendar', UTI: 'public.calendar-event' })
    } else {
      Alert.alert('Error', 'Calendar sharing is not available on this device.')
    }
  } catch {
    Alert.alert('Error', 'Could not add event to calendar.')
  }
}

function getStatusConfig(colors: any) {
  return {
    GOING:     { label: 'Going',    color: colors.isDark ? '#86efac' : '#2D6A4F', bg: colors.isDark ? '#052e16' : '#D8F3DC' },
    MAYBE:     { label: 'Maybe',    color: colors.isDark ? '#fde68a' : '#92400E', bg: colors.isDark ? '#422006' : '#FEF3C7' },
    NOT_GOING: { label: "Can't go", color: colors.isDark ? '#fca5a5' : '#991B1B', bg: colors.isDark ? '#450a0a' : '#FEE2E2' },
  }
}

export default function RSVPsScreen() {
  const { colors } = useTheme()
  const STATUS_CONFIG = getStatusConfig(colors)
  const { data, isLoading } = useQuery({
    queryKey: ['user-rsvps'],
    queryFn: () => api.get('/users/me/rsvps'),
  })

  // Bug 3 fix: defensive client-side filter — exclude NOT_GOING/declined RSVPs
  const rsvps: any[] = (data?.data?.items ?? []).filter(
    (r: any) => r.status === 'GOING' || r.status === 'MAYBE'
  )

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>My RSVPs</Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : rsvps.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>📅</Text>
          <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 8 }}>No RSVPs yet</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center' }}>
            Events you RSVP to from mosque pages will appear here.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/discover')}
            style={{ marginTop: 24, backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
          >
            <Text style={{ color: 'white', fontWeight: '600' }}>Discover Mosques</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 12 }}>
          {rsvps.map((rsvp) => {
            const event = rsvp.event
            const cfg = STATUS_CONFIG[rsvp.status as keyof ReturnType<typeof getStatusConfig>]
            return (
              <TouchableOpacity
                key={rsvp.id}
                onPress={() => router.push(`/event/${event.id}`)}
                style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={{ fontWeight: '700', fontSize: 15, color: colors.text, marginBottom: 4 }} numberOfLines={2}>
                      {event.title}
                    </Text>
                    <TouchableOpacity
                      onPress={(e) => { e.stopPropagation?.(); (event.mosqueId ?? event.mosque?.id) && router.push(`/mosque/${event.mosqueId ?? event.mosque?.id}` as any) }}
                      disabled={!(event.mosqueId ?? event.mosque?.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>{event.mosqueName ?? event.mosque?.name}</Text>
                    </TouchableOpacity>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="calendar-outline" size={13} color={colors.textTertiary} />
                      <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                        {format(new Date(event.startTime), 'EEE, MMM d · h:mm a')}
                      </Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 8 }}>
                    {cfg && (
                      <View style={{ backgroundColor: cfg.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                        <Text style={{ color: cfg.color, fontSize: 12, fontWeight: '600' }}>{cfg.label}</Text>
                      </View>
                    )}
                    {rsvp.status === 'GOING' && (
                      <TouchableOpacity
                        onPress={(e) => { e.stopPropagation?.(); addEventToCalendar(event) }}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                      >
                        <Ionicons name="calendar-outline" size={14} color={colors.primary} />
                        <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '600' }}>Add to calendar</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
