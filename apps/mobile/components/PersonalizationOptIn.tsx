import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../contexts/ThemeContext'

const OPT_IN_KEY = 'video_personalization_v1'

export type PersonalizationState = 'unknown' | 'accepted' | 'declined'

export function usePersonalizationState() {
  const [state, setState] = useState<PersonalizationState>('unknown')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    AsyncStorage.getItem(OPT_IN_KEY).then((val) => {
      if (val === 'accepted') setState('accepted')
      else if (val === 'declined') setState('declined')
      else setState('unknown')
      setLoading(false)
    })
  }, [])

  const accept = async () => {
    await AsyncStorage.setItem(OPT_IN_KEY, 'accepted')
    setState('accepted')
  }

  const decline = async () => {
    await AsyncStorage.setItem(OPT_IN_KEY, 'declined')
    setState('declined')
  }

  return { state, loading, accept, decline }
}

interface Props {
  visible: boolean
  onAccept: () => void
  onDecline: () => void
}

export function PersonalizationOptInModal({ visible, onAccept, onDecline }: Props) {
  const { colors } = useTheme()

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          {/* Icon */}
          <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
            <Text style={{ fontSize: 36 }}>✨</Text>
          </View>

          <Text style={[styles.title, { color: colors.text }]}>
            Personalize Your Feed?
          </Text>

          <Text style={[styles.body, { color: colors.textSecondary }]}>
            Allow the app to use your watch history to suggest videos you'll love — lectures, Quran recitations, and more tailored to your interests.
          </Text>

          <View style={styles.bullets}>
            {[
              'Only used within this app',
              'Never shared with third parties',
              'You can change this anytime in Settings',
            ].map((line) => (
              <View key={line} style={styles.bulletRow}>
                <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{line}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            onPress={onAccept}
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.primaryBtnText, { color: colors.primaryContrast }]}>
              Yes, personalize my feed
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onDecline} style={styles.secondaryBtn}>
            <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>
              No thanks, show all videos
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  card: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingBottom: 44,
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  bullets: {
    width: '100%',
    gap: 8,
    marginTop: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bulletText: {
    fontSize: 13,
    flex: 1,
  },
  primaryBtn: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: {
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: -0.2,
  },
  secondaryBtn: {
    paddingVertical: 8,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '500',
  },
})
