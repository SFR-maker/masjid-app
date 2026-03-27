import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useTheme } from '../contexts/ThemeContext'

const ATHKAR = {
  Morning: [
    {
      arabic: 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ',
      english: 'We have entered the morning and with it all dominion belongs to Allah. All Praise is for Allah.',
      count: 1,
      reference: 'Abu Dawud 4/317',
    },
    {
      arabic: 'اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ وَإِلَيْكَ النُّشُورُ',
      english: 'O Allah, by You we enter the morning and by You we enter the evening, by You we live and by You we die, and to You is the Final Return.',
      count: 1,
      reference: 'Tirmidhi 3391',
    },
    {
      arabic: 'اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ',
      english: 'O Allah, You are my Lord, none has the right to be worshipped except You. You created me and I am Your servant.',
      count: 1,
      reference: 'Bukhari 7/150',
    },
    {
      arabic: 'سُبْحَانَ اللهِ وَبِحَمْدِهِ',
      english: 'Glory is to Allah and praise is to Him.',
      count: 100,
      reference: 'Muslim 4/2071',
    },
    {
      arabic: 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ',
      english: 'None has the right to be worshipped except Allah, alone, without partner. To Him belongs all praise and dominion.',
      count: 10,
      reference: 'Bukhari 7/167',
    },
    {
      arabic: 'اللَّهُمَّ عَافِنِي فِي بَدَنِي، اللَّهُمَّ عَافِنِي فِي سَمْعِي، اللَّهُمَّ عَافِنِي فِي بَصَرِي',
      english: 'O Allah, grant my body health. O Allah, grant my hearing health. O Allah, grant my sight health.',
      count: 3,
      reference: 'Abu Dawud 4/324',
    },
  ],
  Night: [
    {
      arabic: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا',
      english: 'In Your Name O Allah, I die and I live.',
      count: 1,
      reference: 'Bukhari 11/126',
    },
    {
      arabic: 'اللَّهُمَّ قِنِي عَذَابَكَ يَوْمَ تَبْعَثُ عِبَادَكَ',
      english: 'O Allah, protect me from Your punishment on the Day You resurrect Your servants.',
      count: 3,
      reference: 'Abu Dawud 4/311',
    },
    {
      arabic: 'سُبْحَانَكَ اللَّهُمَّ وَبِحَمْدِكَ، أَشْهَدُ أَنْ لَا إِلَهَ إِلَّا أَنْتَ، أَسْتَغْفِرُكَ وَأَتُوبُ إِلَيْكَ',
      english: 'Glory is to You O Allah, and praise. I bear witness that there is none worthy of worship but You. I seek Your forgiveness and return to You in repentance.',
      count: 1,
      reference: 'Tirmidhi 3/153',
    },
    {
      arabic: 'آيَةُ الْكُرْسِيِّ: اللَّهُ لَا إِلَهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ...',
      english: 'Ayatul Kursi: Allah — there is no deity except Him, the Ever-Living, the Sustainer of existence...',
      count: 1,
      reference: 'Bukhari 6/195',
    },
    {
      arabic: 'بِاسْمِكَ رَبِّي وَضَعْتُ جَنْبِي، وَبِكَ أَرْفَعُهُ',
      english: 'In Your Name my Lord, I lay down my side, and with Your Name I will raise it up.',
      count: 1,
      reference: 'Bukhari 11/126',
    },
  ],
  General: [
    {
      arabic: 'سُبْحَانَ اللهِ',
      english: 'Glory is to Allah.',
      count: 33,
      reference: 'Muslim 1/418',
    },
    {
      arabic: 'الْحَمْدُ لِلَّهِ',
      english: 'All praise is for Allah.',
      count: 33,
      reference: 'Muslim 1/418',
    },
    {
      arabic: 'اللهُ أَكْبَرُ',
      english: 'Allah is the greatest.',
      count: 33,
      reference: 'Muslim 1/418',
    },
    {
      arabic: 'لَا إِلَهَ إِلَّا اللهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ',
      english: 'There is no deity except Allah, alone without partner. To Him belongs all dominion and all praise, and He is over all things capable.',
      count: 1,
      reference: 'Muslim 1/418',
    },
    {
      arabic: 'أَسْتَغْفِرُ اللهَ',
      english: 'I seek forgiveness from Allah.',
      count: 100,
      reference: 'Muslim 4/2075',
    },
    {
      arabic: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ',
      english: 'O Allah, send blessings upon Muhammad and upon the family of Muhammad.',
      count: 10,
      reference: 'Bukhari & Muslim',
    },
    {
      arabic: 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللهِ',
      english: 'There is no power and no might except with Allah.',
      count: 10,
      reference: 'Bukhari 8/168',
    },
  ],
}

type Tab = 'Morning' | 'Night' | 'General'

export default function AthkarScreen() {
  const { colors } = useTheme()
  const [activeTab, setActiveTab] = useState<Tab>('Morning')
  const [counts, setCounts] = useState<Record<string, number>>({})

  const TABS: Tab[] = ['Morning', 'Night', 'General']
  const TAB_ICONS: Record<Tab, string> = { Morning: '🌅', Night: '🌙', General: '📿' }

  const items = ATHKAR[activeTab]

  function tick(key: string, max: number) {
    setCounts((prev) => {
      const current = prev[key] ?? 0
      return { ...prev, [key]: current >= max ? 0 : current + 1 }
    })
  }

  function resetAll() {
    setCounts({})
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, flex: 1 }}>Athkar</Text>
        <TouchableOpacity onPress={resetAll}>
          <Text style={{ color: colors.textTertiary, fontSize: 13 }}>Reset</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, gap: 8 }}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => { setActiveTab(tab); setCounts({}) }}
            style={{
              flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
              backgroundColor: activeTab === tab ? colors.primary : colors.surface,
              borderWidth: 1, borderColor: activeTab === tab ? colors.primary : colors.border,
            }}
          >
            <Text style={{ fontSize: 16 }}>{TAB_ICONS[tab]}</Text>
            <Text style={{ fontSize: 11, fontWeight: '600', marginTop: 2, color: activeTab === tab ? colors.primaryContrast : colors.textSecondary }}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 12 }}>
        {items.map((item, i) => {
          const key = `${activeTab}-${i}`
          const current = counts[key] ?? 0
          const isDone = current >= item.count

          return (
            <TouchableOpacity
              key={key}
              onPress={() => tick(key, item.count)}
              activeOpacity={0.8}
              style={{
                backgroundColor: isDone ? colors.primaryLight : colors.surface,
                borderRadius: 16, padding: 16,
                borderWidth: 1, borderColor: isDone ? colors.primary : colors.border,
              }}
            >
              <Text style={{ fontSize: 20, lineHeight: 34, color: colors.text, textAlign: 'right', fontFamily: 'serif', marginBottom: 10 }}>
                {item.arabic}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: 8 }}>
                {item.english}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.textTertiary, fontSize: 11 }}>{item.reference}</Text>
                <View style={{
                  paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20,
                  backgroundColor: isDone ? colors.primary : colors.surfaceSecondary,
                }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: isDone ? 'white' : colors.text }}>
                    {isDone ? '✓' : `${current}/${item.count}`}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )
        })}
        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  )
}
