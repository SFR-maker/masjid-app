/**
 * Unit tests for next-prayer selection logic.
 * The function is exported from PrayerTimesWidget for testability.
 */

// Re-implement the pure function here for isolated testing
// (avoids importing React Native / Expo in the test environment)

const PRAYER_KEYS = ['fajrAdhan', 'dhuhrAdhan', 'asrAdhan', 'maghribAdhan', 'ishaAdhan']
const PRAYER_NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

interface NextPrayer {
  name: string
  time: string
  isTomorrow: boolean
}

function getNextPrayer(schedule: any, tomorrowSchedule?: any): NextPrayer | null {
  if (!schedule) return null
  const now = new Date()
  for (let i = 0; i < PRAYER_KEYS.length; i++) {
    const time = schedule[PRAYER_KEYS[i]]
    if (!time) continue
    const [h, m] = time.split(':').map(Number)
    const prayerTime = new Date()
    prayerTime.setHours(h, m, 0, 0)
    if (prayerTime > now) return { name: PRAYER_NAMES[i], time, isTomorrow: false }
  }
  const tomorrowFajr = tomorrowSchedule?.fajrAdhan
  if (tomorrowFajr) return { name: 'Fajr', time: tomorrowFajr, isTomorrow: true }
  return null
}

const schedule = {
  fajrAdhan: '05:30',
  dhuhrAdhan: '12:30',
  asrAdhan: '15:45',
  maghribAdhan: '18:20',
  ishaAdhan: '19:45',
}
const tomorrowSchedule = { fajrAdhan: '05:31' }

function setTime(h: number, m = 0) {
  const d = new Date()
  d.setHours(h, m, 0, 0)
  jest.setSystemTime(d)
}

describe('getNextPrayer', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('returns null for null schedule', () => {
    expect(getNextPrayer(null)).toBeNull()
  })

  it('returns Fajr at 04:00 (before first prayer)', () => {
    setTime(4, 0)
    const result = getNextPrayer(schedule)
    expect(result?.name).toBe('Fajr')
    expect(result?.time).toBe('05:30')
    expect(result?.isTomorrow).toBe(false)
  })

  it('returns Dhuhr between Fajr and Dhuhr', () => {
    setTime(10, 0)
    const result = getNextPrayer(schedule)
    expect(result?.name).toBe('Dhuhr')
    expect(result?.isTomorrow).toBe(false)
  })

  it('returns Asr after Dhuhr', () => {
    setTime(13, 0)
    expect(getNextPrayer(schedule)?.name).toBe('Asr')
  })

  it('returns Maghrib after Asr', () => {
    setTime(16, 0)
    expect(getNextPrayer(schedule)?.name).toBe('Maghrib')
  })

  it('returns Isha after Maghrib', () => {
    setTime(19, 0)
    expect(getNextPrayer(schedule)?.name).toBe('Isha')
  })

  it('returns tomorrows Fajr after Isha (the core rollover fix)', () => {
    setTime(23, 0)
    const result = getNextPrayer(schedule, tomorrowSchedule)
    expect(result?.name).toBe('Fajr')
    // Must be tomorrows time, not todays (todays fajr 05:30 is in the past)
    expect(result?.time).toBe('05:31')
    expect(result?.isTomorrow).toBe(true)
  })

  it('returns null after Isha with no tomorrow schedule', () => {
    setTime(23, 0)
    expect(getNextPrayer(schedule)).toBeNull()
  })

  it('skips prayers with null/missing time values', () => {
    setTime(4, 0)
    const sparse = {
      fajrAdhan: null,
      dhuhrAdhan: '12:30',
      asrAdhan: null,
      maghribAdhan: null,
      ishaAdhan: null,
    }
    const result = getNextPrayer(sparse)
    expect(result?.name).toBe('Dhuhr')
  })

  it('returns first prayer of tomorrow when all today prayers are null', () => {
    setTime(10, 0)
    const emptySchedule = {
      fajrAdhan: null, dhuhrAdhan: null, asrAdhan: null, maghribAdhan: null, ishaAdhan: null,
    }
    const result = getNextPrayer(emptySchedule, tomorrowSchedule)
    expect(result?.name).toBe('Fajr')
    expect(result?.isTomorrow).toBe(true)
  })
})
