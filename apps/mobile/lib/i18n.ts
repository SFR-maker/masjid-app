import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import AsyncStorage from '@react-native-async-storage/async-storage'

import en from '../locales/en.json'
import ar from '../locales/ar.json'
import id from '../locales/id.json'
import ur from '../locales/ur.json'
import bn from '../locales/bn.json'
import tr from '../locales/tr.json'
import fa from '../locales/fa.json'
import pa from '../locales/pa.json'
import hi from '../locales/hi.json'

export const LANGUAGE_KEY = '@app_language'
export const RTL_LANGUAGES = ['ar', 'ur', 'fa']

const resources = {
  en: { translation: en },
  ar: { translation: ar },
  id: { translation: id },
  ur: { translation: ur },
  bn: { translation: bn },
  tr: { translation: tr },
  fa: { translation: fa },
  pa: { translation: pa },
  hi: { translation: hi },
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  })

export async function loadStoredLanguage() {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_KEY)
    if (stored && resources[stored as keyof typeof resources]) {
      await i18n.changeLanguage(stored)
    }
  } catch {
    // ignore
  }
}

export default i18n
