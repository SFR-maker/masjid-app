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

      const projectId = process.env.EXPO_PUBLIC_PROJECT_ID
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
