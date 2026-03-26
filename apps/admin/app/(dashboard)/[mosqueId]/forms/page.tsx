'use client'

import { useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAdminFetch } from '../../../../lib/adminFetch'

const CLOUDINARY_CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? ''
const CLOUDINARY_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? 'masjid_unsigned'

async function uploadToCloudinary(file: File): Promise<{ url: string; size: number; mimeType: string }> {
  if (!CLOUDINARY_CLOUD) throw new Error('Cloudinary is not configured (NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME missing)')

  const isImage = file.type.startsWith('image/')
  const isPdf = file.type === 'application/pdf'
  const resourceType = (isImage || isPdf) ? 'image' : 'raw'

  const fd = new FormData()
  fd.append('file', file)
  fd.append('upload_preset', CLOUDINARY_PRESET)

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/${resourceType}/upload`, { method: 'POST', body: fd })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? 'Upload failed')
  }
  const data = await res.json()
  return { url: data.secure_url, size: data.bytes, mimeType: file.type }
}

function formatBytes(bytes: number) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileIcon(mime?: string | null) {
  if (!mime) return '📄'
  if (mime === 'application/pdf') return '📕'
  if (mime.startsWith('image/')) return '🖼️'
  if (mime.includes('word')) return '📝'
  if (mime.includes('excel') || mime.includes('spreadsheet')) return '📊'
  return '📄'
}

export default function FormsPage() {
  const { mosqueId } = useParams<{ mosqueId: string }>()
  const queryClient = useQueryClient()
  const adminFetch = useAdminFetch()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['mosque-documents', mosqueId],
    queryFn: () => adminFetch(`/mosques/${mosqueId}/documents`).then(r => r.json()),
  })
  const docs: any[] = data?.data?.items ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminFetch(`/mosques/${mosqueId}/documents/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mosque-documents', mosqueId] }),
  })

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      adminFetch(`/mosques/${mosqueId}/documents/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mosque-documents', mosqueId] })
      setEditingId(null)
    },
  })

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploadError('')
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        if (file.size > 20 * 1024 * 1024) {
          setUploadError(`${file.name} exceeds 20 MB limit`)
          continue
        }
        const { url, size, mimeType } = await uploadToCloudinary(file)
        await adminFetch(`/mosques/${mosqueId}/documents`, {
          method: 'POST',
          body: JSON.stringify({ name: file.name, fileUrl: url, fileSize: size, mimeType }),
        })
      }
      queryClient.invalidateQueries({ queryKey: ['mosque-documents', mosqueId] })
    } catch (e: any) {
      setUploadError(e.message ?? 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }, [mosqueId])

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Forms & Documents</h1>
        <p className="text-gray-500 text-sm mt-1">Upload forms and documents that your community can access and download.</p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={[
          'border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors mb-6',
          dragging ? 'border-green-600 bg-green-50' : 'border-gray-200 hover:border-green-400 hover:bg-gray-50',
        ].join(' ')}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-green-700 border-t-transparent rounded-full animate-spin" />
            <p className="text-green-700 font-medium text-sm">Uploading…</p>
          </div>
        ) : (
          <>
            <p className="text-4xl mb-3">{dragging ? '📂' : '📁'}</p>
            <p className="text-gray-700 font-semibold">Drop files here or click to browse</p>
            <p className="text-gray-400 text-sm mt-1">PDF, Word, Excel, Images · Max 20 MB each</p>
          </>
        )}
      </div>

      {uploadError && (
        <div className="mb-4 bg-red-50 border border-red-100 text-red-600 rounded-xl px-4 py-3 text-sm">
          ⚠️ {uploadError}
        </div>
      )}

      {/* Document list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : docs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📂</p>
          <p className="text-sm">No documents uploaded yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {docs.map((doc: any) => (
            <div key={doc.id} className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center gap-4">
              <span className="text-2xl flex-shrink-0">{fileIcon(doc.mimeType)}</span>

              <div className="flex-1 min-w-0">
                {editingId === doc.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && editName.trim()) renameMutation.mutate({ id: doc.id, name: editName.trim() })
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      autoFocus
                      className="border border-green-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-700 flex-1"
                    />
                    <button
                      onClick={() => editName.trim() && renameMutation.mutate({ id: doc.id, name: editName.trim() })}
                      disabled={renameMutation.isPending}
                      className="bg-green-800 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-green-900 disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-gray-400 text-xs px-2 py-1.5 rounded-lg hover:bg-gray-100">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <p className="font-medium text-gray-900 truncate">{doc.name}</p>
                )}
                <p className="text-xs text-gray-400 mt-0.5">
                  {doc.fileSize ? formatBytes(doc.fileSize) + ' · ' : ''}
                  {new Date(doc.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-green-700 font-medium px-3 py-1.5 rounded-lg hover:bg-green-50"
                >
                  View
                </a>
                <button
                  onClick={() => { setEditingId(doc.id); setEditName(doc.name) }}
                  className="text-xs text-gray-500 font-medium px-3 py-1.5 rounded-lg hover:bg-gray-50"
                >
                  Rename
                </button>
                <button
                  onClick={() => { if (confirm('Delete this document?')) deleteMutation.mutate(doc.id) }}
                  disabled={deleteMutation.isPending}
                  className="text-xs text-red-400 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
