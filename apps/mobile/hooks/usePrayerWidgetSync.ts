/**
 * usePrayerWidgetSync
 *
 * Writes today's prayer times to AsyncStorage whenever the app comes to the
 * foreground.  The stored JSON is read by native widget extensions via the
 * shared App Group container (iOS) or SharedPreferences bridge (Android).
 *
 * Key: @widget/prayer_data
 * Shape: { mosqueName, date, prayers: { fajr, dhuhr, asr, maghrib, isha, sunrise }, fetchedAt }
 */

import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { api } from '../lib/api'

export const WIDGET_PRAYER_KEY = '@widget/prayer_data'

export interface WidgetPrayerData {
  mosqueName: string
  date: string            // YYYY-MM-DD
  prayers: {
    fajr: string | null
    sunrise: string | null
    dhuhr: string | null
    asr: string | null
    maghrib: string | null
    isha: string | null
  }
  fetchedAt: string
}

async function syncWidgetData(mosqueId: string) {
  try {
    const res = await api.get(`/mosques/${mosqueId}/prayer-times/widget`)
    const { data } = res
    if (!data?.today) return

    const payload: WidgetPrayerData = {
      mosqueName: data.mosqueName,
      date: new Date(data.today.date).toISOString().split('T')[0],
      prayers: {
        fajr: data.today.fajr ?? null,
        sunrise: data.today.sunrise ?? null,
        dhuhr: data.today.dhuhr ?? null,
        asr: data.today.asr ?? null,
        maghrib: data.today.maghrib ?? null,
        isha: data.today.isha ?? null,
      },
      fetchedAt: data.fetchedAt,
    }

    await AsyncStorage.setItem(WIDGET_PRAYER_KEY, JSON.stringify(payload))
  } catch (err) {
    // Best-effort — widget data should not crash the app
    if (__DEV__) console.warn('[usePrayerWidgetSync] sync failed:', err)
  }
}

export function usePrayerWidgetSync(mosqueId: string | null | undefined) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!mosqueId) return

    // Sync immediately on mount
    syncWidgetData(mosqueId)

    // Re-sync every time the app comes to the foreground (debounced 1s)
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => syncWidgetData(mosqueId), 1000)
      }
    })

    return () => {
      sub.remove()
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [mosqueId])
}
