// Date helpers
export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${m.toString().padStart(2, '0')} ${suffix}`
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

// Haversine distance (km)
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

export function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return haversineKm(lat1, lon1, lat2, lon2) * 0.621371
}

// Slug helpers
export function toSlug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// Pagination cursor
export function encodeCursor(id: string): string {
  return Buffer.from(id).toString('base64')
}

export function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, 'base64').toString('utf8')
}

// Prayer time utils
export const PRAYER_LABELS: Record<string, string> = {
  fajr: 'Fajr',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
}

export function nextPrayer(
  times: Record<string, string | null>,
  now = new Date()
): { name: string; time: string } | null {
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']

  for (const prayer of prayers) {
    const timeStr = times[`${prayer}Adhan`] ?? times[prayer]
    if (!timeStr) continue
    const [h, m] = timeStr.split(':').map(Number)
    const prayerMinutes = h * 60 + m
    if (prayerMinutes > nowMinutes) {
      return { name: PRAYER_LABELS[prayer] ?? prayer, time: timeStr }
    }
  }

  // Next is Fajr tomorrow
  const fajrStr = times['fajrAdhan'] ?? times['fajr']
  if (fajrStr) {
    return { name: 'Fajr', time: fajrStr }
  }

  return null
}
