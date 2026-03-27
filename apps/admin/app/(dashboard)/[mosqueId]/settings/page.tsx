'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAdminFetch } from '../../../../lib/adminFetch'

const FEATURE_FLAGS = [
  { key: 'hasWomensPrayer', label: "Women's Prayer Area" },
  { key: 'hasYouthPrograms', label: 'Youth Programs' },
  { key: 'hasParking', label: 'Parking Available' },
  { key: 'isAccessible', label: 'Wheelchair Accessible' },
]

export default function SettingsPage() {
  const { mosqueId } = useParams<{ mosqueId: string }>()
  const queryClient = useQueryClient()
  const [saved, setSaved] = useState(false)
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<'basic' | 'location' | 'photos' | 'amenities' | 'programs' | 'social' | 'payments'>(
    searchParams.get('tab') === 'payments' ? 'payments' : 'basic'
  )
  const [form, setForm] = useState({
    name: '', slug: '', description: '', address: '',
    city: '', state: '', country: 'US', zipCode: '',
    phone: '', email: '', website: '', imamName: '',
    hasWomensPrayer: false, hasYouthPrograms: false,
    hasParking: false, isAccessible: false,
    capacityMen: '', capacityWomen: '',
    parkingInfo: '', directions: '',
    latitude: '', longitude: '',
    logoUrl: '', mainImageUrl: '',
    amenities: [] as string[],
    facebookUrl: '',
    twitterUrl: '',
    instagramUrl: '',
    youtubeUrl: '',
  })
  const [programs, setPrograms] = useState<any[]>([])
  const [programForm, setProgramForm] = useState({ name: '', description: '', schedule: '', ageGroup: '' })
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [mainImageUploading, setMainImageUploading] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const mainImageInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadQueue, setUploadQueue] = useState<{ id: string; file: File; preview: string; progress: number; error?: string }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const adminFetch = useAdminFetch()

  const { data } = useQuery({
    queryKey: ['mosque-settings', mosqueId],
    queryFn: () => adminFetch(`/mosques/${mosqueId}`).then((r) => r.json()),
  })

  const { data: photosData, refetch: refetchPhotos } = useQuery({
    queryKey: ['mosque-photos', mosqueId],
    queryFn: () => adminFetch(`/mosques/${mosqueId}`).then((r) => r.json()),
  })

  const photos = photosData?.data?.photos ?? []

  const { data: programsData, refetch: refetchPrograms } = useQuery({
    queryKey: ['mosque-programs', mosqueId],
    queryFn: () => adminFetch(`/mosques/${mosqueId}/programs`).then((r) => r.json()),
  })

  const { data: connectData, refetch: refetchConnect } = useQuery({
    queryKey: ['stripe-connect', mosqueId],
    queryFn: () => adminFetch(`/mosques/${mosqueId}/connect/status`).then((r) => r.json()),
    enabled: activeTab === 'payments',
    staleTime: 0,
  })
  const connectStatus = connectData?.data
  const [connectLoading, setConnectLoading] = useState(false)
  const [dashboardLoading, setDashboardLoading] = useState(false)

  const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL ?? window?.location?.origin ?? 'http://localhost:3000'

  async function handleConnectStripe() {
    setConnectLoading(true)
    try {
      const returnUrl = `${ADMIN_URL}/${mosqueId}/settings?tab=payments&stripe=success`
      const refreshUrl = `${ADMIN_URL}/${mosqueId}/settings?tab=payments&stripe=refresh`
      const res = await adminFetch(`/mosques/${mosqueId}/connect/onboard`, {
        method: 'POST',
        body: JSON.stringify({ returnUrl, refreshUrl }),
      })
      const json = await res.json()
      if (json?.data?.url) {
        window.location.href = json.data.url
      } else {
        alert(json?.error ?? 'Could not start Stripe onboarding. Please try again.')
        setConnectLoading(false)
      }
    } catch {
      alert('Could not connect to Stripe. Please try again.')
      setConnectLoading(false)
    }
  }

  async function handleOpenDashboard() {
    setDashboardLoading(true)
    try {
      const res = await adminFetch(`/mosques/${mosqueId}/connect/dashboard`)
      const json = await res.json()
      if (json?.data?.url) {
        window.open(json.data.url, '_blank')
      } else {
        alert(json?.error ?? 'Could not open Stripe dashboard.')
      }
    } catch {
      alert('Could not open Stripe dashboard. Please try again.')
    } finally {
      setDashboardLoading(false)
    }
  }

  const disconnectMutation = useMutation({
    mutationFn: () => adminFetch(`/mosques/${mosqueId}/connect`, { method: 'DELETE' }).then((r) => r.json()),
    onSuccess: () => refetchConnect(),
  })

  useEffect(() => {
    if (programsData?.data?.items) {
      setPrograms(programsData.data.items)
    }
  }, [programsData])

  // When returning from Stripe onboarding, refresh connect status
  useEffect(() => {
    if (searchParams.get('stripe') === 'success' || searchParams.get('stripe') === 'refresh') {
      refetchConnect()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const createProgramMutation = useMutation({
    mutationFn: () =>
      adminFetch(`/mosques/${mosqueId}/programs`, {
        method: 'POST',
        body: JSON.stringify(programForm),
      }).then(async (r) => {
        const json = await r.json()
        if (!r.ok) throw new Error(json?.error ?? 'Failed')
        return json
      }),
    onSuccess: () => {
      refetchPrograms()
      setProgramForm({ name: '', description: '', schedule: '', ageGroup: '' })
    },
  })

  const updateProgramMutation = useMutation({
    mutationFn: (id: string) =>
      adminFetch(`/mosques/${mosqueId}/programs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(programForm),
      }).then((r) => r.json()),
    onSuccess: () => {
      refetchPrograms()
      setEditingProgramId(null)
      setProgramForm({ name: '', description: '', schedule: '', ageGroup: '' })
    },
  })

  const deleteProgramMutation = useMutation({
    mutationFn: (id: string) =>
      adminFetch(`/mosques/${mosqueId}/programs/${id}`, { method: 'DELETE' }),
    onSuccess: () => refetchPrograms(),
  })

  useEffect(() => {
    if (data?.data) {
      const m = data.data
      setForm({
        name: m.name ?? '', slug: m.slug ?? '',
        description: m.description ?? '', address: m.address ?? '',
        city: m.city ?? '', state: m.state ?? '',
        country: m.country ?? 'US', zipCode: m.zipCode ?? '',
        phone: m.phone ?? '', email: m.email ?? '',
        website: m.website ?? '', imamName: m.imamName ?? '',
        hasWomensPrayer: m.hasWomensPrayer ?? false,
        hasYouthPrograms: m.hasYouthPrograms ?? false,
        hasParking: m.hasParking ?? false,
        isAccessible: m.isAccessible ?? false,
        capacityMen: m.capacityMen?.toString() ?? '',
        capacityWomen: m.capacityWomen?.toString() ?? '',
        parkingInfo: m.parkingInfo ?? '',
        directions: m.directions ?? '',
        latitude: m.latitude?.toString() ?? '',
        longitude: m.longitude?.toString() ?? '',
        logoUrl: m.logoUrl ?? '',
        mainImageUrl: m.mainImageUrl ?? '',
        amenities: m.amenities ?? [],
        facebookUrl: m.facebookUrl ?? '',
        twitterUrl: m.twitterUrl ?? '',
        instagramUrl: m.instagramUrl ?? '',
        youtubeUrl: m.youtubeUrl ?? '',
      })
    }
  }, [data])

  const saveMutation = useMutation({
    mutationFn: () =>
      adminFetch(`/mosques/${mosqueId}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...form,
          capacityMen: form.capacityMen ? parseInt(form.capacityMen) : undefined,
          capacityWomen: form.capacityWomen ? parseInt(form.capacityWomen) : undefined,
          latitude: form.latitude ? parseFloat(form.latitude) : undefined,
          longitude: form.longitude ? parseFloat(form.longitude) : undefined,
        }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mosque-settings', mosqueId] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))
    handleFiles(files)
  }

  async function handleFiles(files: File[]) {
    if (!files.length) return
    const newUploads = files.map((file) => ({
      id: Math.random().toString(36).slice(2),
      file,
      preview: URL.createObjectURL(file),
      progress: 0,
    }))
    setUploadQueue((prev) => [...prev, ...newUploads])

    for (const upload of newUploads) {
      try {
        const paramsRes = await adminFetch(`/mosques/${mosqueId}/upload-params`)
        const { data: p } = await paramsRes.json()

        const url = await new Promise<string>((resolve, reject) => {
          const fd = new FormData()
          fd.append('file', upload.file)
          fd.append('api_key', p.apiKey)
          fd.append('timestamp', String(p.timestamp))
          fd.append('signature', p.signature)
          fd.append('folder', p.folder)

          const xhr = new XMLHttpRequest()
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 100)
              setUploadQueue((prev) => prev.map((u) => u.id === upload.id ? { ...u, progress: pct } : u))
            }
          }
          xhr.onload = () => {
            const data = JSON.parse(xhr.responseText)
            if (data.secure_url) resolve(data.secure_url)
            else reject(new Error(data.error?.message ?? 'Upload failed'))
          }
          xhr.onerror = () => reject(new Error('Network error'))
          xhr.open('POST', `https://api.cloudinary.com/v1_1/${p.cloudName}/image/upload`)
          xhr.send(fd)
        })

        await adminFetch(`/mosques/${mosqueId}/photos`, {
          method: 'POST',
          body: JSON.stringify({ url, caption: '' }),
        })

        setUploadQueue((prev) => prev.map((u) => u.id === upload.id ? { ...u, progress: 100 } : u))
        refetchPhotos()

        // Remove from queue after 2s and revoke blob URL
        setTimeout(() => {
          setUploadQueue((prev) => prev.filter((u) => u.id !== upload.id))
          URL.revokeObjectURL(upload.preview)
        }, 2000)
      } catch (err: any) {
        setUploadQueue((prev) => prev.map((u) => u.id === upload.id ? { ...u, error: err.message ?? 'Upload failed' } : u))
      }
    }
  }

  async function uploadProfileImage(file: File, field: 'logoUrl' | 'mainImageUrl') {
    const setUploading = field === 'logoUrl' ? setLogoUploading : setMainImageUploading
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
      if (data.secure_url) set(field, data.secure_url)
    } finally {
      setUploading(false)
    }
  }

  const deletePhotoMutation = useMutation({
    mutationFn: (photoId: string) =>
      adminFetch(`/mosques/${mosqueId}/photos/${photoId}`, { method: 'DELETE' }).then((r) => r.json()),
    onSuccess: () => refetchPhotos(),
  })

  function set(key: string, value: any) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const tabs = [
    { id: 'basic', label: 'Basic Info' },
    { id: 'location', label: 'Location & Access' },
    { id: 'photos', label: 'Photos' },
    { id: 'amenities', label: 'Amenities' },
    { id: 'programs', label: 'Programs' },
    { id: 'social', label: 'Social Media' },
    { id: 'payments', label: '💳 Payments' },
  ]

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mosque Settings</h1>
          <p className="text-gray-500 text-sm">Update your mosque profile information</p>
        </div>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !form.name}
          className="bg-green-800 text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-green-900 disabled:opacity-50"
        >
          {saveMutation.isPending ? 'Saving...' : saved ? '✓ Saved' : 'Save Changes'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-100">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === t.id
                ? 'border-green-800 text-green-800'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Basic Info */}
      {activeTab === 'basic' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">

          {/* Profile images */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Profile Images</label>
            <div className="flex gap-4 items-start">

              {/* Logo */}
              <div className="flex flex-col items-center gap-2">
                <div
                  onClick={() => logoInputRef.current?.click()}
                  className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-200 hover:border-green-500 cursor-pointer overflow-hidden flex items-center justify-center bg-gray-50 relative group"
                >
                  {form.logoUrl ? (
                    <img src={form.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">🕌</span>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-2xl">
                    {logoUploading
                      ? <span className="text-white text-xs font-medium">Uploading…</span>
                      : <span className="text-white text-xs font-medium">Change</span>}
                  </div>
                </div>
                <span className="text-xs text-gray-500">Logo</span>
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadProfileImage(f, 'logoUrl'); e.target.value = '' }} />
              </div>

              {/* Main / cover image */}
              <div className="flex flex-col items-center gap-2 flex-1">
                <div
                  onClick={() => mainImageInputRef.current?.click()}
                  className="w-full h-20 rounded-2xl border-2 border-dashed border-gray-200 hover:border-green-500 cursor-pointer overflow-hidden flex items-center justify-center bg-gray-50 relative group"
                >
                  {form.mainImageUrl ? (
                    <img src={form.mainImageUrl} alt="Cover" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-gray-400 text-sm">Cover photo</span>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-2xl">
                    {mainImageUploading
                      ? <span className="text-white text-xs font-medium">Uploading…</span>
                      : <span className="text-white text-xs font-medium">Change</span>}
                  </div>
                </div>
                <span className="text-xs text-gray-500">Cover photo</span>
                <input ref={mainImageInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadProfileImage(f, 'mainImageUrl'); e.target.value = '' }} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mosque Name *</label>
              <input value={form.name} onChange={(e) => set('name', e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Imam Name</label>
              <input value={form.imamName} onChange={(e) => set('imamName', e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 h-28 resize-none focus:outline-none focus:ring-2 focus:ring-green-800" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input value={form.address} onChange={(e) => set('address', e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
              <input value={form.city} onChange={(e) => set('city', e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
              <input value={form.state} onChange={(e) => set('state', e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Zip Code</label>
              <input value={form.zipCode} onChange={(e) => set('zipCode', e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
            <input type="url" value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="https://" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Facilities & Features</label>
            <div className="grid grid-cols-2 gap-3">
              {FEATURE_FLAGS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(form as any)[key]}
                    onChange={(e) => set(key, e.target.checked)}
                    className="rounded border-gray-300 text-green-800"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Men's Capacity</label>
              <input type="number" min="0" value={form.capacityMen} onChange={(e) => set('capacityMen', e.target.value)} placeholder="e.g. 500" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Women's Capacity</label>
              <input type="number" min="0" value={form.capacityWomen} onChange={(e) => set('capacityWomen', e.target.value)} placeholder="e.g. 200" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800" />
            </div>
          </div>
        </div>
      )}

      {/* Location & Access */}
      {activeTab === 'location' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
              <input type="number" step="any" value={form.latitude} onChange={(e) => set('latitude', e.target.value)} placeholder="e.g. 40.7128" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
              <input type="number" step="any" value={form.longitude} onChange={(e) => set('longitude', e.target.value)} placeholder="e.g. -74.0060" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800" />
            </div>
          </div>
          <p className="text-xs text-gray-400">
            💡 Find coordinates on{' '}
            <a href="https://maps.google.com" target="_blank" rel="noopener noreferrer" className="text-green-700 underline">
              Google Maps
            </a>{' '}
            by right-clicking your mosque location.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Parking Information</label>
            <textarea value={form.parkingInfo} onChange={(e) => set('parkingInfo', e.target.value)} rows={3} placeholder="Describe parking options, nearby lots, street parking, etc." className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-green-800" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Directions / How to Get Here</label>
            <textarea value={form.directions} onChange={(e) => set('directions', e.target.value)} rows={4} placeholder="Public transit directions, landmarks, turn-by-turn instructions, etc." className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-green-800" />
          </div>
        </div>
      )}

      {/* Photos */}
      {activeTab === 'photos' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Photo Gallery</h2>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
              onDragEnter={(e) => { e.preventDefault(); setIsDragOver(true) }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors mb-6 select-none ${
                isDragOver
                  ? 'border-green-600 bg-green-50'
                  : 'border-gray-200 hover:border-green-400 hover:bg-gray-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => { handleFiles(Array.from(e.target.files ?? [])); e.target.value = '' }}
              />
              <p className="text-4xl mb-3">📷</p>
              <p className="text-sm font-semibold text-gray-700">
                {isDragOver ? 'Drop to upload' : 'Drag photos here or click to browse'}
              </p>
              <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP — up to 10 MB each</p>
            </div>

            {/* Upload progress queue */}
            {uploadQueue.length > 0 && (
              <div className="space-y-2 mb-6">
                {uploadQueue.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                    <img src={u.preview} alt="" className="w-12 h-12 object-cover rounded-lg flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 truncate">{u.file.name}</p>
                      {u.error ? (
                        <p className="text-xs text-red-500 mt-0.5">{u.error}</p>
                      ) : u.progress < 100 ? (
                        <>
                          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mt-1.5">
                            <div
                              className="h-full bg-green-600 rounded-full transition-all duration-150"
                              style={{ width: `${u.progress}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">{u.progress}%</p>
                        </>
                      ) : (
                        <p className="text-xs text-green-600 font-medium mt-0.5">✓ Added to gallery</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {photos.length === 0 && uploadQueue.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-4">No photos yet.</p>
            )}

            {/* Gallery grid */}
            <div className="grid grid-cols-3 gap-3">
              {photos.map((photo: any) => (
                <div key={photo.id} className="relative group rounded-xl overflow-hidden aspect-video bg-gray-100">
                  <img src={photo.url} alt={photo.caption ?? ''} className="w-full h-full object-cover" />
                  {photo.caption && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-2 py-1 truncate">
                      {photo.caption}
                    </div>
                  )}
                  <button
                    onClick={() => deletePhotoMutation.mutate(photo.id)}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 text-xs hidden group-hover:flex items-center justify-center hover:bg-red-600"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Amenities */}
      {activeTab === 'amenities' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-6">
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-1">Facilities & Amenities</h2>
            <p className="text-sm text-gray-500 mb-4">Check everything available at or near your mosque.</p>

            {/* Predefined amenities */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                { key: 'basketball_court', label: '🏀 Basketball Court' },
                { key: 'football_field', label: '⚽ Football Field' },
                { key: 'coffee_shop', label: '☕ Coffee Shop' },
                { key: 'library', label: '📚 Library' },
                { key: 'playground', label: '🛝 Playground' },
                { key: 'gym', label: '🏋️ Gym / Fitness' },
                { key: 'cafeteria', label: '🍽️ Cafeteria' },
                { key: 'funeral_services', label: '🕌 Funeral Services' },
                { key: 'wudu_facilities', label: '🚰 Wudu Facilities' },
                { key: 'classrooms', label: '🏫 Classrooms' },
                { key: 'social_hall', label: '🏛️ Social Hall' },
                { key: 'medical_clinic', label: '⚕️ Medical Clinic' },
              ].map(({ key, label }) => {
                const checked = (form.amenities ?? []).includes(key)
                return (
                  <label key={key} className="flex items-center gap-2.5 cursor-pointer group">
                    <div
                      onClick={() =>
                        set('amenities', checked
                          ? (form.amenities ?? []).filter((a: string) => a !== key)
                          : [...(form.amenities ?? []), key]
                        )
                      }
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors ${checked ? 'bg-green-800 border-green-800' : 'border-gray-300 group-hover:border-green-500'}`}
                    >
                      {checked && <span className="text-white text-xs font-bold">✓</span>}
                    </div>
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                )
              })}
            </div>

            {/* Custom amenities */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Other Amenities</label>
              <p className="text-xs text-gray-400 mb-2">Add custom amenities not listed above, one per line.</p>
              <textarea
                value={(form.amenities ?? []).filter((a: string) => ![
                  'basketball_court','football_field','coffee_shop','library','playground',
                  'gym','cafeteria','funeral_services','wudu_facilities','classrooms','social_hall','medical_clinic'
                ].includes(a)).join('\n')}
                onChange={(e) => {
                  const predefined = (form.amenities ?? []).filter((a: string) => [
                    'basketball_court','football_field','coffee_shop','library','playground',
                    'gym','cafeteria','funeral_services','wudu_facilities','classrooms','social_hall','medical_clinic'
                  ].includes(a))
                  const custom = e.target.value.split('\n').map(s => s.trim()).filter(Boolean)
                  set('amenities', [...predefined, ...custom])
                }}
                placeholder="e.g. Rooftop Garden, Prayer Mats Available, Shoe Racks…"
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-green-800 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="bg-green-800 text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-green-900 disabled:opacity-50"
            >
              {saveMutation.isPending ? 'Saving...' : saved ? '✓ Saved' : 'Save Amenities'}
            </button>
          </div>
        </div>
      )}

      {/* Programs */}
      {activeTab === 'programs' && (
        <div className="space-y-4">
          {/* Add / Edit form */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              {editingProgramId ? 'Edit Program' : 'Add New Program'}
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Program Name *</label>
                  <input
                    value={programForm.name}
                    onChange={(e) => setProgramForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Weekend Islamic School"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Age Group</label>
                  <input
                    value={programForm.ageGroup}
                    onChange={(e) => setProgramForm((f) => ({ ...f, ageGroup: e.target.value }))}
                    placeholder="e.g. Youth 8–14, Adults, All Ages"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={programForm.description}
                  onChange={(e) => setProgramForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description of the program…"
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-green-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Schedule</label>
                <input
                  value={programForm.schedule}
                  onChange={(e) => setProgramForm((f) => ({ ...f, schedule: e.target.value }))}
                  placeholder="e.g. Saturdays 10:00 AM – 12:00 PM"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800 text-sm"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    if (editingProgramId) updateProgramMutation.mutate(editingProgramId)
                    else createProgramMutation.mutate()
                  }}
                  disabled={!programForm.name.trim() || createProgramMutation.isPending || updateProgramMutation.isPending}
                  className="bg-green-800 text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-green-900 disabled:opacity-50"
                >
                  {createProgramMutation.isPending || updateProgramMutation.isPending
                    ? 'Saving…'
                    : editingProgramId ? 'Update Program' : '+ Add Program'}
                </button>
                {editingProgramId && (
                  <button
                    onClick={() => { setEditingProgramId(null); setProgramForm({ name: '', description: '', schedule: '', ageGroup: '' }) }}
                    className="border border-gray-200 text-gray-600 rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Programs list */}
          {programs.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-sm">No programs yet. Add your first one above.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {programs.map((program) => (
                <div key={program.id} className="bg-white rounded-2xl border border-gray-100 p-5 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm">{program.name}</p>
                      {program.ageGroup && (
                        <span className="bg-green-50 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">{program.ageGroup}</span>
                      )}
                    </div>
                    {program.description && <p className="text-sm text-gray-500 mb-1">{program.description}</p>}
                    {program.schedule && (
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        🕐 {program.schedule}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => {
                        setEditingProgramId(program.id)
                        setProgramForm({
                          name: program.name,
                          description: program.description ?? '',
                          schedule: program.schedule ?? '',
                          ageGroup: program.ageGroup ?? '',
                        })
                      }}
                      className="text-xs text-gray-500 hover:text-green-700 font-medium px-2.5 py-1.5 rounded-lg hover:bg-green-50 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => { if (confirm('Delete this program?')) deleteProgramMutation.mutate(program.id) }}
                      disabled={deleteProgramMutation.isPending}
                      className="text-xs text-gray-400 hover:text-red-500 font-medium px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Social Media */}
      {activeTab === 'social' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-1">Social Media Links</h2>
            <p className="text-sm text-gray-500 mb-4">Add your mosque's social media profiles so visitors can connect with you.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">📘 Facebook URL</label>
            <input
              type="url"
              value={form.facebookUrl}
              onChange={(e) => set('facebookUrl', e.target.value)}
              placeholder="https://facebook.com/yourmasjid"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">𝕏 X / Twitter URL</label>
            <input
              type="url"
              value={form.twitterUrl}
              onChange={(e) => set('twitterUrl', e.target.value)}
              placeholder="https://x.com/yourmasjid"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">📷 Instagram URL</label>
            <input
              type="url"
              value={form.instagramUrl}
              onChange={(e) => set('instagramUrl', e.target.value)}
              placeholder="https://instagram.com/yourmasjid"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">▶️ YouTube URL</label>
            <input
              type="url"
              value={form.youtubeUrl}
              onChange={(e) => set('youtubeUrl', e.target.value)}
              placeholder="https://youtube.com/@yourmasjid"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800"
            />
          </div>

          <p className="text-xs text-gray-400">Enter full URL including https://</p>

          <div className="flex justify-end">
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="bg-green-800 text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-green-900 disabled:opacity-50"
            >
              {saveMutation.isPending ? 'Saving...' : saved ? '✓ Saved' : 'Save Social Links'}
            </button>
          </div>
        </div>
      )}

      {/* Payments / Stripe Connect */}
      {activeTab === 'payments' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-6">
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-1">Stripe Payments</h2>
            <p className="text-sm text-gray-500">
              Connect a Stripe account so donations go directly to your mosque. Donors see your mosque name at checkout.
            </p>
          </div>

          {!connectStatus?.connected ? (
            /* ── Not connected ── */
            <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center">
              <div className="text-4xl mb-3">💳</div>
              <h3 className="font-semibold text-gray-900 mb-1">No Stripe account connected</h3>
              <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
                Donations currently go to the platform. Connect your own Stripe account to receive funds directly.
              </p>
              <button
                onClick={handleConnectStripe}
                disabled={connectLoading}
                className="bg-[#635BFF] hover:bg-[#4F46E5] text-white rounded-xl px-8 py-3 font-semibold text-sm disabled:opacity-60 transition-colors"
              >
                {connectLoading ? 'Redirecting to Stripe...' : 'Connect with Stripe'}
              </button>
              <p className="text-xs text-gray-400 mt-3">
                You'll be redirected to Stripe to create a free Express account. Takes ~5 minutes.
              </p>
            </div>
          ) : !connectStatus?.chargesEnabled ? (
            /* ── Connected but onboarding incomplete ── */
            <div className="border border-amber-200 bg-amber-50 rounded-2xl p-6">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-900 mb-1">Setup incomplete</h3>
                  <p className="text-sm text-amber-700 mb-4">
                    Your Stripe account is linked but you need to complete the setup before donations can be received.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleConnectStripe}
                      disabled={connectLoading}
                      className="bg-amber-700 hover:bg-amber-800 text-white rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
                    >
                      {connectLoading ? 'Loading...' : 'Complete setup →'}
                    </button>
                    <button
                      onClick={() => refetchConnect()}
                      className="border border-amber-300 text-amber-700 rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-amber-100"
                    >
                      Check status
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ── Fully connected ── */
            <div className="space-y-4">
              <div className="flex items-center gap-3 border border-green-200 bg-green-50 rounded-2xl p-4">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">✅</span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-green-900 text-sm">Stripe account connected</p>
                  <p className="text-xs text-green-700 font-mono mt-0.5">{connectStatus.accountId}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleOpenDashboard}
                  disabled={dashboardLoading}
                  className="flex items-center justify-center gap-2 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  {dashboardLoading ? 'Opening...' : '📊 Open Stripe Dashboard'}
                </button>
                <button
                  onClick={() => {
                    if (window.confirm('Disconnect Stripe? Donations will go to the platform until you reconnect.')) {
                      disconnectMutation.mutate()
                    }
                  }}
                  disabled={disconnectMutation.isPending}
                  className="flex items-center justify-center gap-2 border border-red-200 rounded-xl px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                  {disconnectMutation.isPending ? 'Disconnecting...' : '🔌 Disconnect'}
                </button>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm text-gray-600">
                <p className="font-medium text-gray-700">How it works</p>
                <p>• Donors pay through the app — funds transfer directly to your Stripe account</p>
                <p>• Stripe sends automatic email receipts to donors</p>
                <p>• View payouts and transaction history in your Stripe dashboard</p>
                <p>• Standard Stripe fees apply (2.9% + 30¢ per transaction)</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
