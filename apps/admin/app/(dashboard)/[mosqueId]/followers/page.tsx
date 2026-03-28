'use client'

import { useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useAdminFetch } from '../../../../lib/adminFetch'
import { format } from 'date-fns'

interface FollowerUser {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
  gender: string | null
  birthdate: string | null
  age: number | null
  isOpenToVolunteer: boolean
  isOpenToMarriage: boolean
}

interface FollowerItem {
  id: string
  isFavorite: boolean
  followedAt: string
  user: FollowerUser
}

interface FollowersData {
  items: FollowerItem[]
  total: number
  page: number
  pageSize: number
}

type SortBy = 'newest' | 'oldest' | 'name'

function initials(name: string | null, email: string) {
  return (name ?? email).slice(0, 2).toUpperCase()
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
        active ? 'bg-green-800 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  )
}

export default function FollowersPage() {
  const { mosqueId } = useParams<{ mosqueId: string }>()
  const adminFetch = useAdminFetch()

  // Filters
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [isFavorite, setIsFavorite] = useState<'all' | 'true' | 'false'>('all')
  const [volunteer, setVolunteer] = useState<'all' | 'true' | 'false'>('all')
  const [marriage, setMarriage] = useState<'all' | 'true' | 'false'>('all')
  const [gender, setGender] = useState<'all' | 'male' | 'female' | 'other'>('all')
  const [ageMin, setAgeMin] = useState('')
  const [ageMax, setAgeMax] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('newest')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 25
  const [exporting, setExporting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  // Group message modal
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [messageForm, setMessageForm] = useState({ groupName: '', message: '' })
  const [messageSending, setMessageSending] = useState(false)
  const [messageResult, setMessageResult] = useState<string | null>(null)

  // Mass email modal
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailEmails, setEmailEmails] = useState<string[]>([])
  const [emailLoading, setEmailLoading] = useState(false)

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function handleSearchChange(val: string) {
    setSearch(val)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(val)
      setPage(1)
    }, 350)
  }

  function buildParams(overrides: Record<string, string> = {}) {
    const p: Record<string, string> = {
      page: String(page),
      limit: String(PAGE_SIZE),
      sortBy,
    }
    if (debouncedSearch) p.search = debouncedSearch
    if (isFavorite !== 'all') p.isFavorite = isFavorite
    if (volunteer !== 'all') p.isOpenToVolunteer = volunteer
    if (marriage !== 'all') p.isOpenToMarriage = marriage
    if (gender !== 'all') p.gender = gender
    if (ageMin) p.ageMin = ageMin
    if (ageMax) p.ageMax = ageMax
    return new URLSearchParams({ ...p, ...overrides }).toString()
  }

  const queryKey = ['followers', mosqueId, debouncedSearch, isFavorite, volunteer, marriage, gender, ageMin, ageMax, sortBy, page]

  const { data, isLoading, isError } = useQuery<FollowersData>({
    queryKey,
    queryFn: async () => {
      const res = await adminFetch(`/mosques/${mosqueId}/followers?${buildParams()}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = json?.error ?? `HTTP ${res.status}`
        setApiError(msg)
        throw new Error(msg)
      }
      setApiError(null)
      if (!json.data) throw new Error('No data in response')
      return json.data as FollowersData
    },
  })

  async function handleExport() {
    setExporting(true)
    try {
      const res = await adminFetch(`/mosques/${mosqueId}/followers?${buildParams({ all: 'true', page: '1', limit: '10000' })}`)
      const json = await res.json()
      const allItems: FollowerItem[] = json.data?.items ?? []
      const header = ['Name', 'Email', 'Gender', 'Age', 'Volunteer', 'Open to Marriage', 'Favorite', 'Followed At']
      const rows = allItems.map((f) => [
        f.user.name ?? '',
        f.user.email,
        f.user.gender ?? '',
        f.user.age != null ? String(f.user.age) : '',
        f.user.isOpenToVolunteer ? 'Yes' : 'No',
        f.user.isOpenToMarriage ? 'Yes' : 'No',
        f.isFavorite ? 'Yes' : 'No',
        format(new Date(f.followedAt), 'yyyy-MM-dd'),
      ])
      const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `followers-${format(new Date(), 'yyyy-MM-dd')}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  async function handleSendMessage() {
    if (!messageForm.groupName || !messageForm.message) return
    setMessageSending(true)
    setMessageResult(null)
    try {
      const res = await adminFetch(`/mosques/${mosqueId}/followers/group-message`, {
        method: 'POST',
        body: JSON.stringify({ groupName: messageForm.groupName, message: messageForm.message }),
      })
      const json = await res.json()
      if (res.ok) {
        setMessageResult(`✓ Group created and sent to ${json.data?.memberCount ?? 'all'} followers`)
        setTimeout(() => { setShowMessageModal(false); setMessageForm({ groupName: '', message: '' }); setMessageResult(null) }, 2500)
      } else {
        setMessageResult(json?.error ?? 'Failed to send')
      }
    } catch {
      setMessageResult('Failed to send. Please try again.')
    } finally {
      setMessageSending(false)
    }
  }

  async function handleOpenEmailModal() {
    setEmailLoading(true)
    setShowEmailModal(true)
    try {
      const res = await adminFetch(`/mosques/${mosqueId}/followers?${buildParams({ all: 'true', page: '1', limit: '10000' })}`)
      const json = await res.json()
      const emails = (json.data?.items ?? []).map((f: any) => f.user.email).filter(Boolean)
      setEmailEmails(emails)
    } finally {
      setEmailLoading(false)
    }
  }

  function clearFilters() {
    setSearch(''); setDebouncedSearch('')
    setIsFavorite('all'); setVolunteer('all'); setMarriage('all')
    setGender('all'); setAgeMin(''); setAgeMax('')
    setPage(1)
  }

  const hasFilters = debouncedSearch || isFavorite !== 'all' || volunteer !== 'all' || marriage !== 'all' || gender !== 'all' || ageMin || ageMax

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Followers</h1>
          <p className="text-gray-400 text-sm mt-1.5 font-medium">
            {isLoading ? 'Loading…' : `${total.toLocaleString()} follower${total !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMessageModal(true)}
            className="flex items-center gap-2 bg-green-800 text-white rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-green-900 transition-colors shadow-sm"
          >
            💬 Group Message
          </button>
          <button
            onClick={handleOpenEmailModal}
            className="flex items-center gap-2 bg-blue-700 text-white rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-blue-800 transition-colors shadow-sm"
          >
            📧 Mass Email
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 border border-gray-200 text-gray-700 rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            {exporting ? '⏳ Exporting…' : '⬇ Export CSV'}
          </button>
        </div>
      </div>

      {/* Filters card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5 space-y-4">
        {/* Search + sort */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300">🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-700 focus:border-transparent"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value as SortBy); setPage(1) }}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-700 bg-white text-gray-700"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">Name A–Z</option>
          </select>
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-red-400 hover:text-red-600 font-semibold">
              ✕ Clear filters
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-4">
          {/* Favorite */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Favorite</p>
            <div className="flex gap-1.5">
              <Chip active={isFavorite === 'all'} onClick={() => { setIsFavorite('all'); setPage(1) }}>All</Chip>
              <Chip active={isFavorite === 'true'} onClick={() => { setIsFavorite('true'); setPage(1) }}>⭐ Yes</Chip>
              <Chip active={isFavorite === 'false'} onClick={() => { setIsFavorite('false'); setPage(1) }}>No</Chip>
            </div>
          </div>

          {/* Volunteer */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Open to Volunteer</p>
            <div className="flex gap-1.5">
              <Chip active={volunteer === 'all'} onClick={() => { setVolunteer('all'); setPage(1) }}>All</Chip>
              <Chip active={volunteer === 'true'} onClick={() => { setVolunteer('true'); setPage(1) }}>✋ Yes</Chip>
              <Chip active={volunteer === 'false'} onClick={() => { setVolunteer('false'); setPage(1) }}>No</Chip>
            </div>
          </div>

          {/* Marriage */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Looking for Spouse</p>
            <div className="flex gap-1.5">
              <Chip active={marriage === 'all'} onClick={() => { setMarriage('all'); setPage(1) }}>All</Chip>
              <Chip active={marriage === 'true'} onClick={() => { setMarriage('true'); setPage(1) }}>💍 Yes</Chip>
              <Chip active={marriage === 'false'} onClick={() => { setMarriage('false'); setPage(1) }}>No</Chip>
            </div>
          </div>

          {/* Gender */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Gender</p>
            <div className="flex gap-1.5">
              <Chip active={gender === 'all'} onClick={() => { setGender('all'); setPage(1) }}>All</Chip>
              <Chip active={gender === 'male'} onClick={() => { setGender('male'); setPage(1) }}>Male</Chip>
              <Chip active={gender === 'female'} onClick={() => { setGender('female'); setPage(1) }}>Female</Chip>
              <Chip active={gender === 'other'} onClick={() => { setGender('other'); setPage(1) }}>Other</Chip>
            </div>
          </div>

          {/* Age range */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Age Range</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={ageMin}
                onChange={(e) => { setAgeMin(e.target.value); setPage(1) }}
                placeholder="Min"
                min={0} max={120}
                className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-700"
              />
              <span className="text-gray-300 text-xs">–</span>
              <input
                type="number"
                value={ageMax}
                onChange={(e) => { setAgeMax(e.target.value); setPage(1) }}
                placeholder="Max"
                min={0} max={120}
                className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-700"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center text-gray-400">
            <div className="inline-block w-8 h-8 border-2 border-green-800 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm">Loading followers…</p>
          </div>
        ) : isError ? (
          <div className="py-20 text-center text-gray-400">
            <p className="text-4xl mb-3">⚠️</p>
            <p className="text-sm font-medium text-red-500">Failed to load followers</p>
            {apiError && <p className="text-xs font-mono text-red-400 mt-2 px-8 break-all">{apiError}</p>}
          </div>
        ) : items.length === 0 ? (
          <div className="py-20 text-center text-gray-400">
            <p className="text-4xl mb-3">👥</p>
            <p className="text-sm font-medium">No followers match these filters</p>
            {hasFilters && (
              <button onClick={clearFilters} className="mt-3 text-xs text-green-700 font-semibold hover:underline">
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Follower</th>
                    <th className="text-center px-3 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide hidden lg:table-cell">Age</th>
                    <th className="text-center px-3 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide hidden lg:table-cell">Gender</th>
                    <th className="text-center px-3 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide hidden xl:table-cell">Volunteer</th>
                    <th className="text-center px-3 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide hidden xl:table-cell">Spouse</th>
                    <th className="text-center px-3 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Fav</th>
                    <th className="text-right px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Followed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map((f) => (
                    <tr key={f.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-green-800 flex items-center justify-center text-xs font-bold text-white shrink-0">
                            {initials(f.user.name, f.user.email)}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 leading-tight">{f.user.name ?? '—'}</p>
                            <p className="text-xs text-gray-400">{f.user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-center text-gray-600 text-xs hidden lg:table-cell">
                        {f.user.age ?? '—'}
                      </td>
                      <td className="px-3 py-3.5 text-center text-xs hidden lg:table-cell">
                        {f.user.gender ? (
                          <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{f.user.gender}</span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-3.5 text-center hidden xl:table-cell">
                        {f.user.isOpenToVolunteer
                          ? <span className="bg-green-50 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">Yes</span>
                          : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-3.5 text-center hidden xl:table-cell">
                        {f.user.isOpenToMarriage
                          ? <span className="bg-pink-50 text-pink-600 text-xs font-semibold px-2 py-0.5 rounded-full">Yes</span>
                          : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        <span className={f.isFavorite ? 'text-amber-400' : 'text-gray-200'}>
                          {f.isFavorite ? '⭐' : '☆'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-gray-400 text-xs whitespace-nowrap">
                        {format(new Date(f.followedAt), 'MMM d, yyyy')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 bg-gray-50/30">
                <p className="text-xs text-gray-400">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ← Prev
                  </button>
                  {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                    const n = totalPages <= 7 ? i + 1
                      : page <= 4 ? i + 1
                      : page >= totalPages - 3 ? totalPages - 6 + i
                      : page - 3 + i
                    return (
                      <button
                        key={n}
                        onClick={() => setPage(n)}
                        className={`w-8 h-8 text-xs font-medium rounded-lg ${n === page ? 'bg-green-800 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                      >
                        {n}
                      </button>
                    )
                  })}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {/* Group Message Modal */}
      {showMessageModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Create Group Message</h2>
            <p className="text-xs text-gray-400 mb-4">Creates a group chat visible in followers' Messages tab and sends a push notification to all followers</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Group Name</label>
                <input
                  value={messageForm.groupName}
                  onChange={e => setMessageForm(f => ({ ...f, groupName: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-700"
                  placeholder="e.g. Ramadan Announcements, Volunteer Signup…"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  value={messageForm.message}
                  onChange={e => setMessageForm(f => ({ ...f, message: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 h-24 resize-none focus:outline-none focus:ring-2 focus:ring-green-700"
                  placeholder="Write your message…"
                />
              </div>
              {messageResult && (
                <p className={`text-sm px-3 py-2 rounded-xl ${messageResult.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>{messageResult}</p>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={handleSendMessage}
                disabled={messageSending || !messageForm.groupName || !messageForm.message}
                className="bg-green-800 text-white rounded-xl px-5 py-2 text-sm font-semibold hover:bg-green-900 disabled:opacity-50"
              >
                {messageSending ? 'Creating…' : '💬 Create Group & Send'}
              </button>
              <button onClick={() => { setShowMessageModal(false); setMessageForm({ groupName: '', message: '' }); setMessageResult(null) }} className="border border-gray-200 text-gray-600 rounded-xl px-5 py-2 text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mass Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Mass Email</h2>
            <p className="text-xs text-gray-400 mb-4">Copy the emails below to use in your email client or marketing tool</p>
            {emailLoading ? (
              <div className="py-8 text-center text-gray-400 text-sm">Loading emails…</div>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-2 font-medium">{emailEmails.length} email{emailEmails.length !== 1 ? 's' : ''} for current filters</p>
                <textarea
                  readOnly
                  value={emailEmails.join(', ')}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-xs text-gray-700 h-36 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => { navigator.clipboard.writeText(emailEmails.join(', ')) }}
                    className="bg-blue-700 text-white rounded-xl px-5 py-2 text-sm font-semibold hover:bg-blue-800"
                  >
                    📋 Copy All Emails
                  </button>
                  <a
                    href={`mailto:?bcc=${emailEmails.slice(0, 100).join(',')}`}
                    className="border border-gray-200 text-gray-600 rounded-xl px-5 py-2 text-sm font-medium hover:bg-gray-50 inline-flex items-center"
                  >
                    Open in Email Client
                  </a>
                </div>
                {emailEmails.length > 100 && (
                  <p className="text-xs text-amber-600 mt-2">Email client link limited to first 100 addresses. Copy all for full list.</p>
                )}
              </>
            )}
            <button onClick={() => { setShowEmailModal(false); setEmailEmails([]) }} className="mt-4 text-sm text-gray-400 hover:text-gray-600">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
