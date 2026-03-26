import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface SelectedMosqueState {
  mosqueId: string | null
  mosqueName: string | null
  setSelectedMosque: (id: string, name: string) => void
  clearSelectedMosque: () => void
}

export const useSelectedMosque = create<SelectedMosqueState>()(
  persist(
    (set) => ({
      mosqueId: null,
      mosqueName: null,
      setSelectedMosque: (mosqueId, mosqueName) => set({ mosqueId, mosqueName }),
      clearSelectedMosque: () => set({ mosqueId: null, mosqueName: null }),
    }),
    {
      name: 'selected-mosque',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)
