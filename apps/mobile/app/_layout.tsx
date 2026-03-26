import { useEffect, Component, ReactNode } from 'react'
import { setupAdhanChannel } from '../hooks/useAdhanScheduler'
import { View, ActivityIndicator, Text, ScrollView } from 'react-native'
import { Stack } from 'expo-router'
import NowPlayingBar from '../components/NowPlayingBar'
import { ClerkProvider, useAuth } from '@clerk/clerk-expo'
import { useApiTokenSync } from '../lib/api'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as SecureStore from 'expo-secure-store'
import * as SplashScreen from 'expo-splash-screen'
import { Platform } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ThemeProvider } from '../contexts/ThemeContext'
import { LanguageProvider } from '../contexts/LanguageContext'
import { useFonts } from 'expo-font'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import '../lib/i18n'
import '../global.css'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <ScrollView style={{ flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 60 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: 'red', marginBottom: 12 }}>App Error</Text>
          <Text style={{ fontFamily: 'monospace', fontSize: 12, color: '#333' }}>
            {(this.state.error as Error).message}{'\n\n'}{(this.state.error as Error).stack}
          </Text>
        </ScrollView>
      )
    }
    return this.props.children
  }
}

if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync()
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 2, retry: 2 },
  },
})

const tokenCache = Platform.OS === 'web'
  ? {
      async getToken(key: string) { return localStorage.getItem(key) },
      async saveToken(key: string, value: string) { localStorage.setItem(key, value) },
      async clearToken(key: string) { localStorage.removeItem(key) },
    }
  : {
      async getToken(key: string) { return SecureStore.getItemAsync(key) },
      async saveToken(key: string, value: string) { return SecureStore.setItemAsync(key, value) },
      async clearToken(key: string) { return SecureStore.deleteItemAsync(key) },
    }

export default function RootLayout() {
  return (
    <ErrorBoundary>
    <ThemeProvider>
    <LanguageProvider>
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      tokenCache={tokenCache}
    >
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <StatusBar style="auto" />
            <RootNavigator />
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ClerkProvider>
    </LanguageProvider>
    </ThemeProvider>
    </ErrorBoundary>
  )
}

function RootNavigator() {
  useApiTokenSync()
  const { isLoaded } = useAuth()
  const [fontsLoaded] = useFonts({ ...Ionicons.font })
  // Bug 9 fix: re-key the entire navigator on language change so all screens re-render
  const { i18n } = useTranslation()

  useEffect(() => {
    if (isLoaded && fontsLoaded && Platform.OS !== 'web') SplashScreen.hideAsync()
  }, [isLoaded, fontsLoaded])

  useEffect(() => {
    setupAdhanChannel().catch(console.warn)
  }, [])

  if (!isLoaded || !fontsLoaded) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#14532d" />
    </View>
  )

  return (
    <>
      {/* Bug 9 fix: key forces full remount of all screens when language changes */}
      <Stack key={i18n.language} screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="mosque/[id]" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="event/[id]" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="video/[id]" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="chat" options={{ presentation: 'modal' }} />
        <Stack.Screen name="messages" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="rsvps" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="privacy" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="help" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="notification-settings" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="qibla" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="athkar" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="announcement/[id]" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="quran" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="language" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="account-settings" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="poll/[id]" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="join-group/[token]" options={{ presentation: 'card', headerShown: false }} />
      </Stack>
      <NowPlayingBar />
    </>
  )
}
