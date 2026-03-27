/**
 * Near Me Alerts — checks if user is within 2km of any unfollowed mosque
 * at prayer times and fires a local notification. Opt-in via AsyncStorage.
 *
 * Called once from the home screen on mount (or app focus).
 */

import { useEffect } from 'react'
import * as Location from 'expo-location'
import * as Notifications from 'expo-notifications'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuth } from '@clerk/clerk-expo'
import { api } from '../lib/api'

const NEAR_ME_OPT_IN_KEY = 'near_me_alerts_v1'
const NEAR_ME_LAST_FIRED_KEY = 'near_me_last_fired'
const RADIUS_KM = 2

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function isNearPrayerTime(): boolean {
  const now = new Date()
  const h = now.getHours()
  const m = now.getMinutes()
  const totalMin = h * 60 + m
  // Rough prayer time windows (±20 min) — Fajr, Dhuhr, Asr, Maghrib, Isha
  const windows = [
    [5 * 60 - 20, 5 * 60 + 20],
    [13 * 60 - 20, 13 * 60 + 20],
    [16 * 60 - 20, 16 * 60 + 20],
    [18 * 60 - 20, 18 * 60 + 20],
    [20 * 60 - 20, 20 * 60 + 20],
  ]
  return windows.some(([start, end]) => totalMin >= start && totalMin <= end)
}

export function useNearMeAlerts() {
  const { isSignedIn } = useAuth()

  useEffect(() => {
    if (!isSignedIn) return

    async function check() {
      const optIn = await AsyncStorage.getItem(NEAR_ME_OPT_IN_KEY)
      if (optIn !== 'true') return
      if (!isNearPrayerTime()) return

      // Debounce: only fire once per hour
      const lastFired = await AsyncStorage.getItem(NEAR_ME_LAST_FIRED_KEY)
      if (lastFired) {
        const elapsed = Date.now() - Number(lastFired)
        if (elapsed < 60 * 60 * 1000) return
      }

      const { status } = await Location.getForegroundPermissionsAsync()
      if (status !== 'granted') return

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        .catch(() => null)
      if (!loc) return

      const { latitude, longitude } = loc.coords

      // Fetch mosques near the user's location
      const res = await api.get<any>(
        `/mosques?latitude=${latitude}&longitude=${longitude}&radius=5&limit=20`
      ).catch(() => null)
      if (!res?.data?.items?.length) return

      // Filter to unfollowed mosques within RADIUS_KM
      const nearby = res.data.items.filter((m: any) => {
        if (m.isFollowing) return false
        if (!m.latitude || !m.longitude) return false
        return haversineKm(latitude, longitude, m.latitude, m.longitude) <= RADIUS_KM
      })

      if (!nearby.length) return

      const mosque = nearby[0]
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🕌 Mosque nearby',
          body: `${mosque.name} is within walking distance — prayer time is soon`,
          data: { mosqueId: mosque.id, type: 'near_me' },
          sound: 'default',
        },
        trigger: null, // fire immediately
      })

      await AsyncStorage.setItem(NEAR_ME_LAST_FIRED_KEY, String(Date.now()))
    }

    check().catch(console.warn)
  // Run once on mount (or when sign-in changes)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn])
}

/** Expose opt-in toggle so Settings screen can call it */
export async function setNearMeAlertsEnabled(enabled: boolean) {
  await AsyncStorage.setItem(NEAR_ME_OPT_IN_KEY, enabled ? 'true' : 'false')
}

export async function getNearMeAlertsEnabled(): Promise<boolean> {
  const val = await AsyncStorage.getItem(NEAR_ME_OPT_IN_KEY)
  return val === 'true'
}
