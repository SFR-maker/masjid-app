import { useState } from 'react'
import {
  View, Text, Modal, TouchableOpacity, TextInput, FlatList,
  ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, ScrollView,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from '../contexts/ThemeContext'

export interface QuranVerseData {
  quranSurah: number
  quranAyah: number
  quranAyahEnd?: number
  quranSurahName: string
  quranArabic: string
  quranEnglish: string
}

interface Props {
  verse: QuranVerseData | null
  onSelect: (v: QuranVerseData | null) => void
}

export function QuranPicker({ verse, onSelect }: Props) {
  const { colors } = useTheme()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'surah' | 'ayah'>('surah')
  const [search, setSearch] = useState('')
  const [selectedSurah, setSelectedSurah] = useState<{ number: number; englishName: string; numberOfAyahs: number } | null>(null)
  const [fromInput, setFromInput] = useState('')
  const [toInput, setToInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { data: surahList } = useQuery({
    queryKey: ['quran-surahs'],
    queryFn: () => fetch('https://api.alquran.cloud/v1/surah').then(r => r.json() as Promise<any>),
    staleTime: Infinity,
  })
  const surahs: any[] = surahList?.data ?? []

  const filtered = search.trim()
    ? surahs.filter(s =>
        s.englishName.toLowerCase().includes(search.toLowerCase()) ||
        s.name.includes(search) ||
        String(s.number).includes(search)
      )
    : surahs

  function openPicker() {
    setStep('surah')
    setSearch('')
    setFromInput('')
    setToInput('')
    setError('')
    if (verse) {
      const s = surahs.find(x => x.number === verse.quranSurah)
      if (s) {
        setSelectedSurah(s)
        setFromInput(String(verse.quranAyah))
        setToInput(verse.quranAyahEnd ? String(verse.quranAyahEnd) : '')
        setStep('ayah')
      }
    }
    setOpen(true)
  }

  async function handleConfirm() {
    const from = parseInt(fromInput)
    const to = toInput.trim() ? parseInt(toInput) : from
    const max = selectedSurah?.numberOfAyahs ?? 999

    if (!selectedSurah || !from || from < 1 || from > max) {
      setError(`From must be between 1 and ${max}`)
      return
    }
    if (to < from || to > max) {
      setError(`To must be between ${from} and ${max}`)
      return
    }
    if (to - from > 2) {
      setError('Maximum 3 ayat at a time')
      return
    }

    setError('')
    setLoading(true)
    try {
      const indices = Array.from({ length: to - from + 1 }, (_, i) => from + i)
      const results = await Promise.all(
        indices.map(ayah => Promise.all([
          fetch(`https://api.alquran.cloud/v1/ayah/${selectedSurah.number}:${ayah}/ar.alafasy`).then(r => r.json() as Promise<any>),
          fetch(`https://api.alquran.cloud/v1/ayah/${selectedSurah.number}:${ayah}/en.sahih`).then(r => r.json() as Promise<any>),
        ]))
      )
      const arabic = results.map(([ar]) => ar?.data?.text ?? '').join(' ')
      const english = results.map(([, en]) => en?.data?.text ?? '').join(' ')
      onSelect({
        quranSurah: selectedSurah.number,
        quranAyah: from,
        quranAyahEnd: to > from ? to : undefined,
        quranSurahName: selectedSurah.englishName,
        quranArabic: arabic,
        quranEnglish: english,
      })
      setOpen(false)
    } catch {
      setError('Could not load verses. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const rangeLabel = verse
    ? verse.quranAyahEnd && verse.quranAyahEnd !== verse.quranAyah
      ? `${verse.quranSurah}:${verse.quranAyah}–${verse.quranAyahEnd}`
      : `${verse.quranSurah}:${verse.quranAyah}`
    : ''

  return (
    <>
      {verse ? (
        <View style={{ backgroundColor: '#F0FDF4', borderRadius: 10, padding: 10, marginTop: 6, borderWidth: 1, borderColor: '#D1FAE5' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#065F46' }}>
              📖 {verse.quranSurahName} {rangeLabel}
            </Text>
            <TouchableOpacity onPress={() => onSelect(null)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Text style={{ fontSize: 11, color: '#EF4444' }}>Remove</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ fontSize: 14, color: '#1A1A1A', textAlign: 'right', lineHeight: 24 }} numberOfLines={3}>
            {verse.quranArabic}
          </Text>
          <Text style={{ fontSize: 11, color: '#374151', fontStyle: 'italic', marginTop: 3 }} numberOfLines={3}>
            "{verse.quranEnglish}"
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          onPress={openPicker}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 }}
        >
          <Text style={{ fontSize: 14 }}>📖</Text>
          <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>Add Verse</Text>
        </TouchableOpacity>
      )}

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: 'flex-end' }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'android' ? 0 : 0}
        >
          <TouchableOpacity
            style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' }}
            activeOpacity={1}
            onPress={() => setOpen(false)}
          />
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '82%', minHeight: step === 'surah' ? 480 : 0 }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <TouchableOpacity onPress={() => step === 'ayah' ? setStep('surah') : setOpen(false)}>
                <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 14 }}>
                  {step === 'ayah' ? '← Back' : 'Cancel'}
                </Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                {step === 'surah' ? 'Select Surah' : selectedSurah?.englishName}
              </Text>
              <View style={{ width: 60 }} />
            </View>

            {step === 'surah' ? (
              <>
                <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search surahs…"
                    placeholderTextColor={colors.textTertiary}
                    style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, borderWidth: 1, borderColor: colors.border, color: colors.text }}
                    autoFocus
                  />
                </View>
                {surahs.length === 0 ? (
                  <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
                    <ActivityIndicator color={colors.primary} />
                    <Text style={{ color: colors.textTertiary, marginTop: 10, fontSize: 13 }}>Loading surahs…</Text>
                  </View>
                ) : (
                  <FlatList
                    data={filtered}
                    keyExtractor={item => String(item.number)}
                    keyboardShouldPersistTaps="handled"
                    style={{ flexGrow: 0, height: 380 }}
                    ListEmptyComponent={
                      <Text style={{ textAlign: 'center', color: colors.textTertiary, paddingVertical: 24, fontSize: 13 }}>No results</Text>
                    }
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        onPress={() => { setSelectedSurah(item); setFromInput(''); setToInput(''); setError(''); setStep('ayah') }}
                        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}
                      >
                        <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>{item.number}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{item.englishName}</Text>
                          <Text style={{ fontSize: 12, color: colors.textTertiary }}>{item.numberOfAyahs} ayahs</Text>
                        </View>
                        <Text style={{ fontSize: 16, color: colors.textSecondary }}>{item.name}</Text>
                      </TouchableOpacity>
                    )}
                  />
                )}
              </>
            ) : (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ padding: 20, gap: 14 }}
                showsVerticalScrollIndicator={false}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                  Select ayah range (1–{selectedSurah?.numberOfAyahs}) · max 3 ayat
                </Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textTertiary, marginBottom: 6 }}>FROM</Text>
                    <TextInput
                      value={fromInput}
                      onChangeText={setFromInput}
                      keyboardType="number-pad"
                      placeholder="e.g. 1"
                      placeholderTextColor={colors.textTertiary}
                      style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 18, fontWeight: '600', borderWidth: 1, borderColor: colors.border, color: colors.text, textAlign: 'center' }}
                      autoFocus
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textTertiary, marginBottom: 6 }}>TO <Text style={{ fontWeight: '400' }}>(optional)</Text></Text>
                    <TextInput
                      value={toInput}
                      onChangeText={setToInput}
                      keyboardType="number-pad"
                      placeholder="e.g. 3"
                      placeholderTextColor={colors.textTertiary}
                      style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 18, fontWeight: '600', borderWidth: 1, borderColor: colors.border, color: colors.text, textAlign: 'center' }}
                    />
                  </View>
                </View>
                {error ? <Text style={{ color: '#EF4444', fontSize: 12, textAlign: 'center' }}>{error}</Text> : null}
                <TouchableOpacity
                  onPress={handleConfirm}
                  disabled={loading || !fromInput}
                  style={{ backgroundColor: fromInput ? colors.primary : colors.border, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
                >
                  {loading
                    ? <ActivityIndicator color={colors.primaryContrast} />
                    : <Text style={{ color: fromInput ? colors.primaryContrast : colors.textTertiary, fontWeight: '700', fontSize: 15 }}>Add Verse{toInput && parseInt(toInput) > parseInt(fromInput) ? 's' : ''}</Text>
                  }
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  )
}
