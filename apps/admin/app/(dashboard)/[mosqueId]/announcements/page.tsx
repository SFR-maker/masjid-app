'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow, format } from 'date-fns'
import { useAdminFetch } from '../../../../lib/adminFetch'

const DEFAULT_FORM = {
  title: '', body: '', priority: 'NORMAL', isPinned: false,
  imageUrl: '', videoUrl: '', publishAt: '', expiresAt: '',
  quranSurah: null as number | null,
  quranAyah: null as number | null,
  quranAyahEnd: null as number | null,
  quranSurahName: '',
  quranArabic: '',
  quranEnglish: '',
}

type MediaType = 'image' | 'video'

function MediaUploader({ imageUrl, videoUrl, onImageChange, onVideoChange, mosqueId, adminFetch }: {
  imageUrl: string
  videoUrl: string
  onImageChange: (url: string) => void
  onVideoChange: (url: string) => void
  mosqueId: string
  adminFetch: ReturnType<typeof useAdminFetch>
}) {
  const [mediaType, setMediaType] = useState<MediaType>(videoUrl ? 'video' : 'image')
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  async function uploadImage(file: File) {
    if (!file.type.startsWith('image/')) { setError('Please select an image file.'); return }
    if (file.size > 10_000_000) { setError('Image must be under 10MB.'); return }
    setError('')
    setUploading(true)
    try {
      const paramsRes = await adminFetch(`/mosques/${mosqueId}/upload-params`)
      const { data: p } = await paramsRes.json()
      const fd = new FormData()
      fd.append('file', file)
      fd.append('api_key', p.apiKey)
      fd.append('timestamp', String(p.timestamp))
      fd.append('signature', p.signature)
      fd.append('folder', p.folder)
      const res = await fetch(`https://api.cloudinary.com/v1_1/${p.cloudName}/image/upload`, { method: 'POST', body: fd })
      const data = await res.json()
      if (data.secure_url) {
        onImageChange(data.secure_url)
      } else {
        setError(data.error?.message ?? 'Upload failed. Please try again.')
      }
    } catch {
      setError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  async function uploadVideo(file: File) {
    if (!file.type.startsWith('video/')) { setError('Please select a video file.'); return }
    if (file.size > 200_000_000) { setError('Video must be under 200MB.'); return }
    setError('')
    setUploading(true)
    setProgress(0)
    try {
      const paramsRes = await adminFetch(`/mosques/${mosqueId}/upload-params/video`)
      const { data: p } = await paramsRes.json()
      const fd = new FormData()
      fd.append('file', file)
      fd.append('api_key', p.apiKey)
      fd.append('timestamp', String(p.timestamp))
      fd.append('signature', p.signature)
      fd.append('folder', p.folder)
      fd.append('resource_type', 'video')

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
        }
        xhr.onload = () => {
          const data = JSON.parse(xhr.responseText)
          if (data.secure_url) {
            onVideoChange(data.secure_url)
            resolve()
          } else {
            reject(new Error(data.error?.message ?? 'Upload failed'))
          }
        }
        xhr.onerror = () => reject(new Error('Network error'))
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${p.cloudName}/video/upload`)
        xhr.send(fd)
      })
    } catch (err: any) {
      setError(err.message ?? 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    if (mediaType === 'image') uploadImage(file)
    else uploadVideo(file)
  }, [mediaType, mosqueId])

  const currentValue = mediaType === 'image' ? imageUrl : videoUrl
  const hasMedia = !!currentValue

  return (
    <div>
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-3 w-fit">
        {(['image', 'video'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => { setMediaType(t); setError('') }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${mediaType === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t === 'image' ? '🖼️ Image' : '🎬 Video'}
          </button>
        ))}
      </div>

      {hasMedia ? (
        <div className="relative rounded-xl overflow-hidden border border-gray-200">
          {mediaType === 'image' ? (
            <img src={imageUrl} alt="Preview" className="w-full max-h-48 object-cover" />
          ) : (
            <video src={videoUrl} controls className="w-full max-h-48" />
          )}
          <button
            type="button"
            onClick={() => mediaType === 'image' ? onImageChange('') : onVideoChange('')}
            className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm hover:bg-black/80"
          >
            ✕
          </button>
        </div>
      ) : (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => mediaType === 'image' ? imageInputRef.current?.click() : videoInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            dragging ? 'border-green-600 bg-green-50' : 'border-gray-200 hover:border-green-400 hover:bg-gray-50'
          }`}
        >
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = '' }} />
          <input ref={videoInputRef} type="file" accept="video/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadVideo(f); e.target.value = '' }} />

          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">
                {mediaType === 'video' && progress > 0 ? `Uploading... ${progress}%` : 'Uploading...'}
              </p>
              {mediaType === 'video' && progress > 0 && (
                <div className="w-full max-w-xs bg-gray-200 rounded-full h-1.5">
                  <div className="bg-green-600 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <span className="text-3xl">{mediaType === 'image' ? '🖼️' : '🎬'}</span>
              <p className="text-sm font-medium text-gray-700">
                {mediaType === 'image' ? 'Drop image here or click to upload' : 'Drop video here or click to upload'}
              </p>
              <p className="text-xs text-gray-400">
                {mediaType === 'image' ? 'JPG, PNG, WebP · Max 10MB' : 'MP4, MOV, WebM · Max 200MB'}
              </p>
            </div>
          )}
        </div>
      )}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}

