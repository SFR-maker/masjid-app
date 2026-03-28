import { useState } from 'react'
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-expo'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../contexts/ThemeContext'
import { api } from '../lib/api'

const JUZ_NAMES: Record<number, string> = {
  1:'Al-Fatiha – Al-Baqara 141', 2:'Al-Baqara 142–252', 3:'Al-Baqara 253 – Al-Imran 92',
  4:'Al-Imran 93 – An-Nisa 23', 5:'An-Nisa 24–147', 6:'An-Nisa 148 – Al-Maida 81',
  7:'Al-Maida 82 – Al-Anam 110', 8:'Al-Anam 111 – Al-Araf 87', 9:'Al-Araf 88 – Al-Anfal 40',
  10:'Al-Anfal 41 – At-Tawba 92', 11:'At-Tawba 93 – Hud 5', 12:'Hud 6 – Yusuf 52',
  13:'Yusuf 53 – Ibrahim 52', 14:'Al-Hijr – An-Nahl 128', 15:'Al-Isra – Al-Kahf 74',
  16:'Al-Kahf 75 – Ta-Ha 135', 17:'Al-Anbiya – Al-Hajj 78', 18:'Al-Muminun – Al-Furqan 20',
  19:'Al-Furqan 21 – An-Naml 55', 20:'An-Naml 56 – Al-Ankabut 45', 21:'Al-Ankabut 46 – Al-Ahzab 30',
  22:'Al-Ahzab 31 – Ya-Sin 27', 23:'Ya-Sin 28 – Az-Zumar 31', 24:'Az-Zumar 32 – Fussilat 46',
  25:'Fussilat 47 – Al-Jathiya 37', 26:'Al-Ahqaf – Adh-Dhariyat 30', 27:'Adh-Dhariyat 31 – Al-Hadid 29',
  28:'Al-Mujadila – At-Tahrim', 29:'Al-Mulk – Al-Mursalat', 30:'An-Naba – An-Nas',
}

