import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { I18nManager } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Updates from 'expo-updates'
import i18n, { LANGUAGE_KEY, RTL_LANGUAGES, loadStoredLanguage } from '../lib/i18n'

interface LanguageContextValue {
  language: string
  setLanguage: (code: string) => Promise<void>
  isRTL: boolean
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  setLanguage: async () => {},
  isRTL: false,
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState(i18n.language || 'en')

  useEffect(() => {
    loadStoredLanguage().then(() => {
      setLanguageState(i18n.language)
    })
  }, [])

  async function setLanguage(code: string) {
    await AsyncStorage.setItem(LANGUAGE_KEY, code)
    await i18n.changeLanguage(code)
    setLanguageState(code)

    const shouldBeRTL = RTL_LANGUAGES.includes(code)
    if (I18nManager.isRTL !== shouldBeRTL) {
      I18nManager.forceRTL(shouldBeRTL)
      // Reload the JS bundle so layout direction applies consistently everywhere
      if (!__DEV__) {
        await Updates.reloadAsync()
      }
    }
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, isRTL: RTL_LANGUAGES.includes(language) }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