// ─── Qur'an Verse Picker ───────────────────────────────────────────────────

interface QuranFormFields {
  quranSurah: number | null
  quranAyah: number | null
  quranAyahEnd: number | null
  quranSurahName: string
  quranArabic: string
  quranEnglish: string
}

function QuranVersePicker({ value, onChange }: {
  value: QuranFormFields
  onChange: (v: QuranFormFields) => void
}) {
  const [ayahCount, setAyahCount] = useState<number>(0)
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
      const surah = surahs.find(s => s.number === value.quranSurah)
      if (surah) setAyahCount(surah.numberOfAyahs)
    }
  }, [value.quranSurah, surahs.length])

  async function handleSurahChange(surahNum: number) {
    setError('')
    const surah = surahs.find(s => s.number === surahNum)
    setAyahCount(surah?.numberOfAyahs ?? 0)
    onChange({ quranSurah: surahNum, quranAyah: null, quranAyahEnd: null, quranSurahName: surah?.englishName ?? '', quranArabic: '', quranEnglish: '' })
  }

  async function fetchRange(surah: number, from: number, to: number) {
    setLoadingVerse(true)
    setError('')
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
    } catch {
      setError('Could not load verses. Check your connection.')
    } finally {
      setLoadingVerse(false)
    }
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

  function clearVerse() {
    onChange({ quranSurah: null, quranAyah: null, quranAyahEnd: null, quranSurahName: '', quranArabic: '', quranEnglish: '' })
    setAyahCount(0)
  }

  const hasVerse = value.quranArabic && value.quranEnglish
  const rangeLabel = value.quranAyahEnd && value.quranAyahEnd !== value.quranAyah
    ? `${value.quranSurah}:${value.quranAyah}–${value.quranAyahEnd}`
    : `${value.quranSurah}:${value.quranAyah}`

  return (
    <div className="border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-700">📖 Qur'an Verse (optional)</span>
        {value.quranSurah && (
          <button type="button" onClick={clearVerse} className="text-xs text-red-400 hover:text-red-600">Remove</button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="col-span-1">
          <label className="block text-xs text-gray-500 mb-1">Surah</label>
          <select
            value={value.quranSurah ?? ''}
            onChange={e => e.target.value ? handleSurahChange(Number(e.target.value)) : clearVerse()}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800"
          >
            <option value="">Select Surah…</option>
            {surahs.map((s: any) => (
              <option key={s.number} value={s.number}>
                {s.number}. {s.englishName} ({s.name})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">From {ayahCount ? `(1–${ayahCount})` : ''}</label>
          <input
            type="number" min={1} max={ayahCount || undefined}
            value={value.quranAyah ?? ''} disabled={!value.quranSurah}
            onChange={e => { const n = Number(e.target.value); if (n > 0) handleFromChange(n) }}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800 disabled:bg-gray-50 disabled:text-gray-400"
            placeholder="Ayah #"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To <span className="text-gray-400">(optional)</span></label>
          <input
            type="number" min={value.quranAyah ?? 1} max={ayahCount || undefined}
            value={value.quranAyahEnd ?? ''} disabled={!value.quranAyah}
            onChange={e => { const n = Number(e.target.value); if (n > 0) handleToChange(n) }}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800 disabled:bg-gray-50 disabled:text-gray-400"
            placeholder="Ayah #"
          />
        </div>
      </div>

      {loadingVerse && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          Loading verses…
        </div>
      )}

      {error && <p className="text-red-500 text-xs">{error}</p>}

      {hasVerse && !loadingVerse && (
        <div className="bg-green-50 rounded-xl p-4 border border-green-100 mt-1">
          <p className="text-right text-lg text-gray-900 font-arabic leading-loose mb-2">{value.quranArabic}</p>
          <p className="text-sm text-gray-700 italic leading-relaxed">{value.quranEnglish}</p>
          <p className="text-xs text-green-700 font-medium mt-2">
            Surah {value.quranSurahName} {rangeLabel}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────

function EngagementPanel({ announcement, adminFetch }: { announcement: any; adminFetch: ReturnType<typeof useAdminFetch> }) {
  const PAGE_SIZE = 20
  const queryClient = useQueryClient()

  const {
    data,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ['admin-ann-comments', announcement.id],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => {
      const url = `/announcements/${announcement.id}/comments?limit=${PAGE_SIZE}${pageParam ? `&cursor=${pageParam}` : ''}`
      return adminFetch(url).then(r => r.json())
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: any) =>
      lastPage?.data?.hasMore ? lastPage?.data?.cursor : undefined,
  })

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) =>
      adminFetch(`/announcements/comments/${commentId}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-ann-comments', announcement.id] }),
  })

  const allComments: any[] = data?.pages.flatMap((p: any) => p?.data?.items ?? []) ?? []

  return (
    <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
      {/* Stats row */}
      <div className="flex items-center gap-6 mb-4">
        <div className="text-center">
          <p className="text-xl font-bold text-red-500">{announcement.likeCount ?? 0}</p>
          <p className="text-xs text-gray-400 mt-0.5">Likes</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-green-700">{announcement.commentCount ?? 0}</p>
          <p className="text-xs text-gray-400 mt-0.5">Comments</p>
        </div>
      </div>

      <p className="text-xs font-semibold text-gray-500 uppercase mb-3">
        Comments{allComments.length > 0 ? ` (${allComments.length}${hasNextPage ? '+' : ''})` : ''}
      </p>

      {isLoading && <p className="text-sm text-gray-400">Loading…</p>}
      {!isLoading && allComments.length === 0 && (
        <p className="text-sm text-gray-400">No comments yet.</p>
      )}

      <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
        {allComments.map((c: any) => (
          <div key={c.id} className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-800 flex-shrink-0">
              {(c.user?.name ?? '?')[0].toUpperCase()}
            </div>
            <div className="flex-1 bg-white rounded-xl px-3 py-2 border border-gray-100">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-700">{c.user?.name ?? 'Unknown'}</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleDateString()}</p>
                  <button
                    onClick={() => { if (confirm('Delete this comment?')) deleteCommentMutation.mutate(c.id) }}
                    className="text-gray-300 hover:text-red-500 text-xs transition-colors"
                    title="Delete comment"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-700 mt-0.5">{c.text}</p>
              {c.quranSurahName && (
                <p className="text-xs text-green-700 mt-1">
                  📖 {c.quranSurahName} {c.quranSurah}:{c.quranAyah}
                  {c.quranAyahEnd && c.quranAyahEnd !== c.quranAyah ? `–${c.quranAyahEnd}` : ''}
                </p>
              )}
            </div>
          </div>
        ))}

        {hasNextPage && (
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="w-full text-xs text-green-700 font-medium py-2 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
          >
            {isFetchingNextPage ? 'Loading more…' : 'Load more comments'}
          </button>
        )}
      </div>
    </div>
  )
}

const DEFAULT_POLL_FORM = { question: '', options: ['', ''], endsAt: '' }

export default function AnnouncementsPage() {
  const { mosqueId } = useParams<{ mosqueId: string }>()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'announcements' | 'polls'>('announcements')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [engagementId, setEngagementId] = useState<string | null>(null)
  const [form, setForm] = useState(DEFAULT_FORM)
  const adminFetch = useAdminFetch()

  // Polls state
  const [showPollForm, setShowPollForm] = useState(false)
  const [pollForm, setPollForm] = useState(DEFAULT_POLL_FORM)

  const { data } = useQuery({
    queryKey: ['admin-announcements', mosqueId],
    queryFn: () => adminFetch(`/mosques/${mosqueId}/announcements?limit=50`).then(r => r.json()),
  })

  const { data: pollsData } = useQuery({
    queryKey: ['admin-polls', mosqueId],
    queryFn: () => adminFetch(`/mosques/${mosqueId}/polls`).then(r => r.json()),
    refetchInterval: 10_000,
  })

  const createPollMutation = useMutation({
    mutationFn: () => adminFetch(`/mosques/${mosqueId}/polls`, {
      method: 'POST',
      body: JSON.stringify({
        question: pollForm.question,
        options: pollForm.options.filter(o => o.trim()),
        endsAt: pollForm.endsAt || undefined,
      }),
    }).then(async r => {
      const json = await r.json()
      if (!r.ok) throw new Error(json?.error ?? `Request failed (${r.status})`)
      return json
    }),
    onSuccess: (res) => {
      // Add new poll directly to cache for instant display
      queryClient.setQueryData(['admin-polls', mosqueId], (old: any) => {
        const newPoll = res?.data ?? res
        if (!newPoll?.id) return old
        const existing = old?.data?.items ?? []
        return { ...old, data: { items: [{ ...newPoll, totalVotes: 0, userVote: null }, ...existing] } }
      })
      queryClient.invalidateQueries({ queryKey: ['admin-polls', mosqueId] })
      // Auto-announcement was created server-side — refresh announcements list
      queryClient.invalidateQueries({ queryKey: ['admin-announcements', mosqueId] })
      setShowPollForm(false)
      setPollForm(DEFAULT_POLL_FORM)
    },
    onError: (err: any) => {
      console.error('Poll creation failed:', err?.message)
    },
  })

  const deletePollMutation = useMutation({
    mutationFn: (id: string) => adminFetch(`/polls/${id}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-polls', mosqueId] }),
  })

  const createMutation = useMutation({
    mutationFn: () => adminFetch(`/mosques/${mosqueId}/announcements`, {
      method: 'POST',
      body: JSON.stringify({
        ...form,
        imageUrl: form.imageUrl || undefined,
        videoUrl: form.videoUrl || undefined,
        publishAt: form.publishAt || undefined,
        expiresAt: form.expiresAt || undefined,
        quranSurah: form.quranSurah || undefined,
        quranAyah: form.quranAyah || undefined,
        quranAyahEnd: form.quranAyahEnd || undefined,
        quranSurahName: form.quranSurahName || undefined,
        quranArabic: form.quranArabic || undefined,
        quranEnglish: form.quranEnglish || undefined,
      }),
    }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-announcements', mosqueId] })
      setShowForm(false)
      setForm(DEFAULT_FORM)
    },
  })

  const updateMutation = useMutation({
    mutationFn: () => adminFetch(`/announcements/${editingId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...form,
        imageUrl: form.imageUrl || undefined,
        videoUrl: form.videoUrl || undefined,
        publishAt: form.publishAt || undefined,
        expiresAt: form.expiresAt || undefined,
        quranSurah: form.quranSurah,
        quranAyah: form.quranAyah,
        quranAyahEnd: form.quranAyahEnd,
        quranSurahName: form.quranSurahName || null,
        quranArabic: form.quranArabic || null,
        quranEnglish: form.quranEnglish || null,
      }),
    }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-announcements', mosqueId] })
      setShowForm(false)
      setEditingId(null)
      setForm(DEFAULT_FORM)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminFetch(`/announcements/${id}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-announcements', mosqueId] }),
  })

  function openEdit(a: any) {
    setForm({
      title: a.title,
      body: a.body,
      priority: a.priority,
      isPinned: a.isPinned,
      imageUrl: a.imageUrl ?? '',
      videoUrl: a.videoUrl ?? '',
      publishAt: a.publishAt ? format(new Date(a.publishAt), "yyyy-MM-dd'T'HH:mm") : '',
      expiresAt: a.expiresAt ? format(new Date(a.expiresAt), "yyyy-MM-dd'T'HH:mm") : '',
      quranSurah: a.quranSurah ?? null,
      quranAyah: a.quranAyah ?? null,
      quranAyahEnd: a.quranAyahEnd ?? null,
      quranSurahName: a.quranSurahName ?? '',
      quranArabic: a.quranArabic ?? '',
      quranEnglish: a.quranEnglish ?? '',
    })
    setEditingId(a.id)
    setShowForm(true)
  }

  const announcements = data?.data?.items ?? []
  const polls = pollsData?.data?.items ?? []
  const isScheduled = form.publishAt && new Date(form.publishAt) > new Date()

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
          <p className="text-gray-500 text-sm mt-1">Send updates to your followers</p>
        </div>
        {activeTab === 'announcements' ? (
          <button onClick={() => { setEditingId(null); setForm(DEFAULT_FORM); setShowForm(true) }} className="bg-green-800 text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-green-900">
            + New Announcement
          </button>
        ) : (
          <button onClick={() => { setShowPollForm(true) }} className="bg-green-800 text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-green-900">
            + New Poll
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {(['announcements', 'polls'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setShowForm(false); setShowPollForm(false) }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
              activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'announcements' ? '📢 Announcements' : '📊 Polls'}
          </button>
        ))}
      </div>

      {activeTab === 'polls' && (
        <>
          {showPollForm && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-5">New Poll</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Question *</label>
                  <input
                    type="text"
                    value={pollForm.question}
                    onChange={e => setPollForm(f => ({ ...f, question: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800"
                    placeholder="Ask your community a question…"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Options * (2–6)</label>
                  <div className="space-y-2">
                    {pollForm.options.map((opt, i) => (
                      <div key={i} className="flex gap-2">
                        <input
                          type="text"
                          value={opt}
                          onChange={e => setPollForm(f => {
                            const options = [...f.options]
                            options[i] = e.target.value
                            return { ...f, options }
                          })}
                          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800"
                          placeholder={`Option ${i + 1}`}
                        />
                        {pollForm.options.length > 2 && (
                          <button
                            type="button"
                            onClick={() => setPollForm(f => ({ ...f, options: f.options.filter((_, idx) => idx !== i) }))}
                            className="text-gray-400 hover:text-red-500 px-2"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {pollForm.options.length < 6 && (
                    <button
                      type="button"
                      onClick={() => setPollForm(f => ({ ...f, options: [...f.options, ''] }))}
                      className="mt-2 text-sm text-green-700 hover:text-green-900 font-medium"
                    >
                      + Add option
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input
                    type="datetime-local"
                    value={pollForm.endsAt}
                    onChange={e => setPollForm(f => ({ ...f, endsAt: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => createPollMutation.mutate()}
                    disabled={createPollMutation.isPending || !pollForm.question || pollForm.options.filter(o => o.trim()).length < 2}
                    className="bg-green-800 text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-green-900 disabled:opacity-50"
                  >
                    {createPollMutation.isPending ? 'Creating…' : '📊 Create Poll'}
                  </button>
                  <button
                    onClick={() => { setShowPollForm(false); setPollForm(DEFAULT_POLL_FORM) }}
                    className="border border-gray-200 text-gray-600 rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
                {createPollMutation.isError && (
                  <p className="text-red-500 text-sm">{(createPollMutation.error as any)?.message ?? 'Failed to create poll. Please try again.'}</p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-3">
            {polls.length === 0 && !showPollForm && (
              <div className="text-center py-16 text-gray-400">
                <p className="text-4xl mb-3">📊</p>
                <p>No polls yet.</p>
              </div>
            )}
            {polls.map((p: any) => {
              const ended = p.endsAt ? new Date(p.endsAt) < new Date() : false
              return (
                <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {ended && <span className="bg-gray-100 text-gray-500 text-xs font-medium px-2 py-0.5 rounded-full">Ended</span>}
                        {p.endsAt && !ended && (
                          <span className="bg-amber-50 text-amber-600 text-xs font-medium px-2 py-0.5 rounded-full">
                            Ends {formatDistanceToNow(new Date(p.endsAt), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-gray-900 mb-3">{p.question}</p>
                      <div className="space-y-1.5">
                        {p.options.map((opt: any) => {
                          const pct = p.totalVotes > 0 ? Math.round((opt.voteCount / p.totalVotes) * 100) : 0
                          return (
                            <div key={opt.id} className="relative rounded-lg overflow-hidden border border-gray-100">
                              <div className="absolute inset-y-0 left-0 bg-green-50" style={{ width: `${pct}%` }} />
                              <div className="relative flex items-center justify-between px-3 py-2">
                                <span className="text-sm text-gray-700">{opt.text}</span>
                                <span className="text-xs font-medium text-gray-500 ml-2">{pct}% ({opt.voteCount})</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <p className="text-xs text-gray-400 mt-3">
                        {p.totalVotes} vote{p.totalVotes !== 1 ? 's' : ''} · Created {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    <button
                      onClick={() => { if (confirm('Delete this poll and all votes?')) deletePollMutation.mutate(p.id) }}
                      disabled={deletePollMutation.isPending}
                      className="text-gray-400 hover:text-red-500 text-sm transition-colors shrink-0 disabled:opacity-40"
                    >
                      {deletePollMutation.isPending ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {activeTab === 'announcements' && showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-5">{editingId ? 'Edit Announcement' : 'New Announcement'}</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800" placeholder="Announcement title" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
              <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 h-32 resize-none focus:outline-none focus:ring-2 focus:ring-green-800" placeholder="Write your announcement..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Media (optional)</label>
              <MediaUploader
                imageUrl={form.imageUrl}
                videoUrl={form.videoUrl}
                onImageChange={url => setForm(f => ({ ...f, imageUrl: url }))}
                onVideoChange={url => setForm(f => ({ ...f, videoUrl: url }))}
                mosqueId={mosqueId}
                adminFetch={adminFetch}
              />
            </div>

            {/* Qur'an verse picker */}
            <QuranVersePicker
              value={{
                quranSurah: form.quranSurah,
                quranAyah: form.quranAyah,
                quranAyahEnd: form.quranAyahEnd,
                quranSurahName: form.quranSurahName,
                quranArabic: form.quranArabic,
                quranEnglish: form.quranEnglish,
              }}
              onChange={v => setForm(f => ({ ...f, ...v }))}
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900">
                  <option value="NORMAL">Normal</option>
                  <option value="IMPORTANT">Important</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isPinned} onChange={e => setForm(f => ({ ...f, isPinned: e.target.checked }))} className="rounded" />
                  <span className="text-sm text-gray-700">Pin to top</span>
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Schedule Publish <span className="text-gray-400 font-normal">(optional)</span></label>
                <input type="datetime-local" value={form.publishAt} onChange={e => setForm(f => ({ ...f, publishAt: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800" />
                {isScheduled && <p className="text-xs text-amber-600 mt-1">⏰ Will publish on {format(new Date(form.publishAt), 'MMM d, h:mm a')}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expires At <span className="text-gray-400 font-normal">(optional)</span></label>
                <input type="datetime-local" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800" />
              </div>
            </div>
            <div className="flex gap-3">
              {editingId ? (
                <button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending || !form.title || !form.body}
                  className="bg-green-800 text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-green-900 disabled:opacity-50">
                  {updateMutation.isPending ? 'Saving...' : '💾 Save Changes'}
                </button>
              ) : (
                <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.title || !form.body}
                  className="bg-green-800 text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-green-900 disabled:opacity-50">
                  {createMutation.isPending ? 'Saving...' : isScheduled ? '⏰ Schedule Announcement' : '📢 Publish & Notify Followers'}
                </button>
              )}
              <button onClick={() => { setShowForm(false); setEditingId(null); setForm(DEFAULT_FORM) }}
                className="border border-gray-200 text-gray-600 rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
            </div>
            {(createMutation.isError || updateMutation.isError) && (
              <p className="text-red-500 text-sm">Failed to save announcement. Please try again.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'announcements' && <div className="space-y-3">
        {announcements.length === 0 && !showForm && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📢</p>
            <p>No announcements yet.</p>
          </div>
        )}
        {announcements.map((a: any) => (
          <div key={a.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {a.imageUrl && <img src={a.imageUrl} alt={a.title} className="w-full h-40 object-cover" />}
            {a.videoUrl && !a.imageUrl && (
              <video src={a.videoUrl} controls className="w-full max-h-48 bg-black" />
            )}
            <div className="p-5 flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  {a.isPinned && <span className="text-xs">📌</span>}
                  {!a.isPublished && <span className="bg-amber-100 text-amber-600 text-xs font-medium px-2 py-0.5 rounded-full">⏰ Scheduled</span>}
                  {a.priority === 'URGENT' && <span className="bg-red-100 text-red-600 text-xs font-medium px-2 py-0.5 rounded-full">Urgent</span>}
                  {a.priority === 'IMPORTANT' && <span className="bg-amber-100 text-amber-600 text-xs font-medium px-2 py-0.5 rounded-full">Important</span>}
                  {a.quranSurah && <span className="bg-green-50 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">📖 {a.quranSurahName} {a.quranSurah}:{a.quranAyah}{a.quranAyahEnd && a.quranAyahEnd !== a.quranAyah ? `–${a.quranAyahEnd}` : ''}</span>}
                  <p className="text-gray-900 font-semibold">{a.title}</p>
                </div>
                <p className="text-gray-500 text-sm leading-relaxed line-clamp-2">{a.body}</p>
                <p className="text-gray-400 text-xs mt-2">
                  {a.publishAt && !a.isPublished
                    ? `Scheduled for ${format(new Date(a.publishAt), 'MMM d, h:mm a')}`
                    : formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                </p>
              </div>
              <div className="ml-4 flex gap-3 shrink-0">
                <button
                  onClick={() => setEngagementId(engagementId === a.id ? null : a.id)}
                  className={`text-sm transition-colors ${engagementId === a.id ? 'text-green-700 font-medium' : 'text-gray-400 hover:text-green-700'}`}
                >
                  {engagementId === a.id ? 'Hide' : '📊 Stats'}
                </button>
                <button
                  onClick={() => openEdit(a)}
                  className="text-gray-400 hover:text-green-700 text-sm transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => { if (confirm('Delete this announcement?')) deleteMutation.mutate(a.id) }}
                  className="text-gray-400 hover:text-red-500 text-sm transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
            {engagementId === a.id && (
              <EngagementPanel announcement={a} adminFetch={adminFetch} />
            )}
          </div>
        ))}
      </div>}
    </div>
  )
}
