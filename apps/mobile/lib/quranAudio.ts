import { Platform } from 'react-native'
import { useQuranAudioStore } from './quranAudioStore'

// RNTP is native-only — lazy-load to avoid web bundle errors
let TrackPlayer: any = null
if (Platform.OS !== 'web') {
  TrackPlayer = require('react-native-track-player').default
}

let _ayahs: any[] = []
let _surahNumber = 0

// Maps numberInSurah (or 'bismillah') → index in the current RNTP queue
const _numberToQueueIndex = new Map<number | string, number>()

// Derives the Bismillah audio URL from the loaded ayahs' URL pattern.
// All alquran.cloud audio URLs follow: {base}/{globalAyahNumber}.mp3
// Global ayah 1 = Surah 1, Ayah 1 = Bismillah.
function _getBismillahUrl(): string | null {
  const firstAudio = _ayahs.find(a => a?.audio)?.audio as string | undefined
  if (!firstAudio) return null
  const lastSlash = firstAudio.lastIndexOf('/')
  if (lastSlash < 0) return null
  return firstAudio.substring(0, lastSlash + 1) + '1.mp3'
}

function _buildTracks(includeBismillah: boolean): any[] {
  _numberToQueueIndex.clear()
  const { surahName, reciterName } = useQuranAudioStore.getState()
  const tracks: any[] = []
  let queueIdx = 0

  if (includeBismillah) {
    const url = _getBismillahUrl()
    if (url) {
      _numberToQueueIndex.set('bismillah', queueIdx++)
      tracks.push({
        id: 'bismillah',
        url,
        title: surahName ? `${surahName} — Bismillah` : 'Bismillah',
        artist: reciterName || 'Quran',
        album: surahName || 'Quran',
        artwork: require('../assets/icon.png'),
      })
    }
  }

  for (const ayah of _ayahs) {
    if (!ayah?.audio) continue
    _numberToQueueIndex.set(ayah.numberInSurah, queueIdx++)
    tracks.push({
      id: String(ayah.numberInSurah),
      url: ayah.audio,
      title: surahName ? `${surahName} — Ayah ${ayah.numberInSurah}` : `Ayah ${ayah.numberInSurah}`,
      artist: reciterName || 'Quran',
      album: surahName || 'Quran',
      artwork: require('../assets/icon.png'),
    })
  }

  return tracks
}

export function setAyahsForPlayback(ayahs: any[]) {
  _ayahs = ayahs
}

export function setSurahNumber(n: number) {
  _surahNumber = n
}

export async function stopQuranAudio() {
  if (Platform.OS === 'web' || !TrackPlayer) return
  const store = useQuranAudioStore.getState()
  store.setIsPlaying(false)
  store.setIsPaused(false)
  store.setPlayingAyah(null)
  try { await TrackPlayer.reset() } catch {}
}

export async function pauseQuranAudio() {
  if (Platform.OS === 'web' || !TrackPlayer) return
  const store = useQuranAudioStore.getState()
  if (!store.isPlaying) return
  store.setIsPlaying(false)
  store.setIsPaused(true)
  try { await TrackPlayer.pause() } catch {}
}

export async function resumeQuranAudio() {
  if (Platform.OS === 'web' || !TrackPlayer) return
  const store = useQuranAudioStore.getState()
  if (!store.isPaused) return
  store.setIsPlaying(true)
  store.setIsPaused(false)
  try { await TrackPlayer.play() } catch {}
}

export async function startQuranPlayback() {
  if (!_ayahs.length || Platform.OS === 'web' || !TrackPlayer) return
  const includeBismillah = _surahNumber !== 1 && _surahNumber !== 9
  const tracks = _buildTracks(includeBismillah)
  if (!tracks.length) return

  const store = useQuranAudioStore.getState()
  store.setIsPlaying(true)
  store.setIsPaused(false)
  try {
    await TrackPlayer.reset()
    await TrackPlayer.add(tracks)
    await TrackPlayer.play()
  } catch {}
}

export async function startQuranPlaybackFromIndex(index: number) {
  if (!_ayahs.length || Platform.OS === 'web' || !TrackPlayer) return
  const includeBismillah = index === 0 && _surahNumber !== 1 && _surahNumber !== 9
  const tracks = _buildTracks(includeBismillah)
  if (!tracks.length) return

  const store = useQuranAudioStore.getState()
  store.setIsPlaying(true)
  store.setIsPaused(false)
  try {
    await TrackPlayer.reset()
    await TrackPlayer.add(tracks)

    // Skip to the appropriate queue position when not starting from the top
    if (index > 0) {
      const ayah = _ayahs[index]
      if (ayah) {
        const qIdx = _numberToQueueIndex.get(ayah.numberInSurah)
        if (qIdx !== undefined && qIdx > 0) {
          await TrackPlayer.skip(qIdx)
        }
      }
    }

    await TrackPlayer.play()
  } catch {}
}

export async function toggleQuranPlayback() {
  const store = useQuranAudioStore.getState()
  if (store.isPlaying) {
    await pauseQuranAudio()
  } else if (store.isPaused) {
    await resumeQuranAudio()
  }
}

export async function nextQuranAyah() {
  if (Platform.OS === 'web' || !TrackPlayer) return
  try {
    await TrackPlayer.skipToNext()
    await TrackPlayer.play()
  } catch {}
}

export async function prevQuranAyah() {
  if (Platform.OS === 'web' || !TrackPlayer) return
  try {
    await TrackPlayer.skipToPrevious()
    await TrackPlayer.play()
  } catch {}
}
