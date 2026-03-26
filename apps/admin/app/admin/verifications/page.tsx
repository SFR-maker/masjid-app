'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAdminFetch } from '../../../lib/adminFetch'

interface VerificationRequest {
  id: string
  status: string
  createdAt: string
  adminNotes: string | null
  mosque: { id: string; name: string; city: string; state: string }
  requester: { name: string | null; email: string }
}

export default function VerificationsPage() {
  const adminFetch = useAdminFetch()
  const qc = useQueryClient()
  const [noteMap, setNoteMap] = useState<Record<string, string>>({})

  const { data, isLoading } = useQuery({
    queryKey: ['verifications'],
    queryFn: async () => {
      const res = await adminFetch('/admin/verification')
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`)
      return json.data as VerificationRequest[]
    },
  })

  const actionMutation = useMutation({
    mutationFn: async ({ id, action, adminNotes }: { id: string; action: 'approve' | 'reject'; adminNotes?: string }) => {
      const res = await adminFetch(`/admin/verification/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ action, adminNotes }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'Failed')
      return json
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['verifications'] }),
  })

  const requests = data ?? []

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Verification Requests</h1>
        <p className="text-sm text-gray-500 mt-0.5">Review and approve mosque verification applications</p>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      )}

      {!isLoading && requests.length === 0 && (
        <div className="p-12 text-center bg-white rounded-2xl border border-gray-100">
          <div className="text-4xl mb-3">✅</div>
          <p className="text-gray-500 font-medium">No pending verification requests</p>
        </div>
      )}

      <div className="space-y-4">
        {requests.map((r) => (
          <div key={r.id} className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-gray-900">{r.mosque.name}</h3>
                <p className="text-sm text-gray-500">{r.mosque.city}, {r.mosque.state}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Requested by {r.requester.name ?? r.requester.email} · {new Date(r.createdAt).toLocaleDateString()}
                </p>
              </div>
              <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full shrink-0">
                {r.status}
              </span>
            </div>
            <div className="mt-3">
              <textarea
                value={noteMap[r.id] ?? ''}
                onChange={(e) => setNoteMap((m) => ({ ...m, [r.id]: e.target.value }))}
                placeholder="Admin notes (optional)…"
                rows={2}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700 resize-none"
              />
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => actionMutation.mutate({ id: r.id, action: 'approve', adminNotes: noteMap[r.id] })}
                disabled={actionMutation.isPending}
                className="px-4 py-2 bg-green-800 text-white text-sm font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                Approve
              </button>
              <button
                onClick={() => actionMutation.mutate({ id: r.id, action: 'reject', adminNotes: noteMap[r.id] })}
                disabled={actionMutation.isPending}
                className="px-4 py-2 bg-red-100 text-red-700 text-sm font-semibold rounded-xl hover:bg-red-200 disabled:opacity-50 transition-colors"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
