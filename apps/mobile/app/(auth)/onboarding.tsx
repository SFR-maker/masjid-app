import { useState } from 'react'
import { View, Text, Pressable, FlatList, StyleSheet, Dimensions } from 'react-native'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'

const { width } = Dimensions.get('window')

const SLIDES = [
  {
    id: '1',
    emoji: '🕌',
    title: 'Discover Mosques',
    body: 'Find mosques near you, browse prayer times, and connect with the Islamic community in your area.',
    gradient: ['#14532d', '#166534'] as [string, string],
  },
  {
    id: '2',
    emoji: '🔔',
    title: 'Stay Connected',
    body: 'Get instant push notifications for announcements, events, and prayer time reminders from mosques you follow.',
    gradient: ['#1e3a5f', '#1e40af'] as [string, string],
  },
  {
    id: '3',
    emoji: '🤲',
    title: 'Grow Your Deen',
    body: 'Watch Islamic lectures, RSVP to community events, and ask questions with our AI Islamic knowledge assistant.',
    gradient: ['#4a1d4b', '#7e22ce'] as [string, string],
  },
]

export default function OnboardingScreen() {
  const router = useRouter()
  const [index, setIndex] = useState(0)

  const slide = SLIDES[index]
  const isLast = index === SLIDES.length - 1

  function next() {
    if (isLast) {
      router.replace('/(auth)/sign-in')
    } else {
      setIndex((i) => i + 1)
    }
  }

  return (
    <LinearGradient colors={slide.gradient} style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>{slide.emoji}</Text>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>
      </View>

      {/* Dots */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === index && styles.dotActive]}
          />
        ))}
      </View>

      <View style={styles.buttons}>
        <Pressable style={styles.primaryBtn} onPress={next}>
          <Text style={styles.primaryBtnText}>{isLast ? 'Get Started' : 'Next'}</Text>
        </Pressable>
        {!isLast && (
          <Pressable onPress={() => router.replace('/(auth)/sign-in')} style={styles.skipBtn}>
            <Text style={styles.skipBtnText}>Skip</Text>
          </Pressable>
        )}
      </View>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 32, paddingTop: 80, paddingBottom: 48 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emoji: { fontSize: 72, marginBottom: 32 },
  title: { fontSize: 28, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 16 },
  body: { fontSize: 16, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 24 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 32 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { width: 24, backgroundColor: '#fff' },
  buttons: { gap: 12 },
  primaryBtn: { backgroundColor: '#fff', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { fontSize: 16, fontWeight: '600', color: '#14532d' },
  skipBtn: { alignItems: 'center', paddingVertical: 12 },
  skipBtnText: { color: 'rgba(255,255,255,0.7)', fontSize: 15 },
})
