'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { useAdminFetch } from '../../../../lib/adminFetch'

// ─── Sub-components ─────────────────────────────────────────────────────────

function Avatar({ name, size = 9 }: { name?: string; size?: number }) {
  const s = `w-${size} h-${size}`
  return (
    <div className={`${s} rounded-full bg-green-100 flex items-center justify-center text-green-800 font-bold text-sm flex-shrink-0`}>
      {name?.[0]?.toUpperCase() ?? '?'}
    </div>
  )
}

function UserDetailModal({ user, onClose }: { user: any; onClose: () => void }) {
  if (!user) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-80 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <Avatar name={user.name} size={12} />
          <div>
            <p className="font-semibold text-gray-900">{user.name ?? 'Anonymous'}</p>
            {user.email && <p className="text-xs text-gray-500">{user.email}</p>}
          </div>
        </div>
        {user.email && (
          <a href={`mailto:${user.email}`} className="flex items-center gap-2 text-sm text-green-700 hover:underline mb-4">
            <span>✉️</span> {user.email}
          </a>
        )}
        <button onClick={onClose} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl py-2 text-sm font-medium transition-colors">
          Close
        </button>
      </div>
    </div>
  )
}

// ─── Create Group Chat Modal ─────────────────────────────────────────────────

function CreateGroupModal({
  mosqueId,
  adminFetch,
  onClose,
  onCreated,
}: {
  mosqueId: string
  adminFetch: ReturnType<typeof import('../../../../lib/adminFetch').useAdminFetch>
  onClose: () => void
  onCreated: (group: any) => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<any[]>([])

  const { data: followersData } = useQuery({
    queryKey: ['mosque-followers', mosqueId, search],
    queryFn: () =>
      adminFetch(`/mosques/${mosqueId}/followers${search ? `?search=${encodeURIComponent(search)}` : ''}`).then((r) => r.json()),
  })
  const followers: any[] = followersData?.data?.items ?? []

  const createMutation = useMutation({
    mutationFn: () =>
      adminFetch(`/mosques/${mosqueId}/groups`, {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), memberIds: selected.map((u) => u.id) }),
      }).then((r) => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-groups', mosqueId] })
      onCreated(data.data)
    },
  })

  const toggle = (user: any) =>
    setSelected((prev) => prev.find((u) => u.id === user.id) ? prev.filter((u) => u.id !== user.id) : [...prev, user])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">New Group Chat</h2>
          <p className="text-sm text-gray-500 mt-0.5">Name the group and select followers to invite</p>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Group name */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Group name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Youth Group, Sisters Circle…"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800 placeholder:text-gray-400"
              autoFocus
            />
          </div>

          {/* Selected pills */}
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selected.map((u) => (
                <button
                  key={u.id}
                  onClick={() => toggle(u)}
                  className="flex items-center gap-1 bg-green-50 text-green-800 text-xs font-semibold px-2.5 py-1 rounded-full hover:bg-red-50 hover:text-red-600 transition-colors"
                >
                  {u.name ?? u.email}
                  <span className="text-xs">×</span>
                </button>
              ))}
            </div>
          )}

          {/* Follower search */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
              Add followers ({selected.length} selected)
            </label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800 placeholder:text-gray-400 mb-2"
            />
            <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-50">
              {followers.length === 0 ? (
                <p className="text-center text-xs text-gray-400 py-6">{search ? 'No matching followers' : 'No followers yet'}</p>
              ) : (
                followers.map((follower: any) => {
                  const u = follower.user ?? follower
                  const isSelected = selected.find((s) => s.id === u.id)
                  return (
                    <button
                      key={follower.id}
                      onClick={() => toggle(u)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors ${isSelected ? 'bg-green-50' : ''}`}
                    >
                      <Avatar name={u.name} size={7} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{u.name ?? u.email ?? 'Unknown'}</p>
                        {u.email && <p className="text-xs text-gray-400 truncate">{u.email}</p>}
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-green-800 border-green-800' : 'border-gray-300'}`}>
                        {isSelected && <span className="text-white text-xs font-bold">✓</span>}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!name.trim() || selected.length === 0 || createMutation.isPending}
            className="flex-1 bg-green-800 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-green-900 disabled:opacity-40 transition-colors"
          >
            {createMutation.isPending ? 'Creating…' : `Create (${selected.length} member${selected.length !== 1 ? 's' : ''})`}
          </button>
        </div>
      </div>
    </div>
  )
}

function AddMemberModal({
  mosqueId,
  groupId,
  groupName,
  adminFetch,
  onClose,
  onAdded,
}: {
  mosqueId: string
  groupId: string
  groupName: string
  adminFetch: ReturnType<typeof import('../../../../lib/adminFetch').useAdminFetch>
  onClose: () => void
  onAdded: () => void
}) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<any[]>([])
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  const { data: followersData } = useQuery({
    queryKey: ['mosque-followers', mosqueId, search],
    queryFn: () =>
      adminFetch(`/mosques/${mosqueId}/followers${search ? `?search=${encodeURIComponent(search)}` : ''}`).then((r) => r.json()),
  })
  const followers: any[] = followersData?.data?.items ?? []

  const toggle = (user: any) =>
    setSelected((prev) => prev.find((u) => u.id === user.id) ? prev.filter((u) => u.id !== user.id) : [...prev, user])

  async function handleAdd() {
    if (!selected.length) return
    setAdding(true)
    setError('')
    try {
      const res = await adminFetch(`/mosques/${mosqueId}/groups/${groupId}/members/add`, {
        method: 'POST',
        body: JSON.stringify({ userIds: selected.map((u) => u.id) }),
      })
      if (!res.ok) throw new Error('Failed to add members')
      onAdded()
    } catch (e: any) {
      setError(e.message ?? 'Failed to add members')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Add Members</h2>
          <p className="text-sm text-gray-500 mt-0.5">Add followers to <strong>{groupName}</strong></p>
        </div>
        <div className="px-6 py-4 space-y-4">
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selected.map((u) => (
                <button key={u.id} onClick={() => toggle(u)}
                  className="flex items-center gap-1 bg-green-50 text-green-800 text-xs font-semibold px-2.5 py-1 rounded-full hover:bg-red-50 hover:text-red-600 transition-colors">
                  {u.name ?? u.email}<span className="text-xs">×</span>
                </button>
              ))}
            </div>
          )}
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search followers by name or email…"
            className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800 placeholder:text-gray-400" />
          <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-50">
            {followers.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-6">{search ? 'No matching followers' : 'No followers yet'}</p>
            ) : followers.map((follower: any) => {
              const u = follower.user ?? follower
              const isSelected = selected.find((s) => s.id === u.id)
              return (
                <button key={follower.id} onClick={() => toggle(u)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors ${isSelected ? 'bg-green-50' : ''}`}>
                  <Avatar name={u.name} size={7} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{u.name ?? u.email ?? 'Unknown'}</p>
                    {u.email && <p className="text-xs text-gray-400 truncate">{u.email}</p>}
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-green-800 border-green-800' : 'border-gray-300'}`}>
                    {isSelected && <span className="text-white text-xs font-bold">✓</span>}
                  </div>
                </button>
              )
            })}
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={handleAdd} disabled={!selected.length || adding}
            className="flex-1 bg-green-800 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-green-900 disabled:opacity-40 transition-colors">
            {adding ? 'Adding…' : `Add ${selected.length || ''} Member${selected.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const { mosqueId } = useParams<{ mosqueId: string }>()
  const queryClient = useQueryClient()
  const adminFetch = useAdminFetch()

  const [tab, setTab] = useState<'direct' | 'groups'>('direct')
  const [search, setSearch] = useState('')

  // Direct messages state
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [userDetail, setUserDetail] = useState<any>(null)
  const threadEndRef = useRef<HTMLDivElement>(null)

  // Group chat state
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [groupMessageText, setGroupMessageText] = useState('')
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [generatingLink, setGeneratingLink] = useState(false)
  const groupThreadEndRef = useRef<HTMLDivElement>(null)

  // ── Direct messages query ──
  const { data: dmData } = useQuery({
    queryKey: ['admin-messages', mosqueId],
    queryFn: () => adminFetch(`/mosques/${mosqueId}/messages?limit=100`).then((r) => r.json()),
    refetchInterval: 15_000,
  })
  const allMessages: any[] = dmData?.data?.items ?? []
  const unreadCount = allMessages.filter((m) => !m.isRead).length

  // Sort by most recent activity (latest reply or original message)
  const sortedMessages = useMemo(() => {
    return [...allMessages].sort((a, b) => {
      const aTime = a.replies?.[a.replies.length - 1]?.createdAt ?? a.createdAt
      const bTime = b.replies?.[b.replies.length - 1]?.createdAt ?? b.createdAt
      return new Date(bTime).getTime() - new Date(aTime).getTime()
    })
  }, [allMessages])

  // Filter by search
  const filteredMessages = useMemo(() => {
    if (!search.trim()) return sortedMessages
    const q = search.toLowerCase()
    return sortedMessages.filter((m) =>
      m.fromUser?.name?.toLowerCase().includes(q) ||
      m.fromUser?.email?.toLowerCase().includes(q) ||
      m.subject?.toLowerCase().includes(q) ||
      m.body?.toLowerCase().includes(q) ||
      m.replies?.some((r: any) => r.body?.toLowerCase().includes(q))
    )
  }, [sortedMessages, search])

  // Derive selected message from live data
  const selected = selectedId ? allMessages.find((m) => m.id === selectedId) ?? null : null

  // ── Group chats query ──
  const { data: groupsData } = useQuery({
    queryKey: ['admin-groups', mosqueId],
    queryFn: () => adminFetch(`/mosques/${mosqueId}/groups`).then((r) => r.json()),
    refetchInterval: 15_000,
  })
  const allGroups: any[] = groupsData?.data?.items ?? []

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return allGroups
    const q = search.toLowerCase()
    return allGroups.filter((g) => g.name?.toLowerCase().includes(q))
  }, [allGroups, search])

  // ── Selected group chat ──
  const { data: groupDetailData, refetch: refetchGroup } = useQuery({
    queryKey: ['admin-group-detail', selectedGroupId],
    queryFn: () => adminFetch(`/mosques/${mosqueId}/groups/${selectedGroupId}`).then((r) => r.json()),
    enabled: !!selectedGroupId,
  })
  const selectedGroup = groupDetailData?.data ?? null

  // ── Mutations ──
  const openDm = useMutation({
    mutationFn: (id: string) => adminFetch(`/mosques/${mosqueId}/messages/${id}`).then((r) => r.json()),
    onSuccess: (data) => {
      setSelectedId(data.data.id)
      setReplyText('')
      queryClient.invalidateQueries({ queryKey: ['admin-messages', mosqueId] })
    },
  })

  const replyMutation = useMutation({
    mutationFn: (id: string) =>
      adminFetch(`/mosques/${mosqueId}/messages/${id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ replyBody: replyText }),
      }).then((r) => r.json()),
    onSuccess: () => {
      setReplyText('')
      queryClient.invalidateQueries({ queryKey: ['admin-messages', mosqueId] })
    },
  })

  const deleteDmMutation = useMutation({
    mutationFn: (id: string) => adminFetch(`/mosques/${mosqueId}/messages/${id}`, { method: 'DELETE' }),
    onSuccess: (_, id) => {
      if (selectedId === id) setSelectedId(null)
      queryClient.invalidateQueries({ queryKey: ['admin-messages', mosqueId] })
    },
  })

  const sendGroupMessage = useMutation({
    mutationFn: (groupId: string) =>
      adminFetch(`/mosques/${mosqueId}/groups/${groupId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: groupMessageText }),
      }).then((r) => r.json()),
    onSuccess: () => {
      setGroupMessageText('')
      refetchGroup()
      queryClient.invalidateQueries({ queryKey: ['admin-groups', mosqueId] })
    },
  })

  const deleteGroupMutation = useMutation({
    mutationFn: (id: string) => adminFetch(`/mosques/${mosqueId}/groups/${id}`, { method: 'DELETE' }),
    onSuccess: (_, id) => {
      if (selectedGroupId === id) setSelectedGroupId(null)
      queryClient.invalidateQueries({ queryKey: ['admin-groups', mosqueId] })
    },
  })

  const removeMemberMutation = useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      adminFetch(`/mosques/${mosqueId}/groups/${groupId}/members/${userId}`, { method: 'DELETE' }),
    onSuccess: () => refetchGroup(),
  })

  // Scroll to bottom of DM thread
  useEffect(() => {
    if (selected) setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [selected?.replies?.length, selected?.id])

  // Scroll to bottom of group thread
  useEffect(() => {
    if (selectedGroup) setTimeout(() => groupThreadEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [selectedGroup?.messages?.length, selectedGroupId])

  async function generateInviteLink(groupId: string) {
    setGeneratingLink(true)
    setInviteLink(null)
    try {
      // Admin Bug 2 fix: explicit error handling with descriptive messages
      const apiBase = process.env.NEXT_PUBLIC_API_URL
      if (!apiBase) {
        alert('Configuration error: NEXT_PUBLIC_API_URL is not set. Please add it to your .env.local file.')
        return
      }
      const res = await adminFetch(`/mosques/${mosqueId}/groups/${groupId}/invite-link`, { method: 'POST' })
      let json: any = {}
      try { json = await res.json() } catch {}
      if (!res.ok) {
        alert(`API error ${res.status}: ${json?.error ?? 'Could not generate invite link. Check API is running.'}`)
        return
      }
      if (json.data?.token) {
        const link = `masjid://join-group/${json.data.token}`
        setInviteLink(link)
        // Clipboard fallback for HTTP (non-secure) contexts
        try {
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(link)
          } else {
            const el = document.createElement('textarea')
            el.value = link
            el.style.position = 'fixed'
            el.style.opacity = '0'
            document.body.appendChild(el)
            el.select()
            document.execCommand('copy')
            document.body.removeChild(el)
          }
        } catch { /* clipboard not critical */ }
      } else {
        alert(`Unexpected response: ${JSON.stringify(json)}`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      alert(
        `Failed to generate invite link: ${msg}.\n\n` +
        `Check that:\n` +
        `1. NEXT_PUBLIC_API_URL is set correctly in .env.local\n` +
        `2. The API server is running and reachable\n` +
        `3. CORS allows requests from the admin domain`
      )
    } finally {
      setGeneratingLink(false)
    }
  }

  // Build DM thread events
  function buildThread(msg: any) {
    if (!msg) return []
    const events: any[] = [{ id: msg.id + '_orig', body: msg.body, fromAdmin: false, createdAt: msg.createdAt }]
    for (const r of msg.replies ?? []) events.push(r)
    return events.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }
  const thread = buildThread(selected)

  return (
    <div className="p-8 h-screen flex flex-col">
      {/* Page header */}
      <div className="flex items-center justify-between mb-5 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread` : 'Community inbox'}
          </p>
        </div>
        {tab === 'groups' && (
          <button
            onClick={() => setShowCreateGroup(true)}
            className="flex items-center gap-2 bg-green-800 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-green-900 transition-colors"
          >
            <span className="text-base leading-none">+</span> New Group Chat
          </button>
        )}
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* ── Left panel ── */}
        <div className="w-80 flex-shrink-0 flex flex-col">
          {/* Tabs */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-3 flex-shrink-0">
            <button
              onClick={() => setTab('direct')}
              className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-all ${tab === 'direct' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Direct {unreadCount > 0 && <span className="ml-1 bg-green-700 text-white rounded-full px-1.5 py-0.5 text-[10px]">{unreadCount}</span>}
            </button>
            <button
              onClick={() => setTab('groups')}
              className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-all ${tab === 'groups' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Groups {allGroups.length > 0 && <span className="ml-1 text-gray-400 text-[10px]">{allGroups.length}</span>}
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-2 flex-shrink-0">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tab === 'direct' ? 'Search messages…' : 'Search groups…'}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800 placeholder:text-gray-400"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">✕</button>
            )}
          </div>

          {/* List */}
          <div className="flex-1 bg-white rounded-2xl border border-gray-100 overflow-y-auto">
            {tab === 'direct' ? (
              filteredMessages.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <p className="text-3xl mb-2">✉️</p>
                  <p className="text-sm">{search ? 'No matching messages' : 'No messages yet'}</p>
                </div>
              ) : (
                filteredMessages.map((msg: any) => {
                  const latestReply = msg.replies?.[msg.replies.length - 1]
                  const preview = latestReply ? latestReply.body : msg.body
                  const latestTime = latestReply ? latestReply.createdAt : msg.createdAt
                  const replyCount = msg.replies?.length ?? 0
                  const isActive = selectedId === msg.id

                  return (
                    <div
                      key={msg.id}
                      className={`group relative flex items-start gap-2 px-3 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors ${isActive ? 'bg-green-50 border-l-2 border-l-green-800' : ''}`}
                      onClick={() => openDm.mutate(msg.id)}
                    >
                      <Avatar name={msg.fromUser?.name} size={8} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {!msg.isRead && <div className="w-2 h-2 rounded-full bg-green-700 flex-shrink-0" />}
                            <p className={`text-sm truncate ${!msg.isRead ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                              {msg.fromUser?.name ?? msg.fromUser?.email ?? 'Anonymous'}
                            </p>
                          </div>
                          <p className="text-[10px] text-gray-400 flex-shrink-0">
                            {formatDistanceToNow(new Date(latestTime), { addSuffix: false })}
                          </p>
                        </div>
                        {msg.subject && <p className="text-xs text-gray-600 truncate font-medium">{msg.subject}</p>}
                        <p className="text-xs text-gray-400 truncate">{preview}</p>
                        {replyCount > 0 && (
                          <span className="text-[10px] bg-green-100 text-green-700 rounded-full px-2 py-0.5 font-medium mt-1 inline-block">
                            {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
                          </span>
                        )}
                      </div>
                      {/* Inline delete — appears on hover */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteDmMutation.mutate(msg.id)
                        }}
                        disabled={deleteDmMutation.isPending}
                        className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-1 rounded-lg hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all"
                        title="Delete"
                      >
                        🗑
                      </button>
                    </div>
                  )
                })
              )
            ) : (
              /* Group chats list */
              filteredGroups.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <p className="text-3xl mb-2">💬</p>
                  <p className="text-sm">{search ? 'No matching groups' : 'No group chats yet'}</p>
                  <button
                    onClick={() => setShowCreateGroup(true)}
                    className="mt-3 text-green-700 text-xs font-semibold hover:underline"
                  >
                    + Create one
                  </button>
                </div>
              ) : (
                filteredGroups.map((group: any) => {
                  const latestMsg = group.messages?.[0]
                  const isActive = selectedGroupId === group.id
                  return (
                    <div
                      key={group.id}
                      className={`group relative flex items-start gap-2 px-3 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors ${isActive ? 'bg-green-50 border-l-2 border-l-green-800' : ''}`}
                      onClick={() => setSelectedGroupId(group.id)}
                    >
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-base flex-shrink-0">💬</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <p className="text-sm font-semibold text-gray-900 truncate">{group.name}</p>
                          {latestMsg && (
                            <p className="text-[10px] text-gray-400 flex-shrink-0">
                              {formatDistanceToNow(new Date(latestMsg.createdAt), { addSuffix: false })}
                            </p>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 truncate">
                          {latestMsg ? latestMsg.body : `${group._count?.members ?? 0} members`}
                        </p>
                        <span className="text-[10px] text-gray-400">{group._count?.members ?? 0} members · {group._count?.messages ?? 0} messages</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteGroupMutation.mutate(group.id)
                        }}
                        disabled={deleteGroupMutation.isPending}
                        className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-1 rounded-lg hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all"
                        title="Delete group"
                      >
                        🗑
                      </button>
                    </div>
                  )
                })
              )
            )}
          </div>
        </div>

        {/* ── Right panel: thread ── */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-100 flex flex-col overflow-hidden min-h-0">
          {tab === 'direct' ? (
            !selected ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <p className="text-4xl mb-3">✉️</p>
                  <p className="text-sm">Select a message to read</p>
                </div>
              </div>
            ) : (
              <>
                {/* DM thread header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <Avatar name={selected.fromUser?.name} size={9} />
                    <div>
                      <button
                        onClick={() => setUserDetail(selected.fromUser)}
                        className="font-semibold text-gray-900 hover:text-green-700 hover:underline text-sm"
                      >
                        {selected.fromUser?.name ?? 'Anonymous'}
                      </button>
                      {selected.fromUser?.email && <p className="text-xs text-gray-400">{selected.fromUser.email}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {selected.subject && <span className="text-sm font-semibold text-gray-600">{selected.subject}</span>}
                    <button
                      onClick={() => deleteDmMutation.mutate(selected.id)}
                      disabled={deleteDmMutation.isPending}
                      className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 font-medium px-3 py-1.5 rounded-xl hover:bg-red-50 border border-transparent hover:border-red-200 transition-all disabled:opacity-50"
                    >
                      🗑 Delete
                    </button>
                  </div>
                </div>

                {/* DM thread messages */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                  {thread.map((event) => (
                    <div key={event.id} className={`flex ${event.fromAdmin ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] flex flex-col gap-1 ${event.fromAdmin ? 'items-end' : 'items-start'}`}>
                        <div className={[
                          'px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap',
                          event.fromAdmin ? 'bg-green-800 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm',
                        ].join(' ')}>
                          {event.body}
                        </div>
                        <p className="text-xs text-gray-400 px-1">
                          {event.fromAdmin ? 'You' : (selected.fromUser?.name ?? 'User')}
                          {' · '}
                          {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={threadEndRef} />
                </div>

                {/* DM reply input */}
                <div className="border-t border-gray-100 p-4 flex-shrink-0">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && replyText.trim()) replyMutation.mutate(selected.id)
                    }}
                    placeholder="Write a reply… (Ctrl+Enter to send)"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-green-800 text-sm"
                    rows={3}
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={() => replyMutation.mutate(selected.id)}
                      disabled={!replyText.trim() || replyMutation.isPending}
                      className="bg-green-800 text-white rounded-xl px-5 py-2 text-sm font-medium hover:bg-green-900 disabled:opacity-50"
                    >
                      {replyMutation.isPending ? 'Sending…' : 'Send Reply'}
                    </button>
                  </div>
                </div>
              </>
            )
          ) : (
            /* ── Group chat thread ── */
            !selectedGroup ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <p className="text-4xl mb-3">💬</p>
                  <p className="text-sm">Select a group to view the conversation</p>
                  <button
                    onClick={() => setShowCreateGroup(true)}
                    className="mt-3 bg-green-800 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-green-900 transition-colors"
                  >
                    + New Group Chat
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Group thread header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-base flex-shrink-0">💬</div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{selectedGroup.name}</p>
                      <div className="flex items-center gap-1 flex-wrap mt-0.5">
                        {selectedGroup.members?.slice(0, 4).map((m: any) => (
                          <span key={m.id} className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5 flex items-center gap-1">
                            {m.user?.name ?? m.user?.email ?? 'User'}
                            <button
                              onClick={() => removeMemberMutation.mutate({ groupId: selectedGroup.id, userId: m.userId })}
                              className="text-gray-400 hover:text-red-500 ml-0.5 leading-none"
                              title="Remove"
                            >×</button>
                          </span>
                        ))}
                        {(selectedGroup.members?.length ?? 0) > 4 && (
                          <span className="text-xs text-gray-400">+{selectedGroup.members.length - 4} more</span>
                        )}
                      </div>
                      {inviteLink && (
                        <div className="mt-2 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
                          <input
                            readOnly
                            value={inviteLink}
                            onFocus={(e) => e.target.select()}
                            className="text-xs text-blue-700 font-mono bg-transparent flex-1 min-w-0 outline-none cursor-text"
                          />
                          <button
                            onClick={() => {
                              const el = document.createElement('textarea')
                              el.value = inviteLink
                              el.style.position = 'fixed'
                              el.style.opacity = '0'
                              document.body.appendChild(el)
                              el.select()
                              document.execCommand('copy')
                              document.body.removeChild(el)
                              setInviteLink(null)
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex-shrink-0"
                          >
                            Copy & Close
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowAddMember(true)}
                      className="flex items-center gap-1.5 text-xs text-green-700 hover:text-green-900 font-medium px-3 py-1.5 rounded-xl hover:bg-green-50 border border-transparent hover:border-green-200 transition-all"
                    >
                      + Add Member
                    </button>
                    <button
                      onClick={() => generateInviteLink(selectedGroup.id)}
                      disabled={generatingLink}
                      className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5 rounded-xl hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-all disabled:opacity-40"
                      title="Generate a shareable invite link"
                    >
                      🔗 {generatingLink ? 'Generating…' : 'Invite Link'}
                    </button>
                    <button
                      onClick={() => deleteGroupMutation.mutate(selectedGroup.id)}
                      disabled={deleteGroupMutation.isPending}
                      className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 font-medium px-3 py-1.5 rounded-xl hover:bg-red-50 border border-transparent hover:border-red-200 transition-all disabled:opacity-50"
                    >
                      🗑 Delete Group
                    </button>
                  </div>
                </div>

                {/* Group messages */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                  {(selectedGroup.messages ?? []).length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-gray-400 py-16 text-center">
                      <div>
                        <p className="text-3xl mb-2">💬</p>
                        <p className="text-sm">No messages yet — say something!</p>
                      </div>
                    </div>
                  ) : (
                    (selectedGroup.messages ?? []).map((msg: any) => (
                      <div key={msg.id} className={`flex ${msg.fromAdmin ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] flex flex-col gap-1 ${msg.fromAdmin ? 'items-end' : 'items-start'}`}>
                          {!msg.fromAdmin && (
                            <p className="text-xs text-gray-400 font-semibold px-1">
                              {msg.fromUser?.name ?? 'Member'}
                            </p>
                          )}
                          <div className={[
                            'px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap',
                            msg.fromAdmin ? 'bg-green-800 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm',
                          ].join(' ')}>
                            {msg.body}
                          </div>
                          <p className="text-xs text-gray-400 px-1">
                            {msg.fromAdmin ? 'You' : (msg.fromUser?.name ?? 'Member')}
                            {' · '}
                            {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={groupThreadEndRef} />
                </div>

                {/* Group send input */}
                <div className="border-t border-gray-100 p-4 flex-shrink-0">
                  <textarea
                    value={groupMessageText}
                    onChange={(e) => setGroupMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && groupMessageText.trim()) sendGroupMessage.mutate(selectedGroup.id)
                    }}
                    placeholder={`Message ${selectedGroup.name}… (Ctrl+Enter to send)`}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-green-800 text-sm"
                    rows={3}
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={() => sendGroupMessage.mutate(selectedGroup.id)}
                      disabled={!groupMessageText.trim() || sendGroupMessage.isPending}
                      className="bg-green-800 text-white rounded-xl px-5 py-2 text-sm font-medium hover:bg-green-900 disabled:opacity-50"
                    >
                      {sendGroupMessage.isPending ? 'Sending…' : 'Send Message'}
                    </button>
                  </div>
                </div>
              </>
            )
          )}
        </div>
      </div>

      {userDetail && <UserDetailModal user={userDetail} onClose={() => setUserDetail(null)} />}
      {showCreateGroup && (
        <CreateGroupModal
          mosqueId={mosqueId}
          adminFetch={adminFetch}
          onClose={() => setShowCreateGroup(false)}
          onCreated={(group) => {
            setShowCreateGroup(false)
            setTab('groups')
            setSelectedGroupId(group.id)
            queryClient.invalidateQueries({ queryKey: ['admin-group-detail', group.id] })
          }}
        />
      )}
      {showAddMember && selectedGroup && (
        <AddMemberModal
          mosqueId={mosqueId}
          groupId={selectedGroup.id}
          groupName={selectedGroup.name}
          adminFetch={adminFetch}
          onClose={() => setShowAddMember(false)}
          onAdded={() => {
            setShowAddMember(false)
            refetchGroup()
          }}
        />
      )}
    </div>
  )
}