export function ReadingPlanWidget() {
  const { colors } = useTheme()
  const { isSignedIn } = useAuth()
  const queryClient = useQueryClient()
  const [showSetup, setShowSetup] = useState(false)
  const [showManage, setShowManage] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['reading-plan'],
    queryFn: () => api.get<any>('/reading-plan'),
    enabled: !!isSignedIn,
    staleTime: 1000 * 60 * 5,
  })

  const createPlan = useMutation({
    mutationFn: (type: 'MONTHLY' | 'YEARLY') => api.post('/reading-plan', { type }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reading-plan'] })
      setShowSetup(false)
    },
  })

  const markJuz = useMutation({
    mutationFn: (juz: number) => api.patch('/reading-plan/progress', { juz }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reading-plan'] }),
  })

  const deletePlan = useMutation({
    mutationFn: () => api.delete('/reading-plan'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reading-plan'] })
      setShowManage(false)
    },
  })

  const resetPlan = useMutation({
    mutationFn: () => api.patch('/reading-plan/reset', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reading-plan'] })
      setShowManage(false)
    },
  })

  if (!isSignedIn || isLoading) return null

  const plan = data?.data

  // No plan — show start button
  if (!plan) {
    return (
      <>
        <TouchableOpacity
          onPress={() => setShowSetup(true)}
          style={[styles.card, { backgroundColor: colors.primaryLight, borderColor: `${colors.primary}30` }]}
        >
          <Text style={{ fontSize: 20 }}>📖</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>Start a Reading Plan</Text>
            <Text style={{ color: colors.primary, fontSize: 12, opacity: 0.7, marginTop: 1 }}>30-day or 1-year Quran completion goal</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </TouchableOpacity>

        <Modal visible={showSetup} transparent animationType="slide" statusBarTranslucent>
          <View style={styles.overlay}>
            <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Choose a Reading Plan</Text>

              <TouchableOpacity
                onPress={() => createPlan.mutate('MONTHLY')}
                style={[styles.planOption, { backgroundColor: colors.primary }]}
              >
                <Text style={{ fontSize: 28 }}>⚡</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.primaryContrast, fontWeight: '800', fontSize: 16 }}>30-Day Plan</Text>
                  <Text style={{ color: colors.primaryContrast, opacity: 0.8, fontSize: 13, marginTop: 2 }}>1 Juz per day — complete in a month</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => createPlan.mutate('YEARLY')}
                style={[styles.planOption, { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.primary }]}
              >
                <Text style={{ fontSize: 28 }}>🌱</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 16 }}>1-Year Plan</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>~3 pages/day — gentle and sustainable</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setShowSetup(false)} style={{ alignItems: 'center', paddingVertical: 14 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </>
    )
  }

  const completedCount = plan.completedJuzs?.length ?? 0
  const completedSet: number[] = plan.completedJuzs ?? []
  // Find the next juz the user hasn't completed yet (fixes stuck state)
  const nextIncomplete = (() => {
    for (let j = (plan.currentJuz ?? 1); j <= 30; j++) {
      if (!completedSet.includes(j)) return j
    }
    // All from currentJuz onward are done — scan from 1
    for (let j = 1; j <= 30; j++) {
      if (!completedSet.includes(j)) return j
    }
    return null
  })()
  const currentJuz = nextIncomplete ?? (plan.currentJuz ?? 1)
  const progress = completedCount / 30

  if (plan.isCompleted) {
    return (
      <View style={[styles.card, { backgroundColor: '#D1FAE5', borderColor: '#6EE7B7' }]}>
        <Text style={{ fontSize: 22 }}>🎉</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#065F46', fontWeight: '800', fontSize: 14 }}>Quran Complete!</Text>
          <Text style={{ color: '#059669', fontSize: 12, marginTop: 1 }}>Alhamdulillah — you've completed the full Quran</Text>
        </View>
      </View>
    )
  }

  return (
    <>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, flexDirection: 'column', gap: 10 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 20 }}>📖</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>
              {plan.type === 'MONTHLY' ? '30-Day Plan' : '1-Year Plan'} · Juz {currentJuz}/30
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 1 }} numberOfLines={1}>
              {JUZ_NAMES[currentJuz] ?? `Juz ${currentJuz}`}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setShowManage(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Progress bar */}
        <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surfaceSecondary, overflow: 'hidden' }}>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.primary, width: `${progress * 100}%` }} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: colors.textTertiary, fontSize: 11 }}>{completedCount}/30 juz complete</Text>
        </View>

        {/* Mark current juz done — always shown while plan is active (nextIncomplete ensures it's never already done) */}
        {nextIncomplete !== null && (
          <TouchableOpacity
            onPress={() => markJuz.mutate(currentJuz)}
            disabled={markJuz.isPending}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
              backgroundColor: colors.primaryLight, borderRadius: 10, paddingVertical: 9,
            }}
          >
            <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>
              {markJuz.isPending ? 'Saving...' : `Mark Juz ${currentJuz} as Complete`}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Manage plan modal */}
      <Modal visible={showManage} transparent animationType="slide" statusBarTranslucent>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Manage Reading Plan</Text>

            <TouchableOpacity
              onPress={() => { setShowManage(false); setShowSetup(true) }}
              style={[styles.planOption, { backgroundColor: colors.primaryLight, borderWidth: 1.5, borderColor: colors.primary }]}
            >
              <Text style={{ fontSize: 24 }}>🔄</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 15 }}>Change Goal</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>Switch between 30-day and 1-year plan</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => resetPlan.mutate()}
              disabled={resetPlan.isPending}
              style={[styles.planOption, { backgroundColor: '#FFF7ED', borderWidth: 1.5, borderColor: '#FED7AA' }]}
            >
              <Text style={{ fontSize: 24 }}>↩️</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#C2410C', fontWeight: '700', fontSize: 15 }}>
                  {resetPlan.isPending ? 'Resetting...' : 'Reset Progress'}
                </Text>
                <Text style={{ color: '#EA580C', fontSize: 12, marginTop: 2 }}>Start over from Juz 1</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => deletePlan.mutate()}
              disabled={deletePlan.isPending}
              style={[styles.planOption, { backgroundColor: '#FEF2F2', borderWidth: 1.5, borderColor: '#FECACA' }]}
            >
              <Text style={{ fontSize: 24 }}>🗑️</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 15 }}>
                  {deletePlan.isPending ? 'Deleting...' : 'Delete Plan'}
                </Text>
                <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 2 }}>Remove your current reading goal</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowManage(false)} style={{ alignItems: 'center', paddingVertical: 14 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Re-use setup modal for changing plan */}
      <Modal visible={showSetup} transparent animationType="slide" statusBarTranslucent>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Choose a Reading Plan</Text>
            <TouchableOpacity
              onPress={() => createPlan.mutate('MONTHLY')}
              style={[styles.planOption, { backgroundColor: colors.primary }]}
            >
              <Text style={{ fontSize: 28 }}>⚡</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.primaryContrast, fontWeight: '800', fontSize: 16 }}>30-Day Plan</Text>
                <Text style={{ color: colors.primaryContrast, opacity: 0.8, fontSize: 13, marginTop: 2 }}>1 Juz per day — complete in a month</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => createPlan.mutate('YEARLY')}
              style={[styles.planOption, { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.primary }]}
            >
              <Text style={{ fontSize: 28 }}>🌱</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 16 }}>1-Year Plan</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>~3 pages/day — gentle and sustainable</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowSetup(false)} style={{ alignItems: 'center', paddingVertical: 14 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 44,
    gap: 12,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  planOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    padding: 16,
  },
})
