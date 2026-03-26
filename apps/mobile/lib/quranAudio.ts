import { Audio } from 'expo-av'
import { useQuranAudioStore } from './quranAudioStore'

let _sound: Audio.Sound | null = null
let _preloaded: Audio.Sound | null = null
let _preloadedIndex = -1
let _ayahs: any[] = []
let _isPlaying = false
let _isPaused = false
let _session = 0   // incremented on every new start/stop — invalidates stale async chains
let _surahNumber = 0  // current surah, used to decide whether to play Bismillah

export function setAyahsForPlayback(ayahs: any[]) {
  _ayahs = ayahs
}

export function setSurahNumber(n: number) {
  _surahNumber = n
}

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

async function _clearSounds() {
  if (_sound) {
    try { await _sound.stopAsync(); await _sound.unloadAsync() } catch {}
    _sound = null
  }
  if (_preloaded) {
    try { await _preloaded.unloadAsync() } catch {}
    _preloaded = null
    _preloadedIndex = -1
  }
}

export async function stopQuranAudio() {
  _session++
  _isPlaying = false
  _isPaused = false
  const { setIsPlaying, setIsPaused, setPlayingAyah } = useQuranAudioStore.getState()
  setIsPlaying(false)
  setIsPaused(false)
  setPlayingAyah(null)
  await _clearSounds()
}

export async function pauseQuranAudio() {
  if (!_isPlaying || _isPaused) return
  _session++
  _isPaused = true
  _isPlaying = false
  const { setIsPlaying, setIsPaused } = useQuranAudioStore.getState()
  setIsPlaying(false)
  setIsPaused(true)
  if (_sound) {
    try { await _sound.pauseAsync() } catch {}
  }
}

export async function resumeQuranAudio() {
  if (!_isPaused || !_sound) return
  _isPaused = false
  _isPlaying = true
  _session++
  const mySession = _session
  const { setIsPlaying, setIsPaused } = useQuranAudioStore.getState()
  setIsPlaying(true)
  setIsPaused(false)
  try {
    await _sound.playAsync()
    // re-attach status listener so auto-advance continues after resume
    const resumedSound = _sound
    // find which index we're at from the store
    const currentAyah = useQuranAudioStore.getState().playingAyah
    const currentIndex = _ayahs.findIndex(a => a.numberInSurah === currentAyah)
    resumedSound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) return
      if (status.didJustFinish) {
        resumedSound.unloadAsync().catch(() => {})
        if (_sound === resumedSound) _sound = null
        if (_isPlaying && _session === mySession) {
          _playChain(currentIndex + 1, mySession)
        }
      }
    })
  } catch {}
}

async function _preloadNext(index: number, session: number) {
  if (!_isPlaying || _session !== session) return
  let nextIdx = index
  while (nextIdx < _ayahs.length && !_ayahs[nextIdx]?.audio) nextIdx++
  if (nextIdx >= _ayahs.length) return
  if (_preloadedIndex === nextIdx) return

  if (_preloaded) {
    try { await _preloaded.unloadAsync() } catch {}
    _preloaded = null
    _preloadedIndex = -1
  }

  try {
    const { sound } = await Audio.Sound.createAsync(
      { uri: _ayahs[nextIdx].audio },
      { shouldPlay: false },
    )
    if (!_isPlaying || _session !== session) {
      sound.unloadAsync().catch(() => {})
      return
    }
    _preloaded = sound
    _preloadedIndex = nextIdx
  } catch {}
}

