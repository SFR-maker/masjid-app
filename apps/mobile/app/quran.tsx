import { useState, useEffect, useRef, useMemo } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, FlatList,
  ActivityIndicator, TextInput, Platform, NativeScrollEvent, NativeSyntheticEvent,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { useQuranAudioStore } from '../lib/quranAudioStore'
import {
  setAyahsForPlayback,
  setSurahNumber,
  stopQuranAudio,
  startQuranPlayback,
  startQuranPlaybackFromIndex,
} from '../lib/quranAudio'
import { useTheme } from '../contexts/ThemeContext'

const RECITERS = [
  { id: 'ar.alafasy',           name: 'Mishary Alafasy' },
  { id: 'ar.abdurrahmaansudais',name: 'Abdurrahman Al-Sudais' },
  { id: 'ar.husary',            name: 'Mahmoud Khalil Al-Husary' },
  { id: 'ar.minshawi',          name: 'Mohamed Siddiq El-Minshawi' },
  { id: 'ar.mahermuaiqly',      name: 'Maher Al-Muaiqly' },
]

// Bug 14 fix: Saheeh International first so it's the default translation
const LANGS = [
  { id: 'en.sahih',    name: 'Saheeh International' },
  { id: 'en.asad',     name: 'Muhammad Asad' },
  { id: 'en.pickthall',name: 'Pickthall' },
]

const API = 'https://api.alquran.cloud/v1'

