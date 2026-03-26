import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { useAuth } from '@clerk/clerk-expo'
import { api } from '../lib/api'

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  })

  if (Platform.OS === 'android') {
    // Default app notifications channel
    Notifications.setNotificationChannelAsync('default', {
      name: 'Masjid App',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#14532D',
    }).catch(() => {})

    // Quran media player channel — no sound/vibration for silent media controls
    Notifications.setNotificationChannelAsync('quran_player', {
      name: 'Quran Player',
      importance: Notifications.AndroidImportance.LOW,
      sound: undefined,
      enableVibrate: false,
      showBadge: false,
    }).catch(() => {})
  }
}

/** Register notification action categories for the Quran media player.
 *  Call once on app start (before any Quran notification is shown). */
export async function setupQuranPlayerCategory() {
  if (Platform.OS === 'web') return
  try {
    await Notifications.setNotificationCategoryAsync('quran_playing', [
      { identifier: 'quran_prev',  buttonTitle: '⏮',       options: { opensAppToForeground: false } },
      { identifier: 'quran_pause', buttonTitle: '⏸ Pause', options: { opensAppToForeground: false } },
      { identifier: 'quran_next',  buttonTitle: '⏭',       options: { opensAppToForeground: false } },
    ])
    await Notifications.setNotificationCategoryAsync('quran_paused', [
      { identifier: 'quran_prev', buttonTitle: '⏮',      options: { opensAppToForeground: false } },
      { identifier: 'quran_play', buttonTitle: '▶ Play', options: { opensAppToForeground: false } },
      { identifier: 'quran_next', buttonTitle: '⏭',      options: { opensAppToForeground: false } },
    ])
  } catch {}
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: async () => {
      const data = await api.get<any>('/notifications?limit=50')
      return (data.data?.items ?? []).filter((n: any) => !n.isRead).length
    },
    refetchInterval: 30000,
  })
}

export function usePushNotificationSetup() {
  const { isSignedIn } = useAuth()

  useEffect(() => {
    if (!isSignedIn || Platform.OS === 'web') return

    async function registerPushToken() {
      const { status } = await Notifications.requestPermissionsAsync()
      if (status !== 'granted') return

      // Bug 12 fix: fall back to the hardcoded Expo project ID from app.config.ts
      // so push token registration works even without the env var set
      const projectId = process.env.EXPO_PUBLIC_PROJECT_ID ?? 'ba2f52fa-a888-42b6-80a9-d1500a0c5a70'
      if (!projectId) return

      const token = await Notifications.getExpoPushTokenAsync({ projectId })

      await api.post('/notifications/push-token', {
        token: token.data,
        platform: Platform.OS as 'ios' | 'android',
      })
    }

    registerPushToken().catch(console.error)
  }, [isSignedIn])
}
