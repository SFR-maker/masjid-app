'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { useAdminFetch } from '../../../../lib/adminFetch'

const CATEGORIES = ['GENERAL','HALAQA','YOUTH','SISTERS','EID','RAMADAN','FUNDRAISER','JANAZAH','COMMUNITY','EDUCATIONAL','OTHER']

const DEFAULT_FORM = {
  title: '', description: '', category: 'GENERAL',
  startTime: '', endTime: '', location: '',
  requiresRsvp: true, isOnline: false, maxAttendees: '',
  imageUrl: '', videoUrl: '', isPrivate: false,
  quranSurah: null as number | null,
  quranAyah: null as number | null,
  quranAyahEnd: null as number | null,
  quranSurahName: '',
  quranArabic: '',
  quranEnglish: '',
}

interface QuranFormFields {
  quranSurah: number | null
  quranAyah: number | null
  quranAyahEnd: number | null
  quranSurahName: string
  quranArabic: string
  quranEnglish: string
}

function QuranVersePicker({ value, onChange }: { value: QuranFormFields; onChange: (v: QuranFormFields) => void }) {
  const [ayahCount, setAyahCount] = useState(0)
  const [loadingVerse, setLoadingVerse] = useState(false)
  const [error, setError] = useState('')

  const { data: surahList } = useQuery({
    queryKey: ['quran-surahs'],
    queryFn: () => fetch('https://api.alquran.cloud/v1/surah').then(r => r.json()),
    staleTime: Infinity,
  })
  const surahs: any[] = surahList?.data ?? []

  useEffect(() => {
    if (value.quranSurah && surahs.length > 0) {
      const s = surahs.find((x: any) => x.number === value.quranSurah)
      if (s) setAyahCount(s.numberOfAyahs)
    }
  }, [value.quranSurah, surahs.length])

  async function handleSurahChange(n: number) {
    const s = surahs.find((x: any) => x.number === n)
    setAyahCount(s?.numberOfAyahs ?? 0)
    onChange({ quranSurah: n, quranAyah: null, quranAyahEnd: null, quranSurahName: s?.englishName ?? '', quranArabic: '', quranEnglish: '' })
  }

  async function fetchRange(surah: number, from: number, to: number) {
    setLoadingVerse(true); setError('')
    try {
      const indices = Array.from({ length: to - from + 1 }, (_, i) => from + i)
      const results = await Promise.all(
        indices.map(ayah => Promise.all([
          fetch(`https://api.alquran.cloud/v1/ayah/${surah}:${ayah}/ar.alafasy`).then(r => r.json()),
          fetch(`https://api.alquran.cloud/v1/ayah/${surah}:${ayah}/en.sahih`).then(r => r.json()),
        ]))
      )
      const arabic = results.map(([ar]) => ar?.data?.text ?? '').join(' ')
      const english = results.map(([, en]) => en?.data?.text ?? '').join(' ')
      onChange({ ...value, quranSurah: surah, quranAyah: from, quranAyahEnd: to > from ? to : null, quranArabic: arabic, quranEnglish: english })
    } catch { setError('Could not load verses.') }
    finally { setLoadingVerse(false) }
  }

  function handleFromChange(from: number) {
    onChange({ ...value, quranAyah: from, quranAyahEnd: null, quranArabic: '', quranEnglish: '' })
    if (value.quranSurah && from > 0) fetchRange(value.quranSurah, from, from)
  }

  function handleToChange(to: number) {
    const from = value.quranAyah ?? to
    onChange({ ...value, quranAyahEnd: to > from ? to : null, quranArabic: '', quranEnglish: '' })
    if (value.quranSurah && from > 0 && to >= from) fetchRange(value.quranSurah, from, to)
  }

  const rangeLabel = value.quranAyahEnd && value.quranAyahEnd !== value.quranAyah
    ? `${value.quranSurah}:${value.quranAyah}–${value.quranAyahEnd}`
    : `${value.quranSurah}:${value.quranAyah}`

  return (
    <div className="border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-700">📖 Qur'an Verse (optional)</span>
        {value.quranSurah && (
          <button type="button" onClick={() => onChange({ quranSurah: null, quranAyah: null, quranAyahEnd: null, quranSurahName: '', quranArabic: '', quranEnglish: '' })}
            className="text-xs text-red-400 hover:text-red-600">Remove</button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="col-span-1">
          <label className="block text-xs text-gray-500 mb-1">Surah</label>
          <select value={value.quranSurah ?? ''} onChange={e => e.target.value ? handleSurahChange(Number(e.target.value)) : onChange({ quranSurah: null, quranAyah: null, quranAyahEnd: null, quranSurahName: '', quranArabic: '', quranEnglish: '' })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800">
            <option value="">Select Surah…</option>
            {surahs.map((s: any) => <option key={s.number} value={s.number}>{s.number}. {s.englishName} ({s.name})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">From {ayahCount ? `(1–${ayahCount})` : ''}</label>
          <input type="number" min={1} max={ayahCount || undefined} value={value.quranAyah ?? ''} disabled={!value.quranSurah}
            onChange={e => { const n = Number(e.target.value); if (n > 0) handleFromChange(n) }}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800 disabled:bg-gray-50 disabled:text-gray-400" placeholder="Ayah #" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To <span className="text-gray-400">(optional)</span></label>
          <input type="number" min={value.quranAyah ?? 1} max={ayahCount || undefined} value={value.quranAyahEnd ?? ''} disabled={!value.quranAyah}
            onChange={e => { const n = Number(e.target.value); if (n > 0) handleToChange(n) }}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800 disabled:bg-gray-50 disabled:text-gray-400" placeholder="Ayah #" />
        </div>
      </div>
      {loadingVerse && <div className="flex items-center gap-2 text-sm text-gray-500"><div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />Loading verses…</div>}
      {error && <p className="text-red-500 text-xs">{error}</p>}
      {value.quranArabic && !loadingVerse && (
        <div className="bg-green-50 rounded-xl p-4 border border-green-100">
          <p className="text-right text-lg text-gray-900 leading-loose mb-2">{value.quranArabic}</p>
          <p className="text-sm text-gray-700 italic">{value.quranEnglish}</p>
          <p className="text-xs text-green-700 font-medium mt-2">Surah {value.quranSurahName} {rangeLabel}</p>
        </div>
      )}
    </div>
  )
}

type MediaType = 'image' | 'video'

function MediaUploader({ imageUrl, videoUrl, onImageChange, onVideoChange, mosqueId, adminFetch }: {
  imageUrl: string; videoUrl: string
  onImageChange: (url: string) => void; onVideoChange: (url: string) => void
  mosqueId: string; adminFetch: ReturnType<typeof useAdminFetch>
}) {
  const [mediaType, setMediaType] = useState<MediaType>(videoUrl ? 'video' : 'image')
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const imageRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLInputElement>(null)

  async function uploadImage(file: File) {
    if (!file.type.startsWith('image/')) { setError('Please select an image file.'); return }
    if (file.size > 10_000_000) { setError('Image must be under 10MB.'); return }
    setError(''); setUploading(true)
    try {
      const { data: p } = await adminFetch(`/mosques/${mosqueId}/upload-params`).then(r => r.json())
      const fd = new FormData()
      fd.append('file', file); fd.append('api_key', p.apiKey)
      fd.append('timestamp', String(p.timestamp)); fd.append('signature', p.signature)
      fd.append('folder', p.folder)
      const res = await fetch(`https://api.cloudinary.com/v1_1/${p.cloudName}/image/upload`, { method: 'POST', body: fd })
      const data = await res.json()
      if (data.secure_url) onImageChange(data.secure_url)
      else setError(data.error?.message ?? 'Upload failed.')
    } catch { setError('Upload failed.') } finally { setUploading(false) }
  }

  async function uploadVideo(file: File) {
    if (!file.type.startsWith('video/')) { setError('Please select a video file.'); return }
    if (file.size > 200_000_000) { setError('Video must be under 200MB.'); return }
    setError(''); setUploading(true); setProgress(0)
    try {
      const { data: p } = await adminFetch(`/mosques/${mosqueId}/upload-params/video`).then(r => r.json())
      const fd = new FormData()
      fd.append('file', file); fd.append('api_key', p.apiKey)
      fd.append('timestamp', String(p.timestamp)); fd.append('signature', p.signature)
      fd.append('folder', p.folder); fd.append('resource_type', 'video')
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.round(e.loaded / e.total * 100)) }
        xhr.onload = () => {
          const data = JSON.parse(xhr.responseText)
          if (data.secure_url) { onVideoChange(data.secure_url); resolve() }
          else reject(new Error(data.error?.message ?? 'Upload failed'))
        }
        xhr.onerror = () => reject(new Error('Network error'))
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${p.cloudName}/video/upload`)
        xhr.send(fd)
      })
    } catch (err: any) { setError(err.message ?? 'Upload failed.') }
    finally { setUploading(false); setProgress(0) }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) mediaType === 'image' ? uploadImage(file) : uploadVideo(file)
  }, [mediaType, mosqueId])

  const currentValue = mediaType === 'image' ? imageUrl : videoUrl

  return (
    <div>
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-3 w-fit">
        {(['image', 'video'] as const).map(t => (
          <button key={t} type="button" onClick={() => { setMediaType(t); setError('') }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${mediaType === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t === 'image' ? '🖼️ Image' : '🎬 Video'}
          </button>
        ))}
      </div>
      {currentValue ? (
        <div className="relative rounded-xl overflow-hidden border border-gray-200">
          {mediaType === 'image'
            ? <img src={imageUrl} alt="Preview" className="w-full max-h-48 object-cover" />
            : <video src={videoUrl} controls className="w-full max-h-48" />}
          <button type="button"
            onClick={() => mediaType === 'image' ? onImageChange('') : onVideoChange('')}
            className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm hover:bg-black/80">✕</button>
        </div>
      ) : (
        <div onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)}
          onDrop={onDrop} onClick={() => mediaType === 'image' ? imageRef.current?.click() : videoRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${dragging ? 'border-green-600 bg-green-50' : 'border-gray-200 hover:border-green-400 hover:bg-gray-50'}`}>
          <input ref={imageRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = '' }} />
          <input ref={videoRef} type="file" accept="video/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadVideo(f); e.target.value = '' }} />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">{mediaType === 'video' && progress > 0 ? `Uploading... ${progress}%` : 'Uploading...'}</p>
              {mediaType === 'video' && progress > 0 && (
                <div className="w-full max-w-xs bg-gray-200 rounded-full h-1.5">
                  <div className="bg-green-600 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl">{mediaType === 'image' ? '🖼️' : '🎬'}</span>
              <p className="text-sm font-medium text-gray-700">{mediaType === 'image' ? 'Drop image or click to upload' : 'Drop video or click to upload'}</p>
              <p className="text-xs text-gray-400">{mediaType === 'image' ? 'JPG, PNG, WebP · Max 10MB' : 'MP4, MOV, WebM · Max 200MB'}</p>
            </div>
          )}
        </div>
      )}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}

function EventEngagementPanel({ eventId, rsvpCount, adminFetch }: { eventId: string; rsvpCount: number; adminFetch: ReturnType<typeof useAdminFetch> }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-event-rsvps', eventId],
    queryFn: () => adminFetch(`/events/${eventId}/rsvps`).then(r => r.json()),
  })
  const rsvps: any[] = data?.data?.items ?? []
  const counts = data?.data?.counts ?? { GOING: 0, MAYBE: 0, NOT_GOING: 0 }

  return (
    <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
      <div className="flex items-center gap-6 mb-4">
        <div className="text-center">
          <p className="text-xl font-bold text-green-700">{counts.GOING}</p>
          <p className="text-xs text-gray-400 mt-0.5">Going</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-amber-500">{counts.MAYBE}</p>
          <p className="text-xs text-gray-400 mt-0.5">Maybe</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-gray-400">{counts.NOT_GOING}</p>
          <p className="text-xs text-gray-400 mt-0.5">Not Going</p>
        </div>
      </div>
      <p className="text-xs font-semibold text-gray-500 uppercase mb-3">RSVPs</p>
      {isLoading && <p className="text-sm text-gray-400">Loading...</p>}
      {!isLoading && rsvps.length === 0 && <p className="text-sm text-gray-400">No RSVPs yet.</p>}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {rsvps.map((r: any) => (
          <div key={r.id} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2 border border-gray-100">
            <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-800 flex-shrink-0">
              {(r.user?.name ?? '?')[0].toUpperCase()}
            </div>
            <p className="text-sm text-gray-700 flex-1">{r.user?.name ?? 'Unknown'}</p>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              r.status === 'GOING' ? 'bg-green-100 text-green-700'
              : r.status === 'MAYBE' ? 'bg-amber-100 text-amber-600'
              : 'bg-gray-100 text-gray-500'
            }`}>{r.status === 'NOT_GOING' ? 'Not Going' : r.status === 'GOING' ? 'Going' : 'Maybe'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function EventsPage() {
  const { mosqueId } = useParams<{ mosqueId: string }>()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [engagementId, setEngagementId] = useState<string | null>(null)
  const [form, setForm] = useState(DEFAULT_FORM)
  const adminFetch = useAdminFetch()

  const { data } = useQuery({
    queryKey: ['admin-events', mosqueId],
    queryFn: () => adminFetch(`/mosques/${mosqueId}/events?upcoming=false&limit=50`).then(r => r.json()),
  })

  const createMutation = useMutation({
    mutationFn: () => adminFetch(`/mosques/${mosqueId}/events`, {
      method: 'POST',
      body: JSON.stringify({
        ...form,
        startTime: new Date(form.startTime).toISOString(),
        endTime: form.endTime ? new Date(form.endTime).toISOString() : undefined,
        maxAttendees: form.maxAttendees ? parseInt(form.maxAttendees) : undefined,
        imageUrl: form.imageUrl || undefined,
        videoUrl: form.videoUrl || undefined,
        isPrivate: form.isPrivate,
        quranSurah: form.quranSurah || undefined,
        quranAyah: form.quranAyah || undefined,
        quranAyahEnd: form.quranAyahEnd || undefined,
        quranSurahName: form.quranSurahName || undefined,
        quranArabic: form.quranArabic || undefined,
        quranEnglish: form.quranEnglish || undefined,
      }),
    }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-events', mosqueId] })
      closeForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: () => adminFetch(`/events/${editingId}`, {
      method: 'PUT',
      body: JSON.stringify({
        ...form,
        startTime: new Date(form.startTime).toISOString(),
        endTime: form.endTime ? new Date(form.endTime).toISOString() : undefined,
        maxAttendees: form.maxAttendees ? parseInt(form.maxAttendees) : undefined,
        imageUrl: form.imageUrl || undefined,
        videoUrl: form.videoUrl || undefined,
        isPrivate: form.isPrivate,
        quranSurah: form.quranSurah,
        quranAyah: form.quranAyah,
        quranAyahEnd: form.quranAyahEnd,
        quranSurahName: form.quranSurahName || null,
        quranArabic: form.quranArabic || null,
        quranEnglish: form.quranEnglish || null,
      }),
    }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-events', mosqueId] })
      closeForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminFetch(`/events/${id}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-events', mosqueId] }),
  })

  function openEdit(e: any) {
    setEditingId(e.id)
    setForm({
      title: e.title ?? '',
      description: e.description ?? '',
      category: e.category ?? 'GENERAL',
      startTime: e.startTime ? format(new Date(e.startTime), "yyyy-MM-dd'T'HH:mm") : '',
      endTime: e.endTime ? format(new Date(e.endTime), "yyyy-MM-dd'T'HH:mm") : '',
      location: e.location ?? '',
      requiresRsvp: e.requiresRsvp ?? true,
      isOnline: e.isOnline ?? false,
      maxAttendees: e.maxAttendees ? String(e.maxAttendees) : '',
      imageUrl: e.imageUrl ?? '',
      videoUrl: e.videoUrl ?? '',
      isPrivate: e.isPrivate ?? false,
      quranSurah: e.quranSurah ?? null,
      quranAyah: e.quranAyah ?? null,
      quranAyahEnd: e.quranAyahEnd ?? null,
      quranSurahName: e.quranSurahName ?? '',
      quranArabic: e.quranArabic ?? '',
      quranEnglish: e.quranEnglish ?? '',
    })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(DEFAULT_FORM)
  }

  const allEvents = data?.data?.items ?? []
  const isEditing = !!editingId
  const isBusy = createMutation.isPending || updateMutation.isPending

  // Admin Bug 3 fix: local sort & filter state
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'upcoming'>('upcoming')
  const [filterStatus, setFilterStatus] = useState<'all' | 'upcoming' | 'past' | 'cancelled'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const now = new Date()
  const events = allEvents
    .filter((e: any) => {
      if (filterStatus === 'upcoming') return !e.isCancelled && new Date(e.startTime) >= now
      if (filterStatus === 'past') return !e.isCancelled && new Date(e.startTime) < now
      if (filterStatus === 'cancelled') return e.isCancelled
      return true
    })
    .filter((e: any) =>
      searchQuery === '' || e.title.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a: any, b: any) => {
      if (sortOrder === 'newest') return new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      if (sortOrder === 'oldest') return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      // 'upcoming': soonest first (past events at the bottom)
      const aTime = new Date(a.startTime).getTime()
      const bTime = new Date(b.startTime).getTime()
      const aFuture = aTime >= now.getTime()
      const bFuture = bTime >= now.getTime()
      if (aFuture && !bFuture) return -1
      if (!aFuture && bFuture) return 1
      return aTime - bTime
    })

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Events</h1>
          <p className="text-gray-500 text-sm mt-1">Create and manage mosque events</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="bg-green-800 text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-green-900">
            + New Event
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-5">{isEditing ? 'Edit Event' : 'New Event'}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Event Title *</label>
              <input className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800"
                value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Event title" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900"
                value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900"
                value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Main Hall" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date & Time *</label>
              <input type="datetime-local" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900"
                value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date & Time</label>
              <input type="datetime-local" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900"
                value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 h-24 resize-none"
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Event description..." />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Media (optional)</label>
              <MediaUploader
                imageUrl={form.imageUrl} videoUrl={form.videoUrl}
                onImageChange={url => setForm(f => ({ ...f, imageUrl: url }))}
                onVideoChange={url => setForm(f => ({ ...f, videoUrl: url }))}
                mosqueId={mosqueId} adminFetch={adminFetch}
              />
            </div>
            <div className="col-span-2">
              <QuranVersePicker
                value={{ quranSurah: form.quranSurah, quranAyah: form.quranAyah, quranAyahEnd: form.quranAyahEnd, quranSurahName: form.quranSurahName, quranArabic: form.quranArabic, quranEnglish: form.quranEnglish }}
                onChange={v => setForm(f => ({ ...f, ...v }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="rsvp" checked={form.requiresRsvp}
                onChange={e => setForm(f => ({ ...f, requiresRsvp: e.target.checked }))} className="rounded" />
              <label htmlFor="rsvp" className="text-sm text-gray-700">Enable RSVP</label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isPrivate" checked={form.isPrivate}
                onChange={e => setForm(f => ({ ...f, isPrivate: e.target.checked }))} className="rounded" />
              <label htmlFor="isPrivate" className="text-sm text-gray-700">
                🔒 Private <span className="text-gray-400 font-normal">(only visible to followers)</span>
              </label>
            </div>
            {form.requiresRsvp && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">RSVP Limit <span className="text-gray-400 font-normal">(optional)</span></label>
                <input type="number" min="1" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900"
                  value={form.maxAttendees} onChange={e => setForm(f => ({ ...f, maxAttendees: e.target.value }))} placeholder="e.g. 200" />
              </div>
            )}
          </div>
          <div className="flex gap-3 mt-5">
            <button
              onClick={() => isEditing ? updateMutation.mutate() : createMutation.mutate()}
              disabled={isBusy || !form.title || !form.startTime}
              className="bg-green-800 text-white rounded-xl px-5 py-2 text-sm font-medium hover:bg-green-900 disabled:opacity-50">
              {isBusy ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Event'}
            </button>
            <button onClick={closeForm} className="border border-gray-200 text-gray-600 rounded-xl px-5 py-2 text-sm font-medium hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Admin Bug 3: Sort & filter controls */}
      {!showForm && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search events…"
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800 flex-1 min-w-[180px]"
          />
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as any)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800"
          >
            <option value="all">All</option>
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            value={sortOrder}
            onChange={e => setSortOrder(e.target.value as any)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800"
          >
            <option value="upcoming">Soonest first</option>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
      )}

      <div className="space-y-3">
        {events.length === 0 && !showForm && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📅</p>
            <p>No events yet. Create your first event above.</p>
          </div>
        )}
        {events.map((e: any) => (
          <div key={e.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {e.imageUrl && <img src={e.imageUrl} alt={e.title} className="w-full h-36 object-cover" />}
            {e.videoUrl && !e.imageUrl && (
              <video src={e.videoUrl} controls className="w-full max-h-36 bg-black" />
            )}
            <div className="p-5 flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-green-50 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">{e.category}</span>
                  {e.isPrivate && <span className="bg-gray-100 text-gray-500 text-xs font-medium px-2 py-0.5 rounded-full">🔒 Private</span>}
                  {e.isCancelled && <span className="bg-red-50 text-red-600 text-xs font-medium px-2 py-0.5 rounded-full">Cancelled</span>}
                  {e.quranSurah && <span className="bg-green-50 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">📖 {e.quranSurahName} {e.quranSurah}:{e.quranAyah}{e.quranAyahEnd && e.quranAyahEnd !== e.quranAyah ? `–${e.quranAyahEnd}` : ''}</span>}
                </div>
                <p className="text-gray-900 font-semibold">{e.title}</p>
                <p className="text-gray-500 text-sm mt-1">
                  {format(new Date(e.startTime), 'EEE, MMM d, yyyy · h:mm a')}
                  {e.location ? ` · ${e.location}` : ''}
                </p>
                <p className="text-gray-400 text-xs mt-1">
                  {e.rsvpCount ?? 0} RSVPs{e.maxAttendees ? ` / ${e.maxAttendees} max` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3 ml-4 shrink-0">
                <button
                  onClick={() => setEngagementId(engagementId === e.id ? null : e.id)}
                  className={`text-sm transition-colors ${engagementId === e.id ? 'text-green-700 font-medium' : 'text-gray-400 hover:text-green-700'}`}
                >
                  {engagementId === e.id ? 'Hide' : '📊 Stats'}
                </button>
                <button onClick={() => openEdit(e)} className="text-gray-400 hover:text-green-700 text-sm transition-colors">Edit</button>
                <button
                  onClick={() => { if (confirm('Delete this event?')) deleteMutation.mutate(e.id) }}
                  className="text-gray-400 hover:text-red-500 text-sm transition-colors">
                  Delete
                </button>
              </div>
            </div>
            {engagementId === e.id && (
              <EventEngagementPanel eventId={e.id} rsvpCount={e.rsvpCount ?? 0} adminFetch={adminFetch} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
