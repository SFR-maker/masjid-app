import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Notifications from 'expo-notifications'
import { Audio } from 'expo-av'

// ─── Available adhans ────────────────────────────────────────────────────────
export const ADHANS = [
  {
    id: 'mishary',
    label: 'Mishary Alafasy',
    description: 'Most popular · Kuwaiti style',
    url: 'https://archive.org/download/AdhanMisharyRashid/Adhan%20Mishary%20Rashid.mp3',
    isDefault: true,
  },
  {
    id: 'madinah',
    label: 'Madinah',
    description: "Al-Masjid an-Nabawi style",
    url: 'https://archive.org/download/adhan_madina/adhan_madina.mp3',
  },
  {
    id: 'egypt',
    label: 'Egyptian',
    description: 'Abdul Basit Abdus-Samad · Classic',
    url: 'https://archive.org/download/Adhan/Abdul-Basit.mp3',
  },
  {
    id: 'mecca',
    label: 'Makkah',
    description: 'Al-Masjid al-Haram style',
    url: 'https://archive.org/download/AdzanMerdu/mecca_56_22.mp3',
  },
] as const

export type AdhanId = typeof ADHANS[number]['id']

export const ADHAN_SELECTION_KEY = 'adhan_selection'
const ADHAN_TAG = 'adhan-prayer'

export function getAdhanUrl(id: string): string {
  return ADHANS.find(a => a.id === id)?.url ?? ADHANS[0].url
}

// ─── Android notification channel ───────────────────────────────────────────
export async function setupAdhanChannel() {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync('adhan', {
    name: 'Adhan (Prayer Call)',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
    showBadge: false,
  })
}

// ─── Scheduling ──────────────────────────────────────────────────────────────
export interface AdhanPrayerTimes {
  fajr?: string
  dhuhr?: string
  asr?: string
  maghrib?: string
  isha?: string
}

const PRAYERS = [
  { key: 'fajr',    label: 'Fajr' },
  { key: 'dhuhr',   label: 'Dhuhr' },
  { key: 'asr',     label: 'Asr' },
  { key: 'maghrib', label: 'Maghrib' },
  { key: 'isha',    label: 'Isha' },
]

async function cancelAdhanNotifications() {
  const pending = await Notifications.getAllScheduledNotificationsAsync()
  const ids = pending
    .filter(n => (n.content.data as any)?.tag === ADHAN_TAG)
    .map(n => n.identifier)
  await Promise.all(ids.map(id => Notifications.cancelScheduledNotificationAsync(id)))
}

