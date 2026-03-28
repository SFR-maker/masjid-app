'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { useAdminFetch } from '../../../../lib/adminFetch'

const CATEGORIES = ['GENERAL','LECTURE','QURAN','DUA','KHUTBAH','EDUCATIONAL','EVENT','OTHER']

export default function VideosPage() {
  const { mosqueId } = useParams<{ mosqueId: string }>()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', category: 'GENERAL' })
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [uploadedVideoId, setUploadedVideoId] = useState<string | null>(null)
  const [editingVideo, setEditingVideo] = useState<any>(null)
  const [editForm, setEditForm] = useState({ title: '', description: '', category: '' })
  const [engagementId, setEngagementId] = useState<string | null>(null)
  const adminFetch = useAdminFetch()

  const { data } = useQuery({
    queryKey: ['admin-videos', mosqueId],
    queryFn: () => adminFetch(`/mosques/${mosqueId}/videos?limit=50`).then((r) => r.json()),
  })
  const allVideos = data?.data?.items ?? []

  // Admin Bug 3 fix: sort & filter
  const [videoSort, setVideoSort] = useState<'newest' | 'oldest'>('newest')
  const [videoSearch, setVideoSearch] = useState('')
  const [videoCategory, setVideoCategory] = useState('all')
  const [videoStatus, setVideoStatus] = useState<'all' | 'READY' | 'PROCESSING' | 'ERROR'>('all')

  const videos = allVideos
    .filter((v: any) => videoCategory === 'all' || v.category === videoCategory)
    .filter((v: any) => videoStatus === 'all' || v.status === videoStatus)
    .filter((v: any) => videoSearch === '' || v.title.toLowerCase().includes(videoSearch.toLowerCase()))
    .sort((a: any, b: any) =>
      videoSort === 'newest'
        ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      adminFetch(`/videos/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-videos', mosqueId] })
      setEditingVideo(null)
    },
  })

  const publishMutation = useMutation({
    mutationFn: (id: string) => adminFetch(`/videos/${id}/publish`, { method: 'PATCH' }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-videos', mosqueId] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminFetch(`/videos/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-videos', mosqueId] }),
  })

  function openEdit(v: any) {
    setEditingVideo(v)
    setEditForm({ title: v.title, description: v.description ?? '', category: v.category })
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !form.title) return
    setUploading(true)
    setUploadProgress('Getting upload URL...')
    try {
      const res = await adminFetch(`/mosques/${mosqueId}/videos/upload`, {
        method: 'POST',
        body: JSON.stringify({ title: form.title, description: form.description, category: form.category }),
      })
      const { data: uploadData } = await res.json()
      setUploadProgress('Uploading video...')
      await fetch(uploadData.uploadUrl, {
        method: 'PUT', body: file, headers: { 'Content-Type': file.type },
      })
      setUploadProgress('✓ Video uploaded! Processing begins shortly...')
      setUploadedVideoId(uploadData.videoId)
      queryClient.invalidateQueries({ queryKey: ['admin-videos', mosqueId] })
    } catch {
      setUploadProgress('Upload failed. Please try again.')
    } finally {
      setUploading(false)
      setTimeout(() => setUploadProgress(''), 6000)
    }
  }

  const statusColors: Record<string, string> = {
    PROCESSING: 'bg-amber-100 text-amber-600',
    READY: 'bg-green-100 text-green-700',
    ERROR: 'bg-red-100 text-red-600',
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Videos</h1>
          <p className="text-gray-500 text-sm mt-1">Upload and manage mosque videos</p>
        </div>
        <button onClick={() => setShowForm(true)} className="bg-green-800 text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-green-900">
          + Upload Video
        </button>
      </div>

      {/* Upload form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-5">Upload New Video</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800" placeholder="Video title" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 h-20 resize-none focus:outline-none focus:ring-2 focus:ring-green-800" placeholder="Optional description..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Video File *</label>
              <input type="file" accept="video/*" disabled={!form.title || uploading} onChange={handleUpload}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 disabled:opacity-50" />
              <p className="text-xs text-gray-400 mt-1">MP4, MOV, or MKV. Max 5GB.</p>
            </div>
            {uploadProgress && (
              <div className={`text-sm px-4 py-3 rounded-xl ${uploadProgress.startsWith('✓') ? 'bg-green-50 text-green-700' : uploadProgress.includes('failed') ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                {uploadProgress}
              </div>
            )}
            {uploadedVideoId ? (
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    publishMutation.mutate(uploadedVideoId)
                    setShowForm(false)
                    setForm({ title: '', description: '', category: 'GENERAL' })
                    setUploadedVideoId(null)
                    setUploadProgress('')
                  }}
                  disabled={publishMutation.isPending}
                  className="bg-green-800 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-green-900 disabled:opacity-50"
                >
                  ▶ Publish Now
                </button>
                <button
                  onClick={() => {
                    setShowForm(false)
                    setForm({ title: '', description: '', category: 'GENERAL' })
                    setUploadedVideoId(null)
                    setUploadProgress('')
                  }}
                  className="border border-gray-200 text-gray-600 rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-gray-50"
                >
                  Keep as Draft
                </button>
              </div>
            ) : (
              <button onClick={() => { setShowForm(false); setUploadProgress(''); setUploadedVideoId(null) }} className="border border-gray-200 text-gray-600 rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingVideo && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-5">Edit Video</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 h-20 resize-none focus:outline-none focus:ring-2 focus:ring-green-800" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => updateMutation.mutate({ id: editingVideo.id, data: editForm })}
                disabled={updateMutation.isPending || !editForm.title}
                className="bg-green-800 text-white rounded-xl px-5 py-2 text-sm font-medium hover:bg-green-900 disabled:opacity-50"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
              <button onClick={() => setEditingVideo(null)} className="border border-gray-200 text-gray-600 rounded-xl px-5 py-2 text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Bug 3: sort/filter bar for videos */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          value={videoSearch}
          onChange={e => setVideoSearch(e.target.value)}
          placeholder="Search videos…"
          className="border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800 flex-1 min-w-[180px]"
        />
        <select
          value={videoCategory}
          onChange={e => setVideoCategory(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800"
        >
          <option value="all">All categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={videoStatus}
          onChange={e => setVideoStatus(e.target.value as any)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800"
        >
          <option value="all">All statuses</option>
          <option value="READY">Ready</option>
          <option value="PROCESSING">Processing</option>
          <option value="ERROR">Error</option>
        </select>
        <select
          value={videoSort}
          onChange={e => setVideoSort(e.target.value as any)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>

      {/* Video list */}
      <div className="space-y-3">
        {videos.length === 0 && !showForm && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🎬</p>
            <p>No videos yet. Upload your first video above.</p>
          </div>
        )}
        {videos.map((v: any) => (
          <div key={v.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="p-5 flex gap-4 items-start">
              {v.thumbnailUrl ? (
                <img src={v.thumbnailUrl} alt={v.title} className="w-28 h-16 rounded-xl object-cover flex-shrink-0" />
              ) : (
                <div className="w-28 h-16 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">🎬</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[v.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {v.status}
                  </span>
                  {v.status === 'READY' && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${v.isPublished ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                      {v.isPublished ? 'Published' : 'Draft'}
                    </span>
                  )}
                  <span className="bg-green-50 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">{v.category}</span>
                </div>
                <p className="text-gray-900 font-semibold truncate">{v.title}</p>
                {v.description && <p className="text-gray-400 text-xs mt-1 line-clamp-1">{v.description}</p>}
                <p className="text-gray-400 text-xs mt-1">
                  {formatDistanceToNow(new Date(v.createdAt), { addSuffix: true })}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setEngagementId(engagementId === v.id ? null : v.id)}
                  className={`border rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${engagementId === v.id ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  📊 Stats
                </button>
                {v.status === 'READY' && (
                  <button
                    onClick={() => publishMutation.mutate(v.id)}
                    disabled={publishMutation.isPending}
                    className={`border rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${v.isPublished ? 'border-orange-100 text-orange-600 hover:bg-orange-50' : 'border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100'}`}
                  >
                    {v.isPublished ? 'Unpublish' : '▶ Publish'}
                  </button>
                )}
                <button
                  onClick={() => openEdit(v)}
                  className="border border-gray-200 text-gray-600 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${v.title}"? This cannot be undone.`)) {
                      deleteMutation.mutate(v.id)
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  className="border border-red-100 text-red-500 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-red-50 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
            {engagementId === v.id && (
              <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-4">Engagement</p>
                <div className="flex items-center gap-8">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-800">{v.viewCount ?? 0}</p>
                    <p className="text-xs text-gray-400 mt-0.5">👁️ Views</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-500">{v.likeCount ?? 0}</p>
                    <p className="text-xs text-gray-400 mt-0.5">❤️ Likes</p>
                  </div>
                  {v.duration && (
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-800">{Math.floor(v.duration / 60)}:{String(v.duration % 60).padStart(2, '0')}</p>
                      <p className="text-xs text-gray-400 mt-0.5">⏱️ Duration</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