// Bundled surah metadata — never changes, no API call needed for the list
const SURAHS: { number: number; name: string; englishName: string; englishNameTranslation: string; numberOfAyahs: number; revelationType: string }[] = [
  {number:1,name:'الْفَاتِحَة',englishName:'Al-Faatiha',englishNameTranslation:'The Opening',numberOfAyahs:7,revelationType:'Meccan'},
  {number:2,name:'الْبَقَرَة',englishName:'Al-Baqara',englishNameTranslation:'The Cow',numberOfAyahs:286,revelationType:'Medinan'},
  {number:3,name:'آل عِمْرَان',englishName:'Aal-i-Imraan',englishNameTranslation:'The Family of Imraan',numberOfAyahs:200,revelationType:'Medinan'},
  {number:4,name:'النِّسَاء',englishName:'An-Nisaa',englishNameTranslation:'The Women',numberOfAyahs:176,revelationType:'Medinan'},
  {number:5,name:'الْمَائِدَة',englishName:'Al-Maaida',englishNameTranslation:'The Table',numberOfAyahs:120,revelationType:'Medinan'},
  {number:6,name:'الْأَنْعَام',englishName:'Al-Anaam',englishNameTranslation:'The Cattle',numberOfAyahs:165,revelationType:'Meccan'},
  {number:7,name:'الْأَعْرَاف',englishName:'Al-Araaf',englishNameTranslation:'The Heights',numberOfAyahs:206,revelationType:'Meccan'},
  {number:8,name:'الْأَنفَال',englishName:'Al-Anfaal',englishNameTranslation:'The Spoils of War',numberOfAyahs:75,revelationType:'Medinan'},
  {number:9,name:'التَّوْبَة',englishName:'At-Tawba',englishNameTranslation:'The Repentance',numberOfAyahs:129,revelationType:'Medinan'},
  {number:10,name:'يُونُس',englishName:'Yunus',englishNameTranslation:'Jonah',numberOfAyahs:109,revelationType:'Meccan'},
  {number:11,name:'هُود',englishName:'Hud',englishNameTranslation:'Hud',numberOfAyahs:123,revelationType:'Meccan'},
  {number:12,name:'يُوسُف',englishName:'Yusuf',englishNameTranslation:'Joseph',numberOfAyahs:111,revelationType:'Meccan'},
  {number:13,name:'الرَّعْد',englishName:'Ar-Rad',englishNameTranslation:'The Thunder',numberOfAyahs:43,revelationType:'Medinan'},
  {number:14,name:'إِبْرَاهِيم',englishName:'Ibrahim',englishNameTranslation:'Abraham',numberOfAyahs:52,revelationType:'Meccan'},
  {number:15,name:'الْحِجْر',englishName:'Al-Hijr',englishNameTranslation:'The Rocky Tract',numberOfAyahs:99,revelationType:'Meccan'},
  {number:16,name:'النَّحْل',englishName:'An-Nahl',englishNameTranslation:'The Bee',numberOfAyahs:128,revelationType:'Meccan'},
  {number:17,name:'الْإِسْرَاء',englishName:'Al-Israa',englishNameTranslation:'The Night Journey',numberOfAyahs:111,revelationType:'Meccan'},
  {number:18,name:'الْكَهْف',englishName:'Al-Kahf',englishNameTranslation:'The Cave',numberOfAyahs:110,revelationType:'Meccan'},
  {number:19,name:'مَرْيَم',englishName:'Maryam',englishNameTranslation:'Mary',numberOfAyahs:98,revelationType:'Meccan'},
  {number:20,name:'طه',englishName:'Taa-Haa',englishNameTranslation:'Taa-Haa',numberOfAyahs:135,revelationType:'Meccan'},
  {number:21,name:'الْأَنْبِيَاء',englishName:'Al-Anbiyaa',englishNameTranslation:'The Prophets',numberOfAyahs:112,revelationType:'Meccan'},
  {number:22,name:'الْحَج',englishName:'Al-Hajj',englishNameTranslation:'The Pilgrimage',numberOfAyahs:78,revelationType:'Medinan'},
  {number:23,name:'الْمُؤْمِنُون',englishName:'Al-Muminoon',englishNameTranslation:'The Believers',numberOfAyahs:118,revelationType:'Meccan'},
  {number:24,name:'النُّور',englishName:'An-Noor',englishNameTranslation:'The Light',numberOfAyahs:64,revelationType:'Medinan'},
  {number:25,name:'الْفُرْقَان',englishName:'Al-Furqaan',englishNameTranslation:'The Criterion',numberOfAyahs:77,revelationType:'Meccan'},
  {number:26,name:'الشُّعَرَاء',englishName:'Ash-Shuaraa',englishNameTranslation:'The Poets',numberOfAyahs:227,revelationType:'Meccan'},
  {number:27,name:'النَّمْل',englishName:'An-Naml',englishNameTranslation:'The Ant',numberOfAyahs:93,revelationType:'Meccan'},
  {number:28,name:'الْقَصَص',englishName:'Al-Qasas',englishNameTranslation:'The Stories',numberOfAyahs:88,revelationType:'Meccan'},
  {number:29,name:'الْعَنْكَبُوت',englishName:'Al-Ankaboot',englishNameTranslation:'The Spider',numberOfAyahs:69,revelationType:'Meccan'},
  {number:30,name:'الرُّوم',englishName:'Ar-Room',englishNameTranslation:'The Romans',numberOfAyahs:60,revelationType:'Meccan'},
  {number:31,name:'لُقْمَان',englishName:'Luqman',englishNameTranslation:'Luqman',numberOfAyahs:34,revelationType:'Meccan'},
  {number:32,name:'السَّجْدَة',englishName:'As-Sajda',englishNameTranslation:'The Prostration',numberOfAyahs:30,revelationType:'Meccan'},
  {number:33,name:'الْأَحْزَاب',englishName:'Al-Ahzaab',englishNameTranslation:'The Clans',numberOfAyahs:73,revelationType:'Medinan'},
  {number:34,name:'سَبَإ',englishName:'Saba',englishNameTranslation:'Sheba',numberOfAyahs:54,revelationType:'Meccan'},
  {number:35,name:'فَاطِر',englishName:'Faatir',englishNameTranslation:'The Originator',numberOfAyahs:45,revelationType:'Meccan'},
  {number:36,name:'يس',englishName:'Yaseen',englishNameTranslation:'Yaseen',numberOfAyahs:83,revelationType:'Meccan'},
  {number:37,name:'الصَّافَّات',englishName:'As-Saaffaat',englishNameTranslation:'Those Who Set the Ranks',numberOfAyahs:182,revelationType:'Meccan'},
  {number:38,name:'ص',englishName:'Saad',englishNameTranslation:'The Letter Saad',numberOfAyahs:88,revelationType:'Meccan'},
  {number:39,name:'الزُّمَر',englishName:'Az-Zumar',englishNameTranslation:'The Groups',numberOfAyahs:75,revelationType:'Meccan'},
  {number:40,name:'غَافِر',englishName:'Ghafir',englishNameTranslation:'The Forgiver',numberOfAyahs:85,revelationType:'Meccan'},
  {number:41,name:'فُصِّلَت',englishName:'Fussilat',englishNameTranslation:'Explained in Detail',numberOfAyahs:54,revelationType:'Meccan'},
  {number:42,name:'الشُّورَى',englishName:'Ash-Shura',englishNameTranslation:'The Consultation',numberOfAyahs:53,revelationType:'Meccan'},
  {number:43,name:'الزُّخْرُف',englishName:'Az-Zukhruf',englishNameTranslation:'The Ornaments of Gold',numberOfAyahs:89,revelationType:'Meccan'},
  {number:44,name:'الدُّخَان',englishName:'Ad-Dukhaan',englishNameTranslation:'The Smoke',numberOfAyahs:59,revelationType:'Meccan'},
  {number:45,name:'الْجَاثِيَة',englishName:'Al-Jaathiya',englishNameTranslation:'The Crouching',numberOfAyahs:37,revelationType:'Meccan'},
  {number:46,name:'الْأَحْقَاف',englishName:'Al-Ahqaf',englishNameTranslation:'The Wind-Curved Sandhills',numberOfAyahs:35,revelationType:'Meccan'},
  {number:47,name:'مُحَمَّد',englishName:'Muhammad',englishNameTranslation:'Muhammad',numberOfAyahs:38,revelationType:'Medinan'},
  {number:48,name:'الْفَتْح',englishName:'Al-Fath',englishNameTranslation:'The Victory',numberOfAyahs:29,revelationType:'Medinan'},
  {number:49,name:'الْحُجُرَات',englishName:'Al-Hujuraat',englishNameTranslation:'The Rooms',numberOfAyahs:18,revelationType:'Medinan'},
  {number:50,name:'ق',englishName:'Qaaf',englishNameTranslation:'The Letter Qaaf',numberOfAyahs:45,revelationType:'Meccan'},
  {number:51,name:'الذَّارِيَات',englishName:'Adh-Dhaariyat',englishNameTranslation:'The Winnowing Winds',numberOfAyahs:60,revelationType:'Meccan'},
  {number:52,name:'الطُّور',englishName:'At-Tur',englishNameTranslation:'The Mount',numberOfAyahs:49,revelationType:'Meccan'},
  {number:53,name:'النَّجْم',englishName:'An-Najm',englishNameTranslation:'The Star',numberOfAyahs:62,revelationType:'Meccan'},
  {number:54,name:'الْقَمَر',englishName:'Al-Qamar',englishNameTranslation:'The Moon',numberOfAyahs:55,revelationType:'Meccan'},
  {number:55,name:'الرَّحْمَن',englishName:'Ar-Rahmaan',englishNameTranslation:'The Beneficent',numberOfAyahs:78,revelationType:'Medinan'},
  {number:56,name:'الْوَاقِعَة',englishName:'Al-Waaqia',englishNameTranslation:'The Inevitable',numberOfAyahs:96,revelationType:'Meccan'},
  {number:57,name:'الْحَدِيد',englishName:'Al-Hadid',englishNameTranslation:'The Iron',numberOfAyahs:29,revelationType:'Medinan'},
  {number:58,name:'الْمُجَادِلَة',englishName:'Al-Mujaadila',englishNameTranslation:'The Pleading Woman',numberOfAyahs:22,revelationType:'Medinan'},
  {number:59,name:'الْحَشْر',englishName:'Al-Hashr',englishNameTranslation:'The Exile',numberOfAyahs:24,revelationType:'Medinan'},
  {number:60,name:'الْمُمْتَحَنَة',englishName:'Al-Mumtahana',englishNameTranslation:'She That is to be Examined',numberOfAyahs:13,revelationType:'Medinan'},
  {number:61,name:'الصَّف',englishName:'As-Saff',englishNameTranslation:'The Ranks',numberOfAyahs:14,revelationType:'Medinan'},
  {number:62,name:'الْجُمُعَة',englishName:'Al-Jumuah',englishNameTranslation:'Friday',numberOfAyahs:11,revelationType:'Medinan'},
  {number:63,name:'الْمُنَافِقُون',englishName:'Al-Munaafiqoon',englishNameTranslation:'The Hypocrites',numberOfAyahs:11,revelationType:'Medinan'},
  {number:64,name:'التَّغَابُن',englishName:'At-Taghaabun',englishNameTranslation:'Mutual Disillusion',numberOfAyahs:18,revelationType:'Medinan'},
  {number:65,name:'الطَّلَاق',englishName:'At-Talaaq',englishNameTranslation:'Divorce',numberOfAyahs:12,revelationType:'Medinan'},
  {number:66,name:'التَّحْرِيم',englishName:'At-Tahrim',englishNameTranslation:'The Prohibition',numberOfAyahs:12,revelationType:'Medinan'},
  {number:67,name:'الْمُلْك',englishName:'Al-Mulk',englishNameTranslation:'The Sovereignty',numberOfAyahs:30,revelationType:'Meccan'},
  {number:68,name:'الْقَلَم',englishName:'Al-Qalam',englishNameTranslation:'The Pen',numberOfAyahs:52,revelationType:'Meccan'},
  {number:69,name:'الْحَاقَّة',englishName:'Al-Haaqqa',englishNameTranslation:'The Reality',numberOfAyahs:52,revelationType:'Meccan'},
  {number:70,name:'الْمَعَارِج',englishName:'Al-Maarij',englishNameTranslation:'The Ascending Stairways',numberOfAyahs:44,revelationType:'Meccan'},
  {number:71,name:'نُوح',englishName:'Nooh',englishNameTranslation:'Noah',numberOfAyahs:28,revelationType:'Meccan'},
  {number:72,name:'الْجِن',englishName:'Al-Jinn',englishNameTranslation:'The Jinn',numberOfAyahs:28,revelationType:'Meccan'},
  {number:73,name:'الْمُزَّمِّل',englishName:'Al-Muzzammil',englishNameTranslation:'The Enshrouded One',numberOfAyahs:20,revelationType:'Meccan'},
  {number:74,name:'الْمُدَّثِّر',englishName:'Al-Muddaththir',englishNameTranslation:'The Cloaked One',numberOfAyahs:56,revelationType:'Meccan'},
  {number:75,name:'الْقِيَامَة',englishName:'Al-Qiyaama',englishNameTranslation:'The Resurrection',numberOfAyahs:40,revelationType:'Meccan'},
  {number:76,name:'الْإِنسَان',englishName:'Al-Insaan',englishNameTranslation:'Man',numberOfAyahs:31,revelationType:'Medinan'},
  {number:77,name:'الْمُرْسَلَات',englishName:'Al-Mursalaat',englishNameTranslation:'The Emissaries',numberOfAyahs:50,revelationType:'Meccan'},
  {number:78,name:'النَّبَإ',englishName:'An-Naba',englishNameTranslation:'The Tidings',numberOfAyahs:40,revelationType:'Meccan'},
  {number:79,name:'النَّازِعَات',englishName:'An-Naaziat',englishNameTranslation:'Those Who Drag Forth',numberOfAyahs:46,revelationType:'Meccan'},
  {number:80,name:'عَبَسَ',englishName:'Abasa',englishNameTranslation:'He Frowned',numberOfAyahs:42,revelationType:'Meccan'},
  {number:81,name:'التَّكْوِير',englishName:'At-Takwir',englishNameTranslation:'The Overthrowing',numberOfAyahs:29,revelationType:'Meccan'},
  {number:82,name:'الْإِنفِطَار',englishName:'Al-Infitaar',englishNameTranslation:'The Cleaving',numberOfAyahs:19,revelationType:'Meccan'},
  {number:83,name:'الْمُطَفِّفِين',englishName:'Al-Mutaffifin',englishNameTranslation:'Defrauding',numberOfAyahs:36,revelationType:'Meccan'},
  {number:84,name:'الْإِنشِقَاق',englishName:'Al-Inshiqaaq',englishNameTranslation:'The Sundering',numberOfAyahs:25,revelationType:'Meccan'},
  {number:85,name:'الْبُرُوج',englishName:'Al-Burooj',englishNameTranslation:'The Mansions of the Stars',numberOfAyahs:22,revelationType:'Meccan'},
  {number:86,name:'الطَّارِق',englishName:'At-Taariq',englishNameTranslation:'The Nightcomer',numberOfAyahs:17,revelationType:'Meccan'},
  {number:87,name:'الْأَعْلَى',englishName:'Al-Ala',englishNameTranslation:'The Most High',numberOfAyahs:19,revelationType:'Meccan'},
  {number:88,name:'الْغَاشِيَة',englishName:'Al-Ghaashiya',englishNameTranslation:'The Overwhelming',numberOfAyahs:26,revelationType:'Meccan'},
  {number:89,name:'الْفَجْر',englishName:'Al-Fajr',englishNameTranslation:'The Dawn',numberOfAyahs:30,revelationType:'Meccan'},
  {number:90,name:'الْبَلَد',englishName:'Al-Balad',englishNameTranslation:'The City',numberOfAyahs:20,revelationType:'Meccan'},
  {number:91,name:'الشَّمْس',englishName:'Ash-Shams',englishNameTranslation:'The Sun',numberOfAyahs:15,revelationType:'Meccan'},
  {number:92,name:'اللَّيْل',englishName:'Al-Lail',englishNameTranslation:'The Night',numberOfAyahs:21,revelationType:'Meccan'},
  {number:93,name:'الضُّحَى',englishName:'Ad-Duhaa',englishNameTranslation:'The Morning Hours',numberOfAyahs:11,revelationType:'Meccan'},
  {number:94,name:'الشَّرْح',englishName:'Ash-Sharh',englishNameTranslation:'The Relief',numberOfAyahs:8,revelationType:'Meccan'},
  {number:95,name:'التِّين',englishName:'At-Tin',englishNameTranslation:'The Fig',numberOfAyahs:8,revelationType:'Meccan'},
  {number:96,name:'الْعَلَق',englishName:'Al-Alaq',englishNameTranslation:'The Clot',numberOfAyahs:19,revelationType:'Meccan'},
  {number:97,name:'الْقَدْر',englishName:'Al-Qadr',englishNameTranslation:'The Power',numberOfAyahs:5,revelationType:'Meccan'},
  {number:98,name:'الْبَيِّنَة',englishName:'Al-Bayyina',englishNameTranslation:'The Clear Proof',numberOfAyahs:8,revelationType:'Medinan'},
  {number:99,name:'الزَّلْزَلَة',englishName:'Az-Zalzala',englishNameTranslation:'The Earthquake',numberOfAyahs:8,revelationType:'Medinan'},
  {number:100,name:'الْعَادِيَات',englishName:'Al-Aadiyaat',englishNameTranslation:'The Courser',numberOfAyahs:11,revelationType:'Meccan'},
  {number:101,name:'الْقَارِعَة',englishName:'Al-Qaaria',englishNameTranslation:'The Calamity',numberOfAyahs:11,revelationType:'Meccan'},
  {number:102,name:'التَّكَاثُر',englishName:'At-Takaathur',englishNameTranslation:'The Rivalry in World Increase',numberOfAyahs:8,revelationType:'Meccan'},
  {number:103,name:'الْعَصْر',englishName:'Al-Asr',englishNameTranslation:'The Declining Day',numberOfAyahs:3,revelationType:'Meccan'},
  {number:104,name:'الْهُمَزَة',englishName:'Al-Humaza',englishNameTranslation:'The Traducer',numberOfAyahs:9,revelationType:'Meccan'},
  {number:105,name:'الْفِيل',englishName:'Al-Fil',englishNameTranslation:'The Elephant',numberOfAyahs:5,revelationType:'Meccan'},
  {number:106,name:'قُرَيْش',englishName:'Quraish',englishNameTranslation:'Quraysh',numberOfAyahs:4,revelationType:'Meccan'},
  {number:107,name:'الْمَاعُون',englishName:'Al-Maaoon',englishNameTranslation:'The Small Kindnesses',numberOfAyahs:7,revelationType:'Meccan'},
  {number:108,name:'الْكَوْثَر',englishName:'Al-Kawthar',englishNameTranslation:'A River in Paradise',numberOfAyahs:3,revelationType:'Meccan'},
  {number:109,name:'الْكَافِرُون',englishName:'Al-Kaafiroon',englishNameTranslation:'The Disbelievers',numberOfAyahs:6,revelationType:'Meccan'},
  {number:110,name:'النَّصْر',englishName:'An-Nasr',englishNameTranslation:'The Divine Support',numberOfAyahs:3,revelationType:'Medinan'},
  {number:111,name:'الْمَسَد',englishName:'Al-Masad',englishNameTranslation:'The Palm Fibre',numberOfAyahs:5,revelationType:'Meccan'},
  {number:112,name:'الْإِخْلَاص',englishName:'Al-Ikhlaas',englishNameTranslation:'Sincerity',numberOfAyahs:4,revelationType:'Meccan'},
  {number:113,name:'الْفَلَق',englishName:'Al-Falaq',englishNameTranslation:'The Daybreak',numberOfAyahs:5,revelationType:'Meccan'},
  {number:114,name:'النَّاس',englishName:'An-Naas',englishNameTranslation:'Mankind',numberOfAyahs:6,revelationType:'Meccan'},
]

