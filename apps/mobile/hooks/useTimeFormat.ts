import { useQuery } from '@tanstack/react-query'
import AsyncStorage from '@react-native-async-storage/async-storage'

export const TIME_FORMAT_KEY = 'time_format'

/** Convert "HH:mm" (24-hour) to "h:mm AM/PM". Strips any trailing suffix like " (EET)". */
export function convertTo12Hour(time: string | undefined): string | undefined {
  if (!time) return undefined
  const clean = time.split(' ')[0] // strip any timezone suffix
  const [hStr, mStr] = clean.split(':')
  const h = Number(hStr), m = Number(mStr)
  if (isNaN(h) || isNaN(m)) return time
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

/**
 * Returns `formatTime` — converts a "HH:mm" string to the user's preferred format.
 * Backed by React Query so any component calling this will re-render when the
 * preference changes (e.g. after the user toggles in Profile settings).
 */
export function useTimeFormat() {
  const { data: fmt = '12h' } = useQuery({
    queryKey: ['time-format'],
    queryFn: () => AsyncStorage.getItem(TIME_FORMAT_KEY).then(v => v ?? '12h'),
    staleTime: Infinity,
    gcTime: Infinity,
  })

  const is24h = fmt === '24h'

  function formatTime(time: string | undefined): string | undefined {
    if (!time) return undefined
    const clean = time.split(' ')[0] // strip any timezone suffix
    return is24h ? clean : convertTo12Hour(clean)
  }

  return { is24h, formatTime }
}
