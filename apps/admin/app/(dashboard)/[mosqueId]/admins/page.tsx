'use client'

import { useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAdminFetch } from '../../../../lib/adminFetch'

interface AdminUser {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
}

interface MosqueAdmin {
  id: string
  role: 'OWNER' | 'ADMIN' | 'EDITOR'
  createdAt: string
  user: AdminUser
}

interface UserResult {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  EDITOR: 'Editor',
}

const ROLE_COLORS: Record<string, string> = {
  OWNER: 'bg-amber-100 text-amber-700',
  ADMIN: 'bg-green-100 text-green-700',
  EDITOR: 'bg-blue-100 text-blue-700',
}

export default function AdminsPage() {
  const params = useParams<{ mosqueId: string }>()
  const mosqueId = params.mosqueId
  const adminFetch = useAdminFetch()
  const qc = useQueryClient()

  const [showAddPanel, setShowAddPanel] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [userResults, setUserResults] = useState<UserResult[]>([])
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null)
  const [addRole, setAddRole] = useState<'ADMIN' | 'EDITOR'>('ADMIN')
  const [searchLoading, setSearchLoading] = useState(false)
  const searchRef = useRef<ReturnType<typeof setTimeout>>()

  const { data, isLoading, error } = useQuery({
    queryKey: ['admins', mosqueId],
    queryFn: async () => {
      const res = await adminFetch(`/mosques/${mosqueId}/admins`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`)
      return json.data as { items: MosqueAdmin[] }
    },
  })

  const admins = data?.items ?? []
  const myRecord = admins[0] // will refine below with userId check — for now allow UI to render

  const addMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const res = await adminFetch(`/mosques/${mosqueId}/admins`, {
        method: 'POST',
        body: JSON.stringify({ userId, role }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'Failed to add admin')
      return json.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admins', mosqueId] })
      setShowAddPanel(false)
      setSelectedUser(null)
      setUserSearch('')
      setUserResults([])
    },
  })

  const changeMutation = useMutation({
    mutationFn: async ({ adminId, role }: { adminId: string; role: string }) => {
      const res = await adminFetch(`/mosques/${mosqueId}/admins/${adminId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'Failed to update role')
      return json.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admins', mosqueId] }),
  })

  const removeMutation = useMutation({
    mutationFn: async (adminId: string) => {
      const res = await adminFetch(`/mosques/${mosqueId}/admins/${adminId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'Failed to remove admin')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admins', mosqueId] }),
  })

  function handleSearchChange(val: string) {
    setUserSearch(val)
    setSelectedUser(null)
    clearTimeout(searchRef.current)
    if (val.trim().length < 2) { setUserResults([]); return }
    searchRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await adminFetch(`/admin/users/search?q=${encodeURIComponent(val)}`)
        const json = await res.json()
        setUserResults(json.data?.items ?? [])
      } finally {
        setSearchLoading(false)
      }
    }, 300)
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-6" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-xl mb-3 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Members</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage who has access to this mosque's admin panel</p>
        </div>
        <button
          onClick={() => setShowAddPanel(true)}
          className="px-4 py-2 bg-green-800 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors"
        >
          + Add Member
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {(error as Error).message}
        </div>
      )}

      {addMutation.error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {(addMutation.error as Error).message}
        </div>
      )}

      {/* Add Member Panel */}
      {showAddPanel && (
        <div className="mb-6 p-5 bg-white border border-gray-200 rounded-2xl shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-3">Add Team Member</h2>

          {selectedUser ? (
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl mb-4">
              <div className="w-9 h-9 rounded-full bg-green-800 flex items-center justify-center text-white text-sm font-bold shrink-0">
                {selectedUser.name?.charAt(0)?.toUpperCase() ?? 'U'}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">{selectedUser.name ?? '—'}</p>
                <p className="text-xs text-gray-500">{selectedUser.email}</p>
              </div>
              <button onClick={() => setSelectedUser(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
            </div>
          ) : (
            <div className="relative mb-4">
              <input
                type="text"
                value={userSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search by name or email…"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
              />
              {searchLoading && (
                <div className="absolute right-3 top-2.5 text-gray-400 text-xs">Searching…</div>
              )}
              {userResults.length > 0 && !selectedUser && (
                <div className="absolute top-full mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-lg z-10 overflow-hidden">
                  {userResults.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => { setSelectedUser(u); setUserSearch(u.name ?? u.email); setUserResults([]) }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left transition-colors"
                    >
                      <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600 shrink-0">
                        {u.name?.charAt(0)?.toUpperCase() ?? 'U'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{u.name ?? '—'}</p>
                        <p className="text-xs text-gray-500">{u.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm text-gray-600 font-medium">Role:</label>
            {(['ADMIN', 'EDITOR'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setAddRole(r)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  addRole === r
                    ? 'bg-green-800 text-white border-green-800'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>

          <div className="text-xs text-gray-400 mb-4">
            <strong>Admin</strong> — full access except removing owner.{' '}
            <strong>Editor</strong> — can edit content but not manage team or settings.
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => selectedUser && addMutation.mutate({ userId: selectedUser.id, role: addRole })}
              disabled={!selectedUser || addMutation.isPending}
              className="px-4 py-2 bg-green-800 text-white text-sm font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {addMutation.isPending ? 'Adding…' : 'Add Member'}
            </button>
            <button
              onClick={() => { setShowAddPanel(false); setSelectedUser(null); setUserSearch(''); setUserResults([]) }}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Admins Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {admins.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No team members found.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Member</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Added</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-green-800 flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {a.user.name?.charAt(0)?.toUpperCase() ?? 'U'}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{a.user.name ?? '—'}</p>
                        <p className="text-xs text-gray-500">{a.user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {a.role === 'OWNER' ? (
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${ROLE_COLORS[a.role]}`}>
                        {ROLE_LABELS[a.role]}
                      </span>
                    ) : (
                      <select
                        value={a.role}
                        onChange={(e) => changeMutation.mutate({ adminId: a.id, role: e.target.value })}
                        disabled={changeMutation.isPending}
                        className="text-xs font-semibold rounded-full px-2.5 py-1 border border-transparent cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-700 bg-green-100 text-green-700"
                      >
                        <option value="ADMIN">Admin</option>
                        <option value="EDITOR">Editor</option>
                      </select>
                    )}
                  </td>
                  <td className="px-5 py-4 text-xs text-gray-400">
                    {new Date(a.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {a.role !== 'OWNER' && (
                      <button
                        onClick={() => {
                          if (confirm(`Remove ${a.user.name ?? a.user.email} from this mosque?`)) {
                            removeMutation.mutate(a.id)
                          }
                        }}
                        disabled={removeMutation.isPending}
                        className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors disabled:opacity-50"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {removeMutation.error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {(removeMutation.error as Error).message}
        </div>
      )}
    </div>
  )
}
