'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAdminFetch } from '../../../lib/adminFetch'

// ── State name ↔ abbreviation map ───────────────────────────────────────────

const STATE_MAP: Record<string, string> = {
  alabama: 'al', alaska: 'ak', arizona: 'az', arkansas: 'ar', california: 'ca',
  colorado: 'co', connecticut: 'ct', delaware: 'de', florida: 'fl', georgia: 'ga',
  hawaii: 'hi', idaho: 'id', illinois: 'il', indiana: 'in', iowa: 'ia',
  kansas: 'ks', kentucky: 'ky', louisiana: 'la', maine: 'me', maryland: 'md',
  massachusetts: 'ma', michigan: 'mi', minnesota: 'mn', mississippi: 'ms',
  missouri: 'mo', montana: 'mt', nebraska: 'ne', nevada: 'nv',
  'new hampshire': 'nh', 'new jersey': 'nj', 'new mexico': 'nm', 'new york': 'ny',
  'north carolina': 'nc', 'north dakota': 'nd', ohio: 'oh', oklahoma: 'ok',
  oregon: 'or', pennsylvania: 'pa', 'rhode island': 'ri', 'south carolina': 'sc',
  'south dakota': 'sd', tennessee: 'tn', texas: 'tx', utah: 'ut', vermont: 'vt',
  virginia: 'va', washington: 'wa', 'west virginia': 'wv', wisconsin: 'wi', wyoming: 'wy',
}
const ABBR_MAP = Object.fromEntries(Object.entries(STATE_MAP).map(([k, v]) => [v, k]))

function matchesState(storedState: string, query: string): boolean {
  const s = storedState.toLowerCase()
  const q = query.toLowerCase()
  if (s.includes(q) || q.includes(s)) return true
  // query is a full name → check its abbreviation
  const abbr = STATE_MAP[q]
  if (abbr && s === abbr) return true
  // query is an abbreviation → check its full name
  const fullName = ABBR_MAP[q]
  if (fullName && s.includes(fullName)) return true
  return false
}

// ── Types ──────────────────────────────────────────────────────────────────

type ImportStatus = 'new' | 'already_imported' | 'possible_duplicate'

interface PlaceResult {
  placeId: string
  name: string
  address: string
  latitude: number | null
  longitude: number | null
  rating: number | null
  status: ImportStatus
  existingMosqueId: string | null
  existingMosqueName: string | null
}

interface EditFields {
  city: string
  state: string
  zipCode: string
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseAddressParts(address: string): EditFields {
  const parts = address.split(',').map((p) => p.trim())
  // US addresses end with: ..., City, ST ZIP, USA  (count from right)
  if (parts.length >= 4) {
    const city = parts[parts.length - 3] ?? ''
    const stateZip = parts[parts.length - 2] ?? ''
    const [state = '', zipCode = ''] = stateZip.split(' ')
    return { city, state, zipCode }
  }
  const city = parts[1] ?? ''
  const stateZip = parts[2] ?? ''
  const [state = '', zipCode = ''] = stateZip.split(' ')
  return { city, state, zipCode }
}

// ── Status badge ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ImportStatus | 'imported' }) {
  if (status === 'imported') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full" style={{ background: '#D8F0DF', color: '#155F31' }}>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        Imported
      </span>
    )
  }
  if (status === 'already_imported') {
    return <span className="px-2.5 py-1 text-xs font-semibold rounded-full" style={{ background: '#EDE6D5', color: '#8FA898' }}>In DB</span>
  }
  if (status === 'possible_duplicate') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full" style={{ background: '#FFF7ED', color: '#B45309', border: '1px solid #FED7AA' }}>
        ⚠ Possible Duplicate
      </span>
    )
  }
  return <span className="px-2.5 py-1 text-xs font-bold rounded-full" style={{ background: '#D8F0DF', color: '#0F4423' }}>New</span>
}

// ── Assign Admin Modal ───────────────────────────────────────────────────