// Fetch both Arabic (with audio) and translation in a single API call
async function fetchSurahCombined(number: number, reciter: string, translation: string) {
  const res = await fetch(`${API}/surah/${number}/editions/${reciter},${translation}`)
  const json = await res.json() as any
  if (json.code !== 200) throw new Error('Failed to load surah')
  // data is an array: [reciterEdition, translationEdition]
  return {
    arabicData: json.data[0],
    transData: json.data[1],
  }
}

export default function QuranScreen() {
  const { colors } = useTheme()

  // If audio is already playing/paused (e.g. user tapped NowPlayingBar), restore that context
  const _initStore = useQuranAudioStore.getState()
  const _audioActive = _initStore.isPlaying || _initStore.isPaused
  const [selectedSurah, setSelectedSurah] = useState<number | null>(
    _audioActive && _initStore.playingSurahNumber ? _initStore.playingSurahNumber : null
  )
  const [reciter, setReciter] = useState(
    _audioActive && _initStore.playingReciterId ? _initStore.playingReciterId : RECITERS[0].id
  )
  const [translation, setTranslation] = useState(
    _audioActive && _initStore.playingTranslationId ? _initStore.playingTranslationId : LANGS[0].id
  )
  const [showSettings, setShowSettings] = useState(false)
  const [search, setSearch] = useState('')
  const [audioLoading, setAudioLoading] = useState(false)
  const [readingMode, setReadingMode] = useState<'verse' | 'reading'>('verse')

  const isPlaying = useQuranAudioStore(s => s.isPlaying)
  const playingAyah = useQuranAudioStore(s => s.playingAyah)
  // Use getState() for actions to avoid subscribing the component to store changes
  // Track whether this is the initial mount so we can skip stopQuranAudio() on first render
  const didMountRef = useRef(false)
  const flatListRef = useRef<FlatList>(null)
  const scrollViewRef = useRef<ScrollView>(null)
  // Y offset of each translation row within the ScrollView content
  const readingAyahOffsets = useRef<number[]>([])
  // Y offset of the translation container itself (set once on layout)
  const translationSectionY = useRef(0)

  // Surah list comes from the bundled constant — instant, no network needed
  const surahs = SURAHS
  const surahsLoading = false
  const surahsError = false

  // Single combined request for both Arabic + translation
  const { data: surahContent, isLoading: isLoadingContent } = useQuery({
    queryKey: ['surah-combined', selectedSurah, reciter, translation],
    queryFn: () => fetchSurahCombined(selectedSurah!, reciter, translation),
    enabled: !!selectedSurah,
    staleTime: Infinity,
  })

  // useMemo keeps the array reference stable when surahContent is undefined,
  // preventing the useEffect below from firing on every render.
  const ayahs: any[] = useMemo(() => surahContent?.arabicData?.ayahs ?? [], [surahContent])
  const transAyahs: any[] = useMemo(() => surahContent?.transData?.ayahs ?? [], [surahContent])

  // Keep the module-level ayahs list in sync
  useEffect(() => {
    setAyahsForPlayback(ayahs)
  }, [ayahs])

  // Verse mode: scroll to the currently playing ayah whenever it changes
  useEffect(() => {
    if (!ayahs.length || !playingAyah || readingMode !== 'verse') return
    const index = playingAyah - 1
    if (index < 0 || index >= ayahs.length) return
    const t = setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.3 })
    }, 300)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingAyah, readingMode])

  // Reading mode: scroll once when content loads (e.g. returning via NowPlayingBar)
  useEffect(() => {
    if (!ayahs.length || !playingAyah || readingMode !== 'reading') return
    const index = playingAyah - 1
    if (index < 0) return
    const t = setTimeout(() => {
      const rowY = readingAyahOffsets.current[index]
      if (rowY !== undefined) {
        scrollViewRef.current?.scrollTo({ y: translationSectionY.current + rowY - 20, animated: true })
      }
    }, 500)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ayahs.length, readingMode])

  // Update global surah info and stop audio when surah/reciter changes.
  // Skip stopQuranAudio() on initial mount so that tapping NowPlayingBar
  // to return here doesn't kill the active playback session.
  useEffect(() => {
    const surahName = surahs.find(s => s.number === selectedSurah)?.englishName ?? ''
    const reciterName = RECITERS.find(r => r.id === reciter)?.name ?? ''
    useQuranAudioStore.getState().setSurahInfo(surahName, reciterName)
    if (selectedSurah) setSurahNumber(selectedSurah)
    if (didMountRef.current) {
      stopQuranAudio()
    } else {
      didMountRef.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSurah, reciter])

  async function handlePlayAll() {
    if (isPlaying) {
      await stopQuranAudio()
      return
    }
    if (!ayahs.length) return
    setAudioLoading(true)
    useQuranAudioStore.getState().setPlayingLocation(selectedSurah!, reciter, translation)
    await startQuranPlayback()
    setAudioLoading(false)
  }

  async function handlePlaySingle(ayah: any, index: number) {
    if (playingAyah === ayah.numberInSurah && isPlaying) {
      await stopQuranAudio()
      return
    }
    useQuranAudioStore.getState().setPlayingLocation(selectedSurah!, reciter, translation)
    await startQuranPlaybackFromIndex(index)
  }

  const filteredSurahs = surahs?.filter(s =>
    search === '' ||
    s.englishName.toLowerCase().includes(search.toLowerCase()) ||
    s.name.includes(search) ||
    String(s.number).includes(search)
  ) ?? []

  const selectedSurahInfo = surahs?.find(s => s.number === selectedSurah)
  const currentReciterName = RECITERS.find(r => r.id === reciter)?.name ?? ''
  const isLoadingSurah = isLoadingContent

  // ── Surah list ──────────────────────────────────────────────────────────
  if (!selectedSurah) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>The Qur'an</Text>
            <Text style={{ color: colors.textTertiary, fontSize: 12 }}>القرآن الكريم</Text>
          </View>
          <TouchableOpacity onPress={() => setShowSettings(!showSettings)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceSecondary, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Ionicons name="musical-notes-outline" size={14} color={colors.primary} />
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }} numberOfLines={1}>{currentReciterName}</Text>
          </TouchableOpacity>
        </View>

        {showSettings && <SettingsPanel reciter={reciter} setReciter={setReciter} translation={translation} setTranslation={setTranslation} />}

        <View style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: colors.border, gap: 8 }}>
            <Ionicons name="search" size={16} color={colors.textTertiary} />
            <TextInput value={search} onChangeText={setSearch} placeholder="Search surah..." placeholderTextColor={colors.textTertiary}
              style={{ flex: 1, fontSize: 14, color: colors.text }} />
          </View>
        </View>

        {surahsLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={{ color: colors.textTertiary, marginTop: 12 }}>Loading Qur'an...</Text>
          </View>
        ) : surahsError ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
            <Text style={{ fontSize: 32, marginBottom: 12 }}>⚠️</Text>
            <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>Could not load. Check your connection.</Text>
          </View>
        ) : (
          <FlatList
            data={filteredSurahs}
            keyExtractor={item => String(item.number)}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
            renderItem={({ item: s }) => (
              <TouchableOpacity onPress={() => setSelectedSurah(s.number)}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
                <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                  <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.primary }}>{s.number}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{s.englishName}</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>{s.englishNameTranslation} · {s.numberOfAyahs} verses</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 18, color: colors.primary, fontFamily: Platform.OS === 'ios' ? 'GeezaPro' : 'serif' }}>{s.name}</Text>
                  <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 2 }}>{s.revelationType}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
    )
  }

  // ── Surah reader ────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
          <TouchableOpacity onPress={() => { stopQuranAudio(); setSelectedSurah(null) }} style={{ marginRight: 12 }}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: 'bold', color: colors.text }}>{selectedSurahInfo?.englishName}</Text>
            <Text style={{ color: colors.textTertiary, fontSize: 12 }}>Surah {selectedSurah} · {selectedSurahInfo?.numberOfAyahs} verses</Text>
          </View>
          <Text style={{ fontSize: 20, color: colors.primary, fontFamily: Platform.OS === 'ios' ? 'GeezaPro' : 'serif' }}>
            {selectedSurahInfo?.name}
          </Text>
        </View>

        {/* Reciter bar — always visible in reader */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12, gap: 10 }}>
          <TouchableOpacity
            onPress={handlePlayAll}
            disabled={audioLoading || isLoadingSurah}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: isPlaying ? colors.primary : colors.primaryLight, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 }}
          >
            {audioLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={16} color={isPlaying ? colors.primaryContrast : colors.primary} />
            )}
            <Text style={{ fontSize: 13, fontWeight: '700', color: isPlaying ? colors.primaryContrast : colors.primary }}>
              {isPlaying ? 'Stop' : 'Play Surah'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowSettings(!showSettings)}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceSecondary, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 }}
          >
            <Ionicons name="musical-notes-outline" size={14} color={colors.textSecondary} />
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text, flex: 1 }} numberOfLines={1}>{currentReciterName}</Text>
            <Ionicons name={showSettings ? 'chevron-up' : 'chevron-down'} size={12} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {showSettings && <SettingsPanel reciter={reciter} setReciter={setReciter} translation={translation} setTranslation={setTranslation} />}

        {/* Mode toggle */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 10, gap: 8 }}>
          {(['verse', 'reading'] as const).map(m => (
            <TouchableOpacity
              key={m}
              onPress={() => setReadingMode(m)}
              style={{
                paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
                backgroundColor: readingMode === m ? colors.primary : colors.surfaceSecondary,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: readingMode === m ? colors.primaryContrast : colors.textSecondary }}>
                {m === 'verse' ? 'Verse by Verse' : 'Reading'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isLoadingSurah ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={{ color: colors.textTertiary, marginTop: 12 }}>Loading surah...</Text>
        </View>
      ) : readingMode === 'reading' ? (
        <ScrollView ref={scrollViewRef} contentContainerStyle={{ padding: 20, paddingBottom: 80 }}>
          {selectedSurah !== 1 && selectedSurah !== 9 && (
            <View style={{ backgroundColor: colors.primary, borderRadius: 16, padding: 20, marginBottom: 24, alignItems: 'center', opacity: playingAyah === 0 ? 0.75 : 1, borderWidth: playingAyah === 0 ? 3 : 0, borderColor: 'white' }}>
              {playingAyah === 0 && (
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6 }}>▶ PLAYING</Text>
              )}
              <Text style={{ color: colors.primaryContrast, fontSize: 22, textAlign: 'center', lineHeight: 36 }}>
                بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 6 }}>In the name of Allah, the Most Gracious, the Most Merciful</Text>
            </View>
          )}
          {/* Arabic block */}
          <Text style={{ fontSize: 22, lineHeight: 48, textAlign: 'right', fontFamily: Platform.OS === 'ios' ? 'GeezaPro' : 'serif', marginBottom: 24 }}>
            {ayahs.map((a, i) => {
              const ayahActive = playingAyah === a.numberInSurah
              // Strip leading Bismillah from first ayah when the banner already shows it
              // (all surahs except Al-Fatiha (1) and At-Tawba (9))
              let text = a.text as string
              if (i === 0 && selectedSurah !== 1 && selectedSurah !== 9) {
                // Bismillah is always the first 4 words — skip them regardless of diacritic encoding
                const words = text.split(/\s+/)
                if (words.length > 4) text = words.slice(4).join(' ')
              }
              return (
                <Text key={i}>
                  <Text style={{ color: ayahActive ? colors.primary : colors.textSecondary, fontWeight: ayahActive ? '600' : '400' }}>{text}{' '}</Text>
                  <Text style={{ fontSize: 16, color: ayahActive ? colors.primary : colors.textTertiary }}>﴿{a.numberInSurah}﴾</Text>
                  {' '}
                </Text>
              )
            })}
          </Text>
          {/* English translation block */}
          <View
            onLayout={(e) => { translationSectionY.current = e.nativeEvent.layout.y }}
            style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 20 }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textTertiary, letterSpacing: 0.8, marginBottom: 16 }}>TRANSLATION</Text>
            {transAyahs.map((t, i) => {
              const active = playingAyah === (i + 1)
              return (
                <View
                  key={i}
                  onLayout={(e) => { readingAyahOffsets.current[i] = e.nativeEvent.layout.y }}
                  style={{ flexDirection: 'row', gap: 10, marginBottom: 14, backgroundColor: active ? colors.primaryLight : 'transparent', borderRadius: 10, padding: active ? 8 : 0, marginHorizontal: active ? -8 : 0 }}
                >
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: active ? colors.primary : colors.primaryLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: active ? colors.primaryContrast : colors.primary }}>{i + 1}</Text>
                  </View>
                  <Text style={{ flex: 1, fontSize: 14, color: active ? colors.text : colors.textSecondary, lineHeight: 22, fontWeight: active ? '500' : '400' }}>{t.text}</Text>
                </View>
              )
            })}
          </View>
        </ScrollView>
      ) : (
        <FlatList
          ref={flatListRef}
          data={ayahs}
          keyExtractor={item => String(item.numberInSurah)}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 60 }}
          onScrollToIndexFailed={({ index, averageItemLength }) => {
            // Fallback: scroll to estimated offset if index is out of rendered range
            flatListRef.current?.scrollToOffset({ offset: index * averageItemLength, animated: true })
          }}
          ListHeaderComponent={
            selectedSurah !== 1 && selectedSurah !== 9 ? (
              <View style={{ backgroundColor: colors.primary, borderRadius: 16, padding: 20, marginBottom: 16, alignItems: 'center', opacity: playingAyah === 0 ? 0.75 : 1, borderWidth: playingAyah === 0 ? 3 : 0, borderColor: 'white' }}>
                {playingAyah === 0 && (
                  <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6 }}>▶ PLAYING</Text>
                )}
                <Text style={{ color: colors.primaryContrast, fontSize: 22, fontFamily: Platform.OS === 'ios' ? 'GeezaPro' : 'serif', textAlign: 'center', lineHeight: 36 }}>
                  بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                </Text>
                <Text style={{ color: colors.isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 6 }}>In the name of Allah, the Most Gracious, the Most Merciful</Text>
              </View>
            ) : null
          }
          renderItem={({ item: ayah, index }) => {
            const trans = transAyahs[index]
            const isThisPlaying = playingAyah === ayah.numberInSurah && isPlaying
            // Strip Bismillah from first ayah — the banner above already shows it
            let ayahText: string = ayah.text
            if (index === 0 && selectedSurah !== 1 && selectedSurah !== 9) {
              const words = ayahText.split(/\s+/)
              if (words.length > 4) ayahText = words.slice(4).join(' ')
            }

            return (
              <View style={{
                marginBottom: 16,
                backgroundColor: isThisPlaying ? colors.primaryLight : colors.surface,
                borderRadius: 16, padding: 16,
                borderWidth: 1, borderColor: isThisPlaying ? colors.primary : colors.border,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  {/* Bug 13 fix: ayah number badge is tappable to start recitation from that ayah */}
                  <TouchableOpacity
                    onPress={() => handlePlaySingle(ayah, index)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ backgroundColor: isThisPlaying ? colors.primary : colors.primaryLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: isThisPlaying ? colors.primaryContrast : colors.primary }}>{ayah.numberInSurah}</Text>
                  </TouchableOpacity>
                  {ayah.audio && (
                    <TouchableOpacity
                      onPress={() => handlePlaySingle(ayah, index)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: isThisPlaying ? colors.primary : colors.surfaceSecondary, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }}
                    >
                      <Ionicons name={isThisPlaying ? 'pause' : 'play'} size={13} color={isThisPlaying ? colors.primaryContrast : colors.primary} />
                      <Text style={{ fontSize: 12, fontWeight: '600', color: isThisPlaying ? colors.primaryContrast : colors.primary }}>
                        {isThisPlaying ? 'Pause' : 'Play'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={{ fontSize: 22, lineHeight: 40, color: colors.text, textAlign: 'right', fontFamily: Platform.OS === 'ios' ? 'GeezaPro' : 'serif', marginBottom: 12 }}>
                  {ayahText}
                </Text>
                {trans && (
                  <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 22 }}>{trans.text}</Text>
                )}
              </View>
            )
          }}
        />
      )}

    </SafeAreaView>
  )
}

function SettingsPanel({ reciter, setReciter, translation, setTranslation }: {
  reciter: string; setReciter: (v: string) => void
  translation: string; setTranslation: (v: string) => void
}) {
  const { colors } = useTheme()
  return (
    <View style={{ backgroundColor: colors.surface, paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 }}>
      <View>
        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textTertiary, marginBottom: 8 }}>RECITER</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {RECITERS.map(r => (
            <TouchableOpacity key={r.id} onPress={() => setReciter(r.id)}
              style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: reciter === r.id ? colors.primary : colors.surfaceSecondary }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: reciter === r.id ? colors.primaryContrast : colors.textSecondary }}>{r.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      <View>
        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textTertiary, marginBottom: 8 }}>TRANSLATION</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {LANGS.map(l => (
            <TouchableOpacity key={l.id} onPress={() => setTranslation(l.id)}
              style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: translation === l.id ? colors.primary : colors.surfaceSecondary }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: translation === l.id ? colors.primaryContrast : colors.textSecondary }}>{l.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  )
}
