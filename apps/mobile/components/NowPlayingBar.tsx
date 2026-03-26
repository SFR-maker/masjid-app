import { View, Text, TouchableOpacity, Pressable, Platform, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { usePathname, useSegments, router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuranAudioStore } from '../lib/quranAudioStore'
import { stopQuranAudio, pauseQuranAudio, resumeQuranAudio, nextQuranAyah, prevQuranAyah } from '../lib/quranAudio'
import { useTheme } from '../contexts/ThemeContext'

const TAB_HEIGHT = Platform.OS === 'ios' ? 49 : 56

export default function NowPlayingBar() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
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
  // Float the card 8px above the tab bar (or above bottom edge on non-tab screens)
  const bottomOffset = isTabScreen
    ? TAB_HEIGHT + insets.bottom + 8
    : insets.bottom + 8

  const ayahLabel = playingAyah === 0 ? 'Bismillah' : `Ayah ${playingAyah}`

  return (
    <Pressable
      onPress={() => router.push('/quran' as any)}
      style={[styles.container, { bottom: bottomOffset }]}
    >
      {/* Icon */}
      <View style={[styles.iconBox, { backgroundColor: colors.primary }]}>
        <Ionicons
          name={isPaused ? 'play' : 'musical-notes'}
          size={18}
          color="#fff"
        />
      </View>

      {/* Text */}
      <View style={styles.textBlock}>
        <Text style={styles.title} numberOfLines={1}>
          {surahName}
          {isPaused ? <Text style={styles.pausedBadge}> · Paused</Text> : null}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {ayahLabel} · {reciterName}
        </Text>
      </View>

      {/* Prev */}
      <TouchableOpacity
        onPress={(e) => { e.stopPropagation(); prevQuranAyah() }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={styles.btn}
      >
        <Ionicons name="play-skip-back" size={18} color="rgba(255,255,255,0.75)" />
      </TouchableOpacity>

      {/* Play / Pause */}
      <TouchableOpacity
        onPress={(e) => { e.stopPropagation(); isPaused ? resumeQuranAudio() : pauseQuranAudio() }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={styles.btn}
      >
        <Ionicons
          name={isPaused ? 'play-circle' : 'pause-circle'}
          size={30}
          color={colors.primary}
        />
      </TouchableOpacity>

      {/* Next */}
      <TouchableOpacity
        onPress={(e) => { e.stopPropagation(); nextQuranAyah() }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={styles.btn}
      >
        <Ionicons name="play-skip-forward" size={18} color="rgba(255,255,255,0.75)" />
      </TouchableOpacity>

      {/* Close */}
      <TouchableOpacity
        onPress={(e) => { e.stopPropagation(); stopQuranAudio() }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={[styles.btn, { marginLeft: 2 }]}
      >
        <Ionicons name="close" size={16} color="rgba(255,255,255,0.4)" />
      </TouchableOpacity>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    borderRadius: 18,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 12,
    zIndex: 999,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  pausedBadge: {
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '500',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    marginTop: 2,
  },
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
})
