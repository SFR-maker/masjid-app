'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useAdminFetch } from '../../../lib/adminFetch'

interface Report {
  id: string
  type: string
  reason: string
  status: string
  targetId: string
  targetType: string
  createdAt: string
  notes: string | null
  reporter: { name: string | null; email: string }
}

export default function ReportsPage() {
  const adminFetch = useAdminFetch()
  const qc = useQueryClient()
  const [status, setStatus] = useState('PENDING')
  const [noteMap, setNoteMap] = useState<Record<string, string>>({})

  const { data, isLoading } = useQuery({
    queryKey: ['reports', status],
    queryFn: async () => {
      const res = await adminFetch(`/admin/reports?status=${status}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`)
      return json.data as Report[]
    },
  })

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'RESOLVED' | 'DISMISSED' }) => {
      const res = await adminFetch(`/admin/reports/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: action, notes: noteMap[id] }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'Failed')
      return json
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
  })

  const reports = data ?? []

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">Review user-submitted content reports</p>
        </div>
        <div className="flex gap-2">
          {['PENDING', 'RESOLVED', 'DISMISSED'].map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                status === s ? 'bg-green-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      )}

      {!isLoading && reports.length === 0 && (
        <div className="p-12 text-center bg-white rounded-2xl border border-gray-100">
          <div className="text-4xl mb-3">🏳️</div>
          <p className="text-gray-500 font-medium">No {status.toLowerCase()} reports</p>
        </div>
      )}

      <div className="space-y-4">
        {reports.map((r) => (
          <div key={r.id} className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-gray-900">{r.type}</span>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">{r.targetType}</span>
                </div>
                <p className="text-sm text-gray-700">{r.reason}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Reported by {r.reporter.name ?? r.reporter.email} · {new Date(r.createdAt).toLocaleDateString()}
                </p>
              </div>
              <span className={`px-2.5 py-1 text-xs font-semibold rounded-full shrink-0 ${
                r.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                r.status === 'RESOLVED' ? 'bg-green-100 text-green-700' :
                'bg-gray-100 text-gray-500'
              }`}>
                {r.status}
              </span>
            </div>
            {r.status === 'PENDING' && (
              <>
                <div className="mt-3">
                  <textarea
                    value={noteMap[r.id] ?? ''}
                    onChange={(e) => setNoteMap((m) => ({ ...m, [r.id]: e.target.value }))}
                    placeholder="Resolution notes (optional)…"
                    rows={2}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700 resize-none"
                  />
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => actionMutation.mutate({ id: r.id, action: 'RESOLVED' })}
                    disabled={actionMutation.isPending}
                    className="px-4 py-2 bg-green-800 text-white text-sm font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    Resolve
                  </button>
                  <button
                    onClick={() => actionMutation.mutate({ id: r.id, action: 'DISMISSED' })}
                    disabled={actionMutation.isPending}
                    className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200 disabled:opacity-50 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
