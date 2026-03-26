import { View, Text, TouchableOpacity, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { usePathname, useSegments, router } from 'expo-router'
import { useQuranAudioStore } from '../lib/quranAudioStore'
import { stopQuranAudio, pauseQuranAudio, resumeQuranAudio } from '../lib/quranAudio'
import { useTheme } from '../contexts/ThemeContext'

const TAB_BAR_HEIGHT = 60

export default function NowPlayingBar() {
  const { colors } = useTheme()
  const isPlaying = useQuranAudioStore(s => s.isPlaying)
  const isPaused = useQuranAudioStore(s => s.isPaused)
  const playingAyah = useQuranAudioStore(s => s.playingAyah)
  const surahName = useQuranAudioStore(s => s.surahName)
  const reciterName = useQuranAudioStore(s => s.reciterName)

  const pathname = usePathname()
  const segments = useSegments()

  const isActive = (isPlaying || isPaused) && playingAyah !== null
  if (!isActive || pathname === '/quran') return null

  const isTabScreen = segments[0] === '(tabs)'
  const bottomOffset = isTabScreen ? TAB_BAR_HEIGHT : 0

  return (
    <Pressable
      onPress={() => router.push('/quran' as any)}
      style={{
        position: 'absolute',
        bottom: bottomOffset,
        left: 0,
        right: 0,
        backgroundColor: colors.primary,
        paddingHorizontal: 16,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        zIndex: 999,
      }}
    >
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={isPlaying ? 'musical-notes' : 'pause'} size={14} color={colors.primaryContrast} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.primaryContrast, fontWeight: '600', fontSize: 12 }} numberOfLines={1}>
          {surahName} · {playingAyah === 0 ? 'Bismillah' : `Ayah ${playingAyah}`}{isPaused ? ' · Paused' : ''}
        </Text>
        <Text style={{ color: colors.isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)', fontSize: 11 }} numberOfLines={1}>
          {reciterName}
        </Text>
      </View>

      {/* Play/pause toggle */}
      <TouchableOpacity
        onPress={() => isPaused ? resumeQuranAudio() : pauseQuranAudio()}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{ padding: 6 }}
      >
        <Ionicons
          name={isPaused ? 'play-circle' : 'pause-circle'}
          size={22}
          color={colors.isDark ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.85)'}
        />
      </TouchableOpacity>

      {/* Stop button */}
      <TouchableOpacity
        onPress={() => stopQuranAudio()}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{ padding: 6 }}
      >
        <Ionicons name="stop-circle" size={22} color={colors.isDark ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.85)'} />
      </TouchableOpacity>
    </Pressable>
  )
}