async function _playBismillahThenChain(bismillahUrl: string, session: number) {
  if (_session !== session || !_isPlaying) return
  // 0 = Bismillah sentinel — highlights the banner in the UI
  useQuranAudioStore.getState().setPlayingAyah(0)
  try {
    const { sound } = await Audio.Sound.createAsync({ uri: bismillahUrl }, { shouldPlay: true })
    if (_session !== session) { sound.unloadAsync().catch(() => {}); return }
    const prev = _sound
    _sound = sound
    if (prev) prev.unloadAsync().catch(() => {})
    // Preload first real ayah while Bismillah plays
    _preloadNext(0, session)
    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) return
      if (status.didJustFinish) {
        sound.unloadAsync().catch(() => {})
        if (_sound === sound) _sound = null
        if (_isPlaying && _session === session) _playChain(0, session)
      }
    })
  } catch {
    if (_isPlaying && _session === session) _playChain(0, session)
  }
}

async function _playChain(index: number, session: number) {
  // Stale session — another start/stop/pause superseded this chain
  if (_session !== session) return

  if (index >= _ayahs.length || !_isPlaying) {
    if (_session === session) {
      _isPlaying = false
      _isPaused = false
      useQuranAudioStore.getState().setIsPlaying(false)
      useQuranAudioStore.getState().setPlayingAyah(null)
    }
    return
  }

  const ayah = _ayahs[index]
  if (!ayah?.audio) {
    _playChain(index + 1, session)
    return
  }

  const store = useQuranAudioStore.getState()
  store.setPlayingAyah(ayah.numberInSurah)

  try {
    let sound: Audio.Sound

    if (_preloaded && _preloadedIndex === index) {
      sound = _preloaded
      _preloaded = null
      _preloadedIndex = -1
      await sound.playAsync()
    } else {
      if (_preloaded) {
        try { await _preloaded.unloadAsync() } catch {}
        _preloaded = null
        _preloadedIndex = -1
      }
      const result = await Audio.Sound.createAsync(
        { uri: ayah.audio },
        { shouldPlay: true },
      )
      sound = result.sound
    }

    // Guard: session may have changed while we were awaiting createAsync
    if (_session !== session) {
      sound.unloadAsync().catch(() => {})
      return
    }

    const prev = _sound
    _sound = sound
    if (prev) prev.unloadAsync().catch(() => {})

    _preloadNext(index + 1, session)

    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) return
      if (status.didJustFinish) {
        sound.unloadAsync().catch(() => {})
        if (_sound === sound) _sound = null
        if (_isPlaying && _session === session) _playChain(index + 1, session)
      }
    })
  } catch {
    if (_isPlaying && _session === session) _playChain(index + 1, session)
  }
}

export async function startQuranPlaybackFromIndex(index: number) {
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    allowsRecordingIOS: false,
  })
  if (_sound) {
    try { await _sound.stopAsync(); await _sound.unloadAsync() } catch {}
    _sound = null
  }
  _session++
  const mySession = _session
  _isPlaying = true
  _isPaused = false
  const store = useQuranAudioStore.getState()
  store.setIsPlaying(true)
  store.setIsPaused(false)
  // Play Bismillah only when starting from the very beginning (index 0)
  const bismillahUrl = index === 0 && _surahNumber !== 1 && _surahNumber !== 9
    ? _getBismillahUrl()
    : null
  if (bismillahUrl) {
    _playBismillahThenChain(bismillahUrl, mySession)
  } else {
    _playChain(index, mySession)
  }
}

export async function startQuranPlayback() {
  if (!_ayahs.length) return
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    allowsRecordingIOS: false,
  })
  if (_sound) {
    try { await _sound.stopAsync(); await _sound.unloadAsync() } catch {}
    _sound = null
  }
  _session++
  const mySession = _session
  _isPlaying = true
  _isPaused = false
  useQuranAudioStore.getState().setIsPlaying(true)
  useQuranAudioStore.getState().setIsPaused(false)

  // Play Bismillah first for all surahs except Al-Fatiha (1) and At-Tawba (9)
  const bismillahUrl = _surahNumber !== 1 && _surahNumber !== 9 ? _getBismillahUrl() : null
  if (bismillahUrl) {
    _playBismillahThenChain(bismillahUrl, mySession)
  } else {
    _playChain(0, mySession)
  }
}
