import { create } from 'zustand'

interface QuranAudioState {
  isPlaying: boolean
  isPaused: boolean
  playingAyah: number | null
  surahName: string
  reciterName: string
  // Persisted so the screen can restore itself when navigating back
  playingSurahNumber: number | null
  playingReciterId: string
  playingTranslationId: string
  setIsPlaying: (v: boolean) => void
  setIsPaused: (v: boolean) => void
  setPlayingAyah: (v: number | null) => void
  setSurahInfo: (surahName: string, reciterName: string) => void
  setPlayingLocation: (surahNumber: number, reciterId: string, translationId: string) => void
}

export const useQuranAudioStore = create<QuranAudioState>((set) => ({
  isPlaying: false,
  isPaused: false,
  playingAyah: null,
  surahName: '',
  reciterName: '',
  playingSurahNumber: null,
  playingReciterId: '',
  playingTranslationId: '',
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setIsPaused: (isPaused) => set({ isPaused }),
  setPlayingAyah: (playingAyah) => set({ playingAyah }),
  setSurahInfo: (surahName, reciterName) => set({ surahName, reciterName }),
  setPlayingLocation: (playingSurahNumber, playingReciterId, playingTranslationId) =>
    set({ playingSurahNumber, playingReciterId, playingTranslationId }),
}))
