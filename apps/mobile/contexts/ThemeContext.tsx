import { createContext, useContext, useEffect, useState } from 'react'
import { useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

const THEME_KEY = 'app_theme'

export type ThemeMode = 'system' | 'light' | 'dark'

export interface ColorPalette {
  background: string
  surface: string
  surfaceSecondary: string
  border: string
  borderLight: string
  text: string
  textSecondary: string
  textTertiary: string
  tabBar: string
  tabBarBorder: string
  primary: string
  primaryLight: string
  primaryContrast: string
  inputBackground: string
  isDark: boolean
}

const LIGHT: ColorPalette = {
  background: '#F9FAFB',
  surface: '#FFFFFF',
  surfaceSecondary: '#F3F4F6',
  border: '#E5E7EB',
  borderLight: '#F0F0F0',
  text: '#1A1A1A',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  tabBar: '#FFFFFF',
  tabBarBorder: '#F3F4F6',
  primary: '#16A34A',
  primaryLight: '#DCFCE7',
  primaryContrast: '#FFFFFF',
  inputBackground: '#F9FAFB',
  isDark: false,
}

const DARK: ColorPalette = {
  background: '#0F172A',
  surface: '#1E293B',
  surfaceSecondary: '#0F172A',
  border: '#334155',
  borderLight: '#1E293B',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  textTertiary: '#64748B',
  tabBar: '#1E293B',
  tabBarBorder: '#0F172A',
  primary: '#4ADE80',
  primaryLight: '#14532D',
  primaryContrast: '#0F172A',
  inputBackground: '#1E293B',
  isDark: true,
}

interface ThemeContextValue {
  colors: ColorPalette
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: LIGHT,
  mode: 'system',
  setMode: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme()
  const [mode, setModeState] = useState<ThemeMode>('system')

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY)
      .then(saved => {
        if (saved === 'light' || saved === 'dark' || saved === 'system') setModeState(saved)
      })
      .catch(() => {/* defaults to 'system' */})
  }, [])

  function setMode(newMode: ThemeMode) {
    setModeState(newMode)
    AsyncStorage.setItem(THEME_KEY, newMode).catch(() => {/* best-effort */})
  }

  const resolvedDark =
    mode === 'dark' || (mode === 'system' && systemScheme === 'dark')

  return (
    <ThemeContext.Provider value={{ colors: resolvedDark ? DARK : LIGHT, mode, setMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