async function schedulePrayerNotifications(times: AdhanPrayerTimes) {
  const pairs = await AsyncStorage.multiGet([
    'adhan_audio_enabled',
    'notif_PRAYER_REMINDER',
    'prayer_reminder_at_time',
    'prayer_reminder_15min_before',
  ])
  const map = Object.fromEntries(pairs.map(([k, v]) => [k, v]))

  if (map['adhan_audio_enabled'] === 'false' && map['notif_PRAYER_REMINDER'] === 'false') return

  const notifyAtTime = map['prayer_reminder_at_time'] !== 'false'   // default true
  const notify15Min  = map['prayer_reminder_15min_before'] === 'true' // default false

  if (!notifyAtTime && !notify15Min) return

  const { status } = await Notifications.requestPermissionsAsync()
  if (status !== 'granted') return

  await cancelAdhanNotifications()

  const now      = new Date()
  const todayStr = now.toISOString().slice(0, 10)

  for (const prayer of PRAYERS) {
    const timeStr = times[prayer.key as keyof AdhanPrayerTimes]
    if (!timeStr) continue

    const [h, m] = timeStr.split(':').map(Number)
    if (isNaN(h) || isNaN(m)) continue

    const prayerDate = new Date(
      `${todayStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
    )

    if (notifyAtTime) {
      const secsUntil = Math.floor((prayerDate.getTime() - now.getTime()) / 1000)
      if (secsUntil > 0) {
        await Notifications.scheduleNotificationAsync({
          identifier: `adhan-${prayer.key}-at`,
          content: {
            title: `🕌 ${prayer.label} Prayer`,
            body: `It's time for ${prayer.label} prayer.`,
            sound: true,
            data: { tag: ADHAN_TAG, prayer: prayer.key },
            ...(Platform.OS === 'android' && { channelId: 'adhan' }),
          },
          trigger: { seconds: secsUntil, repeats: false } as any,
        })
      }
    }

    if (notify15Min) {
      const secsUntil = Math.floor(
        (prayerDate.getTime() - 15 * 60 * 1000 - now.getTime()) / 1000
      )
      if (secsUntil > 0) {
        await Notifications.scheduleNotificationAsync({
          identifier: `adhan-${prayer.key}-15min`,
          content: {
            title: `⏰ ${prayer.label} in 15 minutes`,
            body: `${prayer.label} prayer starts soon.`,
            sound: true,
            data: { tag: ADHAN_TAG, prayer: prayer.key },
            ...(Platform.OS === 'android' && { channelId: 'adhan' }),
          },
          trigger: { seconds: secsUntil, repeats: false } as any,
        })
      }
    }
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useAdhanScheduler(times: AdhanPrayerTimes | null) {
  const soundRef = useRef<Audio.Sound | null>(null)
  const timesKey = JSON.stringify(times)

  useEffect(() => {
    if (!times || Platform.OS === 'web') return
    setupAdhanChannel()
      .then(() => schedulePrayerNotifications(times))
      .catch(console.warn)
  }, [timesKey])

  // Foreground: play audio when a prayer notification fires while app is open
  useEffect(() => {
    if (Platform.OS === 'web') return

    const sub = Notifications.addNotificationReceivedListener(async notification => {
      const data = notification.request.content.data as any
      if (data?.tag !== ADHAN_TAG) return
      if (!notification.request.identifier.endsWith('-at')) return // only at-time, not 15-min

      const adhanEnabled = await AsyncStorage.getItem('adhan_audio_enabled')
      if (adhanEnabled === 'false') return

      const selectedId = await AsyncStorage.getItem(ADHAN_SELECTION_KEY)
      const url = getAdhanUrl(selectedId ?? 'mishary')

      try {
        if (soundRef.current) {
          await soundRef.current.stopAsync().catch(() => {})
          await soundRef.current.unloadAsync().catch(() => {})
          soundRef.current = null
        }
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          allowsRecordingIOS: false,
        })
        const { sound } = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: true, volume: 1.0 }
        )
        soundRef.current = sound
        sound.setOnPlaybackStatusUpdate(status => {
          if (status.isLoaded && status.didJustFinish) {
            sound.unloadAsync().catch(() => {})
            soundRef.current = null
          }
        })
      } catch (err) {
        console.warn('[Adhan] Failed to play audio:', err)
      }
    })

    return () => {
      sub.remove()
      soundRef.current?.stopAsync().catch(() => {})
      soundRef.current?.unloadAsync().catch(() => {})
    }
  }, [])
}

// ─── Standalone preview player (for settings page) ──────────────────────────
let previewSound: Audio.Sound | null = null

export async function previewAdhan(id: string) {
  try {
    if (previewSound) {
      await previewSound.stopAsync().catch(() => {})
      await previewSound.unloadAsync().catch(() => {})
      previewSound = null
    }
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      allowsRecordingIOS: false,
    })
    const url = getAdhanUrl(id)
    const { sound } = await Audio.Sound.createAsync(
      { uri: url },
      { shouldPlay: true, volume: 1.0 }
    )
    previewSound = sound
    // Stop preview after 15 seconds
    setTimeout(async () => {
      if (previewSound === sound) {
        await sound.stopAsync().catch(() => {})
        await sound.unloadAsync().catch(() => {})
        previewSound = null
      }
    }, 15000)
  } catch (err) {
    console.warn('[Adhan Preview] Failed:', err)
  }
}

export async function stopAdhanPreview() {
  if (previewSound) {
    await previewSound.stopAsync().catch(() => {})
    await previewSound.unloadAsync().catch(() => {})
    previewSound = null
  }
}