function AssignAdminModal({
  mosqueId,
  mosqueName,
  currentOwner,
  adminFetch,
  onClose,
}: {
  mosqueId: string
  mosqueName: string
  currentOwner?: { name: string | null; email: string } | null
  adminFetch: ReturnType<typeof useAdminFetch>
  onClose: () => void
}) {
  const [userSearch, setUserSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string | null; email: string } | null>(null)
  const [role, setRole] = useState<'OWNER' | 'ADMIN' | 'EDITOR'>('OWNER')
  const [success, setSuccess] = useState<string | null>(null)

  const { data: searchData } = useQuery({
    queryKey: ['user-search-assign', userSearch],
    queryFn: async () => {
      const res = await adminFetch(`/admin/users/search?q=${encodeURIComponent(userSearch)}&limit=8`)
      const json = await res.json()
      return json.data as { items: Array<{ id: string; name: string | null; email: string }> }
    },
    enabled: userSearch.trim().length >= 2 && !selectedUser,
  })
  const userResults = searchData?.items ?? []

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUser) throw new Error('No user selected')
      const res = await adminFetch('/admin/mosque-import/assign-admin', {
        method: 'POST',
        body: JSON.stringify({ mosqueId, userId: selectedUser.id, role }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'Failed to assign admin')
      return json.data
    },
    onSuccess: (data) => {
      setSuccess(
        `${data.user.name ?? data.user.email} is now ${data.admin.role} of ${data.mosque.name}`
      )
    },
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5">
          <h2 className="text-lg font-bold text-gray-900">
            {currentOwner ? 'Change Owner' : 'Assign Admin'}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5 truncate" title={mosqueName}>
            {mosqueName}
          </p>
        </div>

        {/* Current owner warning */}
        {currentOwner && role === 'OWNER' && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
            <span className="font-semibold">Current owner:</span> {currentOwner.name ?? currentOwner.email}
            {currentOwner.name && <span className="text-amber-600 ml-1">({currentOwner.email})</span>}
            <p className="text-xs text-amber-600 mt-1">Assigning a new owner will remove them from this role.</p>
          </div>
        )}

        {success ? (
          <>
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm mb-5">
              ✓ {success}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setSuccess(null); setSelectedUser(null); setUserSearch('') }}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Assign another
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-2.5 bg-green-800 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors"
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            {/* User search */}
            <div className="mb-4 relative">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                Search user by name or email
              </label>
              <input
                value={selectedUser ? (selectedUser.name ?? selectedUser.email) : userSearch}
                onChange={(e) => { setUserSearch(e.target.value); setSelectedUser(null) }}
                placeholder="Type to search…"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
              />
              {selectedUser && (
                <button
                  onClick={() => { setSelectedUser(null); setUserSearch('') }}
                  className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600 text-xs"
                >
                  ✕
                </button>
              )}
              {userResults.length > 0 && !selectedUser && (
                <div className="absolute left-0 right-0 top-[66px] bg-white rounded-xl border border-gray-100 shadow-lg divide-y divide-gray-50 max-h-44 overflow-y-auto z-10">
                  {userResults.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => { setSelectedUser(u); setUserSearch('') }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-gray-50 text-sm"
                    >
                      <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-green-800 text-xs font-bold flex-shrink-0">
                        {(u.name ?? u.email)?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{u.name ?? u.email}</p>
                        {u.name && <p className="text-xs text-gray-400">{u.email}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Role */}
            <div className="mb-5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Role</label>
              <div className="flex gap-2">
                {(['OWNER', 'ADMIN', 'EDITOR'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                      role === r
                        ? 'bg-green-800 text-white border-green-800'
                        : 'border-gray-200 text-gray-600 hover:border-green-300'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                {role === 'OWNER'
                  ? 'Full control — can manage admins, settings, and all content'
                  : role === 'ADMIN'
                  ? 'Can manage content and followers'
                  : 'Can edit content only'}
              </p>
            </div>

            {assignMutation.error && (
              <p className="mb-3 text-sm text-red-600">{(assignMutation.error as Error).message}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => assignMutation.mutate()}
                disabled={!selectedUser || assignMutation.isPending}
                className="flex-1 py-2.5 bg-green-800 text-white text-sm font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {assignMutation.isPending ? 'Saving…' : currentOwner && role === 'OWNER' ? 'Replace Owner' : 'Assign Admin'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Bulk US Import Tab ───────────────────────────────────────────────────

function BulkImportTab({ adminFetch }: { adminFetch: ReturnType<typeof useAdminFetch> }) {
  const queryClient = useQueryClient()

  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ['bulk-import-status'],
    queryFn: async () => {
      const res = await adminFetch('/admin/mosque-import/bulk-status')
      const json = await res.json()
      return json.data as {
        running: boolean; total: number; imported: number; skipped: number
        errors: number; currentQuery: string; log: string[]; finishedAt: string | null
      }
    },
    refetchInterval: (query) => query.state.data?.running ? 2000 : false,
  })

  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await adminFetch('/admin/mosque-import/bulk-us', { method: 'POST', body: JSON.stringify({}) })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`)
      return json
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bulk-import-status'] }),
  })

  const status = statusData

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <h2 className="text-base font-bold text-gray-900 mb-1">Bulk US Mosque Import</h2>
        <p className="text-sm text-gray-500 mb-5">
          Queries Google Places for mosques across all 50 states and major US Muslim-population cities.
          Runs in the background. Skips duplicates automatically.
        </p>

        {status?.running ? (
          <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl border border-green-200">
            <svg className="animate-spin w-5 h-5 text-green-700 flex-shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3V0a12 12 0 100 24v-4l-3 3 3 3v4a12 12 0 01-12-12z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-green-800">Import running…</p>
              <p className="text-xs text-green-600 mt-0.5">Current query: {status.currentQuery || '…'}</p>
            </div>
          </div>
        ) : status?.finishedAt ? (
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-600 mb-4">
            Last run finished at {new Date(status.finishedAt).toLocaleString()}
          </div>
        ) : null}

        {status && (
          <div className="grid grid-cols-4 gap-4 my-5">
            {[
              { label: 'Imported', value: status.imported, color: 'text-green-700' },
              { label: 'Skipped', value: status.skipped, color: 'text-gray-500' },
              { label: 'Errors', value: status.errors, color: 'text-red-600' },
              { label: 'Total Places', value: status.total, color: 'text-gray-700' },
            ].map((s) => (
              <div key={s.label} className="bg-gray-50 rounded-xl p-4 text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {startMutation.error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {(startMutation.error as Error).message}
          </div>
        )}

        <button
          onClick={() => startMutation.mutate()}
          disabled={status?.running || startMutation.isPending}
          className="px-5 py-2.5 bg-green-800 text-white text-sm font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {status?.running ? 'Running…' : status?.finishedAt ? '🔄 Run Again' : '🚀 Start Bulk Import'}
        </button>
      </div>

      {status && status.log.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Import Log (last {status.log.length})</h3>
          <div className="font-mono text-xs text-gray-600 max-h-72 overflow-y-auto space-y-0.5">
            {status.log.slice(-100).map((line, i) => (
              <p key={i} className={line.startsWith('✓') ? 'text-green-700' : 'text-red-600'}>{line}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Unowned Mosques Tab ──────────────────────────────────────────────────

function UnownedMosquesTab({
  adminFetch,
  onAssign,
}: {
  adminFetch: ReturnType<typeof useAdminFetch>
  onAssign: (mosqueId: string, mosqueName: string, currentOwner?: { name: string | null; email: string } | null) => void
}) {
  const queryClient = useQueryClient()
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [syncResults, setSyncResults] = useState<Record<string, string>>({})
  const [searchText, setSearchText] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['unowned-mosques'],
    queryFn: async () => {
      const res = await adminFetch('/admin/mosque-import/unowned?limit=1500')
      const json = await res.json()
      return json.data as {
        items: Array<{
          id: string; name: string; city: string; state: string; zipCode: string | null
          googlePlaceId: string | null; importSource: string | null
          importedAt: string | null; lastSyncedAt?: string | null
        }>
        hasMore: boolean
      }
    },
  })

  async function resyncMosque(mosqueId: string, mosqueName: string) {
    setSyncingId(mosqueId)
    try {
      const res = await adminFetch(`/admin/mosque-import/resync/${mosqueId}`, { method: 'POST', body: JSON.stringify({}) })
      const json = await res.json()
      if (res.ok) {
        setSyncResults((r) => ({ ...r, [mosqueId]: `✓ Synced ${new Date(json.data.lastSyncedAt).toLocaleDateString()}` }))
        queryClient.invalidateQueries({ queryKey: ['unowned-mosques'] })
      } else {
        setSyncResults((r) => ({ ...r, [mosqueId]: `✗ ${json.error}` }))
      }
    } catch {
      setSyncResults((r) => ({ ...r, [mosqueId]: '✗ Network error' }))
    } finally {
      setSyncingId(null)
    }
  }

  const q = searchText.trim().toLowerCase()
  const mosques = (data?.items ?? []).filter((m) => {
    if (!q) return true
    return (
      m.name.toLowerCase().includes(q) ||
      m.city.toLowerCase().includes(q) ||
      matchesState(m.state ?? '', q) ||
      (m.zipCode ?? '').includes(q)
    )
  })

  if (isLoading) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-gray-100">
        <svg className="animate-spin w-6 h-6 text-green-700 mx-auto" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3V0a12 12 0 100 24v-4l-3 3 3 3v4a12 12 0 01-12-12z" />
        </svg>
      </div>
    )
  }

  const allItems = data?.items ?? []

  if (allItems.length === 0) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-gray-100">
        <div className="text-4xl mb-3">✅</div>
        <p className="text-gray-600 font-semibold">All mosques have an owner assigned</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4">
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search by name, city, state, or zip code..."
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800"
        />
      </div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          <span className="font-semibold text-gray-900">{mosques.length}</span>
          {q ? ` result${mosques.length !== 1 ? 's' : ''}` : ' unowned mosques'}
          {!q && data?.hasMore && ' (showing first 500)'}
        </p>
        <p className="text-xs text-gray-400">
          Mosques with a Google Place ID can be resynced to refresh their phone/website/description — no new search needed.
        </p>
      </div>
      {mosques.length === 0 && (
        <div className="p-8 text-center bg-white rounded-2xl border border-gray-100">
          <p className="text-gray-500 text-sm">No mosques match <span className="font-semibold">"{searchText}"</span></p>
        </div>
      )}
      <div className="space-y-2">
        {mosques.map((m) => (
          <div key={m.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm truncate">{m.name}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <p className="text-xs text-gray-400">{m.city}, {m.state}{m.zipCode ? ` ${m.zipCode}` : ''}</p>
                {m.importSource === 'google_places' && (
                  <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-semibold border border-blue-100">
                    Google Places
                  </span>
                )}
                {m.lastSyncedAt && (
                  <span className="text-[10px] text-gray-400">
                    synced {new Date(m.lastSyncedAt).toLocaleDateString()}
                  </span>
                )}
                {syncResults[m.id] && (
                  <span className={`text-[10px] font-semibold ${syncResults[m.id].startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>
                    {syncResults[m.id]}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {m.googlePlaceId && (
                <button
                  onClick={() => resyncMosque(m.id, m.name)}
                  disabled={syncingId === m.id}
                  className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                  title="Re-fetch phone/website/description from Google (free, uses stored Place ID)"
                >
                  {syncingId === m.id ? (
                    <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3V0a12 12 0 100 24v-4l-3 3 3 3v4a12 12 0 01-12-12z"/>
                    </svg>
                  ) : (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                    </svg>
                  )}
                  Resync
                </button>
              )}
              <button
                onClick={() => onAssign(m.id, m.name)}
                className="px-3 py-1.5 bg-green-800 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors"
              >
                Assign Owner →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── All Mosques Tab ──────────────────────────────────────────────────────

function AllMosquesTab({
  adminFetch,
  onAssign,
}: {
  adminFetch: ReturnType<typeof useAdminFetch>
  onAssign: (mosqueId: string, mosqueName: string, currentOwner?: { name: string | null; email: string } | null) => void
}) {
  const [searchText, setSearchText] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['all-mosques', submittedQuery],
    queryFn: async () => {
      const params = submittedQuery ? `?q=${encodeURIComponent(submittedQuery)}&limit=1500` : '?limit=1500'
      const res = await adminFetch(`/admin/mosque-import/all${params}`)
      const json = await res.json()
      return json.data as {
        items: Array<{
          id: string; name: string; city: string; state: string; zipCode: string | null
          isVerified: boolean; importSource: string | null
          owner: { name: string | null; email: string } | null
        }>
        hasMore: boolean
      }
    },
  })

  const mosques = data?.items ?? []

  return (
    <div>
      <form
        onSubmit={(e) => { e.preventDefault(); setSubmittedQuery(searchText.trim()) }}
        className="flex gap-2 mb-4"
      >
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search by name, city, state, or zip code..."
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800"
        />
        <button
          type="submit"
          className="px-4 py-2.5 bg-green-800 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors"
        >
          Search
        </button>
        {submittedQuery && (
          <button
            type="button"
            onClick={() => { setSearchText(''); setSubmittedQuery('') }}
            className="px-3 py-2.5 border border-gray-200 text-gray-500 text-sm rounded-xl hover:bg-gray-50 transition-colors"
          >
            Clear
          </button>
        )}
      </form>

      {(isLoading || isFetching) ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-gray-100">
          <svg className="animate-spin w-6 h-6 text-green-700 mx-auto" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3V0a12 12 0 100 24v-4l-3 3 3 3v4a12 12 0 01-12-12z" />
          </svg>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">
              <span className="font-semibold text-gray-900">{mosques.length}</span>
              {submittedQuery ? ` result${mosques.length !== 1 ? 's' : ''} for "${submittedQuery}"` : ' mosques'}
              {data?.hasMore && ' (showing first 1500 — refine your search)'}
            </p>
          </div>

          {mosques.length === 0 && submittedQuery && (
            <div className="p-8 text-center bg-white rounded-2xl border border-gray-100">
              <p className="text-gray-500 text-sm">No mosques match <span className="font-semibold">"{submittedQuery}"</span></p>
            </div>
          )}

          <div className="space-y-2">
            {mosques.map((m) => (
              <div key={m.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900 text-sm truncate">{m.name}</p>
                    {m.isVerified && <span className="text-xs font-bold shrink-0" style={{ color: '#C9963A' }}>✓</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <p className="text-xs text-gray-400">{m.city}, {m.state}{m.zipCode ? ` ${m.zipCode}` : ''}</p>
                    {m.owner ? (
                      <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-[10px] font-semibold border border-green-100">
                        {m.owner.name ?? m.owner.email}
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded text-[10px] font-semibold border border-orange-100">No owner</span>
                    )}
                    {m.importSource === 'google_places' && (
                      <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-semibold border border-blue-100">Google Places</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => onAssign(m.id, m.name, m.owner)}
                  className="px-3 py-1.5 bg-green-800 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors shrink-0"
                >
                  {m.owner ? 'Change Owner →' : 'Assign Owner →'}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────

export default function MosqueImportPage() {
  const adminFetch = useAdminFetch()
  const [activeTab, setActiveTab] = useState<'search' | 'bulk' | 'unowned' | 'all'>('search')

  // Search
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlaceResult[]>([])
  const [editMap, setEditMap] = useState<Record<string, EditFields>>({})

  // Per-result state
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set())
  const [importedMosques, setImportedMosques] = useState<Record<string, { id: string; name: string }>>({})
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isDuplicateError, setIsDuplicateError] = useState<Set<string>>(new Set())

  // Assign admin modal
  const [assignTarget, setAssignTarget] = useState<{ mosqueId: string; mosqueName: string; currentOwner?: { name: string | null; email: string } | null } | null>(null)

  // ── Search mutation ──────────────────────────────────────────────────────
  const searchMutation = useMutation({
    mutationFn: async (q: string) => {
      const res = await adminFetch('/admin/mosque-import/search', {
        method: 'POST',
        body: JSON.stringify({ query: q }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`)
      return json.data.items as PlaceResult[]
    },
    onSuccess: (items) => {
      setResults(items)
      setSelected(new Set())
      setImportedIds(new Set())
      setImportedMosques({})
      setPendingIds(new Set())
      setErrors({})
      setIsDuplicateError(new Set())

      const initial: Record<string, EditFields> = {}
      items.forEach((p) => {
        initial[p.placeId] = parseAddressParts(p.address ?? '')
      })
      setEditMap(initial)
    },
  })

  // ── Import a single mosque ───────────────────────────────────────────────
  async function importOne(place: PlaceResult, force = false) {
    const edit = editMap[place.placeId] ?? { city: '', state: '', zipCode: '' }
    if (!edit.city || !edit.state) return

    setPendingIds((s) => new Set([...s, place.placeId]))
    setErrors((e) => { const n = { ...e }; delete n[place.placeId]; return n })
    setIsDuplicateError((s) => { const n = new Set(s); n.delete(place.placeId); return n })

    try {
      // Fetch all enrichment data from Place Details in ONE call — no future Google calls needed
      let phone: string | null = null
      let website: string | null = null
      let description: string | null = null
      try {
        const detailsRes = await adminFetch('/admin/mosque-import/details', {
          method: 'POST',
          body: JSON.stringify({ placeId: place.placeId }),
        })
        const detailsJson = await detailsRes.json()
        if (detailsRes.ok) {
          phone = detailsJson.data?.phone ?? null
          website = detailsJson.data?.website ?? null
          description = detailsJson.data?.description ?? null
        }
      } catch {}

      const res = await adminFetch('/admin/mosque-import/save', {
        method: 'POST',
        body: JSON.stringify({
          placeId: place.placeId,
          name: place.name,
          address: place.address,
          city: edit.city,
          state: edit.state,
          zipCode: edit.zipCode || undefined,
          latitude: place.latitude,
          longitude: place.longitude,
          phone: phone || undefined,
          website: website || undefined,
          description: description || undefined,
          forceImport: force,
        }),
      })
      const json = await res.json()

      if (!res.ok) {
        setErrors((e) => ({ ...e, [place.placeId]: json?.error ?? 'Import failed' }))
        if (json?.data?.isDuplicate) {
          setIsDuplicateError((s) => new Set([...s, place.placeId]))
        }
        return
      }

      setImportedIds((s) => new Set([...s, place.placeId]))
      setImportedMosques((m) => ({ ...m, [place.placeId]: { id: json.data.id, name: json.data.name } }))
      setSelected((s) => { const n = new Set(s); n.delete(place.placeId); return n })
    } finally {
      setPendingIds((s) => { const n = new Set(s); n.delete(place.placeId); return n })
    }
  }

  // ── Bulk import selected ─────────────────────────────────────────────────
  async function importSelected() {
    for (const placeId of selected) {
      const place = results.find((r) => r.placeId === placeId)
      if (!place || importedIds.has(placeId)) continue
      await importOne(place)
    }
  }

  // ── Select helpers ───────────────────────────────────────────────────────
  function toggleSelect(placeId: string) {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(placeId)) n.delete(placeId)
      else n.add(placeId)
      return n
    })
  }

  function selectAllNew() {
    const importable = results.filter(
      (r) => r.status === 'new' && !importedIds.has(r.placeId) && !pendingIds.has(r.placeId)
    )
    setSelected(new Set(importable.map((r) => r.placeId)))
  }

  // ── Derived state ────────────────────────────────────────────────────────
  const newCount = results.filter((r) => r.status === 'new').length
  const dupCount = results.filter((r) => r.status === 'possible_duplicate').length
  const existingCount = results.filter((r) => r.status === 'already_imported').length
  const importableNew = results.filter(
    (r) => r.status === 'new' && !importedIds.has(r.placeId) && !pendingIds.has(r.placeId)
  )
  const importingBulk = pendingIds.size > 0

  return (
    <div className="p-8 max-w-5xl page-content">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'Fraunces, Georgia, serif', color: '#0F2D1F' }}>
          Mosque Import
        </h1>
        <p className="text-sm mt-1" style={{ color: '#8FA898' }}>
          Import from Google Places once — all data is saved locally. Google is never called again at runtime.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl p-1 mb-6 w-fit" style={{ background: '#EDE6D5' }}>
        {([
          { key: 'search',  label: 'Search' },
          { key: 'bulk',    label: 'Bulk US Import' },
          { key: 'unowned', label: 'Unowned Mosques' },
          { key: 'all',     label: 'All Mosques' },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-150"
            style={
              activeTab === tab.key
                ? { background: '#fff', color: '#0F2D1F', boxShadow: '0 1px 4px rgba(15,44,23,0.1)' }
                : { color: '#8FA898' }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'bulk' && <BulkImportTab adminFetch={adminFetch} />}
      {activeTab === 'unowned' && (
        <UnownedMosquesTab
          adminFetch={adminFetch}
          onAssign={(mosqueId, mosqueName) => setAssignTarget({ mosqueId, mosqueName })}
        />
      )}
      {activeTab === 'all' && (
        <AllMosquesTab
          adminFetch={adminFetch}
          onAssign={(mosqueId, mosqueName, currentOwner) => setAssignTarget({ mosqueId, mosqueName, currentOwner })}
        />
      )}

      {activeTab !== 'search' && assignTarget && (
        <AssignAdminModal
          mosqueId={assignTarget.mosqueId}
          mosqueName={assignTarget.mosqueName}
          currentOwner={assignTarget.currentOwner}
          adminFetch={adminFetch}
          onClose={() => setAssignTarget(null)}
        />
      )}

      {activeTab !== 'search' ? null : (<>

      {/* Search card */}
      <div className="rounded-2xl p-6 mb-6" style={{ background: '#fff', border: '1px solid #EDE6D5', boxShadow: '0 1px 4px rgba(15,44,23,0.05)' }}>
        <label className="text-[10px] font-bold uppercase tracking-widest block mb-3" style={{ color: '#8FA898' }}>
          Search by city, area, or zip
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) =>
              e.key === 'Enter' && query.trim().length >= 2 && searchMutation.mutate(query.trim())
            }
            placeholder="e.g. Dallas TX · Houston · 77001 · Chicago IL"
            className="flex-1 rounded-xl px-4 py-2.5 text-sm transition-shadow"
            style={{ border: '1.5px solid #EDE6D5', color: '#1A2E22', background: '#FEFDFB' }}
          />
          <button
            onClick={() => query.trim().length >= 2 && searchMutation.mutate(query.trim())}
            disabled={searchMutation.isPending || query.trim().length < 2}
            className="px-5 py-2.5 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-all whitespace-nowrap"
            style={{ background: 'linear-gradient(135deg, #155F31 0%, #0F4423 100%)', boxShadow: '0 2px 8px rgba(15,68,35,0.25)' }}
          >
            {searchMutation.isPending ? 'Searching…' : 'Search Google Places'}
          </button>
        </div>
        {searchMutation.error && (
          <div className="mt-3 p-3 rounded-xl text-sm" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C' }}>
            {(searchMutation.error as Error).message}
          </div>
        )}
        <p className="text-xs mt-3" style={{ color: '#A8BFB0' }}>
          Google is called only here. After import, all mosque data lives in your database — zero Google calls at runtime.
        </p>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <>
          {/* Summary + bulk actions */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex flex-wrap gap-3 items-center text-sm">
              <span className="text-gray-500 font-medium">{results.length} results</span>
              {newCount > 0 && (
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">
                  {newCount} new
                </span>
              )}
              {dupCount > 0 && (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
                  {dupCount} possible duplicate{dupCount !== 1 ? 's' : ''}
                </span>
              )}
              {existingCount > 0 && (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs font-semibold rounded-full">
                  {existingCount} already in DB
                </span>
              )}
              {importedIds.size > 0 && (
                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                  {importedIds.size} imported this session
                </span>
              )}
            </div>

            {importableNew.length > 0 && (
              <div className="flex items-center gap-3">
                {selected.size === 0 ? (
                  <button
                    onClick={selectAllNew}
                    className="text-xs text-green-700 font-semibold hover:underline"
                  >
                    Select all {importableNew.length} new
                  </button>
                ) : (
                  <>
                    <button onClick={() => setSelected(new Set())} className="text-xs text-gray-400 hover:underline">
                      Clear selection
                    </button>
                    <button
                      onClick={importSelected}
                      disabled={importingBulk}
                      className="px-4 py-2 bg-green-800 text-white text-xs font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {importingBulk ? `Importing…` : `Import ${selected.size} selected`}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Result cards */}
          <div className="space-y-3">
            {results.map((p) => {
              const edit = editMap[p.placeId] ?? { city: '', state: '', zipCode: '' }
              const isImported = importedIds.has(p.placeId)
              const isPending = pendingIds.has(p.placeId)
              const err = errors[p.placeId]
              const isDup = isDuplicateError.has(p.placeId)
              const isSelected = selected.has(p.placeId)
              const importedData = importedMosques[p.placeId]
              const effectiveStatus = isImported ? 'imported' : p.status

              const cardStyle = isImported
                ? { background: '#F7FFF9', border: '1px solid #A8D9B8', boxShadow: '0 1px 4px rgba(15,44,23,0.06)' }
                : isPending
                ? { background: '#fff', border: '1px solid #A8D9B8', boxShadow: '0 1px 4px rgba(15,44,23,0.06)' }
                : p.status === 'already_imported'
                ? { background: '#FAFAF8', border: '1px solid #EDE6D5', opacity: 0.65 }
                : p.status === 'possible_duplicate'
                ? { background: '#FFFDF5', border: '1px solid #F5E6C8', boxShadow: '0 1px 4px rgba(201,150,58,0.1)' }
                : isSelected
                ? { background: '#F7FFF9', border: '1.5px solid #6EBD87', boxShadow: '0 1px 8px rgba(15,44,23,0.08)' }
                : { background: '#fff', border: '1px solid #EDE6D5', boxShadow: '0 1px 3px rgba(15,44,23,0.04)' }

              return (
                <div key={p.placeId} className="rounded-2xl p-5 transition-all" style={cardStyle}>
                  <div className="flex items-start gap-3">
                    {/* Checkbox for new/unimported */}
                    {(p.status === 'new' || p.status === 'possible_duplicate') && !isImported && !isPending && (
                      <div className="pt-0.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(p.placeId)}
                          className="w-4 h-4 rounded accent-green-700 cursor-pointer"
                        />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      {/* Name + status */}
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 leading-tight">{p.name}</h3>
                          <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{p.address}</p>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            {p.latitude != null && p.longitude != null && (
                              <span className="text-xs text-gray-300 font-mono">
                                {p.latitude.toFixed(4)}, {p.longitude.toFixed(4)}
                              </span>
                            )}
                            {p.rating != null && (
                              <span className="text-xs text-amber-500">★ {p.rating}</span>
                            )}
                          </div>
                        </div>
                        <StatusBadge status={effectiveStatus} />
                      </div>

                      {/* Already in DB — show link to existing mosque + assign admin */}
                      {p.status === 'already_imported' && !isImported && p.existingMosqueId && (
                        <div className="mt-3 flex items-center gap-3">
                          <span className="text-xs text-gray-400">
                            Saved as: <span className="font-medium text-gray-600">{p.existingMosqueName}</span>
                          </span>
                          <button
                            onClick={() => setAssignTarget({ mosqueId: p.existingMosqueId!, mosqueName: p.existingMosqueName ?? p.name })}
                            className="text-xs text-green-700 font-semibold hover:underline"
                          >
                            Assign Admin →
                          </button>
                        </div>
                      )}

                      {/* Just imported this session — assign admin CTA */}
                      {isImported && importedData && (
                        <div className="mt-3 flex items-center gap-3">
                          <button
                            onClick={() => setAssignTarget({ mosqueId: importedData.id, mosqueName: importedData.name })}
                            className="px-3 py-1.5 bg-green-800 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors"
                          >
                            Assign Admin →
                          </button>
                        </div>
                      )}

                      {/* Loading state */}
                      {isPending && (
                        <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                          <svg className="animate-spin w-3.5 h-3.5 text-green-700" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3V0a12 12 0 100 24v-4l-3 3 3 3v4a12 12 0 01-12-12z" />
                          </svg>
                          Fetching details &amp; saving…
                        </div>
                      )}

                      {/* Edit fields + import button for new/duplicate */}
                      {(p.status === 'new' || p.status === 'possible_duplicate') && !isImported && !isPending && (
                        <>
                          {p.status === 'possible_duplicate' && p.existingMosqueName && (
                            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                              Similar to <span className="font-semibold">{p.existingMosqueName}</span> already in your database. Review carefully before importing.
                            </div>
                          )}

                          <div className="grid grid-cols-3 gap-2 mt-3">
                            <div>
                              <label className="text-xs text-gray-500 font-medium block mb-1">City *</label>
                              <input
                                value={edit.city}
                                onChange={(e) =>
                                  setEditMap((m) => ({ ...m, [p.placeId]: { ...edit, city: e.target.value } }))
                                }
                                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
                                placeholder="City"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 font-medium block mb-1">State *</label>
                              <input
                                value={edit.state}
                                onChange={(e) =>
                                  setEditMap((m) => ({ ...m, [p.placeId]: { ...edit, state: e.target.value } }))
                                }
                                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
                                placeholder="TX"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 font-medium block mb-1">ZIP</label>
                              <input
                                value={edit.zipCode}
                                onChange={(e) =>
                                  setEditMap((m) => ({ ...m, [p.placeId]: { ...edit, zipCode: e.target.value } }))
                                }
                                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
                                placeholder="77001"
                              />
                            </div>
                          </div>

                          {err && (
                            <div className="mt-2 flex items-start justify-between gap-2">
                              <p className="text-xs text-red-600">{err}</p>
                              {isDup && (
                                <button
                                  onClick={() => importOne(p, true)}
                                  className="text-xs text-amber-600 font-semibold hover:underline whitespace-nowrap flex-shrink-0"
                                >
                                  Import anyway
                                </button>
                              )}
                            </div>
                          )}

                          <div className="mt-3 flex items-center gap-3">
                            <button
                              onClick={() => importOne(p)}
                              disabled={!edit.city || !edit.state}
                              className="px-4 py-2 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-all"
                              style={{ background: 'linear-gradient(135deg, #155F31 0%, #0F4423 100%)', boxShadow: '0 2px 8px rgba(15,68,35,0.2)' }}
                            >
                              Import Mosque
                            </button>
                            {!edit.city || !edit.state ? (
                              <span className="text-xs text-gray-400">Fill in City and State to import</span>
                            ) : null}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Empty state after search */}
      {results.length === 0 && searchMutation.isSuccess && !searchMutation.isPending && (
        <div className="p-12 text-center bg-white rounded-2xl border border-gray-100">
          <div className="text-4xl mb-3">🕌</div>
          <p className="text-gray-600 font-semibold mb-1">No results found</p>
          <p className="text-gray-400 text-sm">Try a different city, area, or zip code</p>
        </div>
      )}

      {/* Idle state */}
      {!searchMutation.isSuccess && !searchMutation.isPending && !searchMutation.error && (
        <div className="p-12 text-center bg-white rounded-2xl border border-gray-100">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-gray-600 font-semibold mb-2">Search to get started</p>
          <p className="text-gray-400 text-sm max-w-sm mx-auto">
            Enter a city or area above. We'll search Google Places, check for duplicates, and let you review before saving anything.
          </p>
        </div>
      )}

      {/* Assign admin modal */}
      {assignTarget && (
        <AssignAdminModal
          mosqueId={assignTarget.mosqueId}
          mosqueName={assignTarget.mosqueName}
          currentOwner={assignTarget.currentOwner}
          adminFetch={adminFetch}
          onClose={() => setAssignTarget(null)}
        />
      )}

      </>)}
    </div>
  )
}
