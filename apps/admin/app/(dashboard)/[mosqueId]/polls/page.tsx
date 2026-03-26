'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { useAdminFetch } from '../../../../lib/adminFetch'

interface PollOption {
  id: string
  text: string
  order: number
  voteCount: number
}

interface Poll {
  id: string
  question: string
  isPublished: boolean
  endsAt: string | null
  createdAt: string
  totalVotes: number
  options: PollOption[]
}

export default function PollsPage() {
  const { mosqueId } = useParams<{ mosqueId: string }>()
  const adminFetch = useAdminFetch()
  const qc = useQueryClient()

  const [showCreate, setShowCreate] = useState(false)
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [endsAt, setEndsAt] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-polls', mosqueId],
    queryFn: async () => {
      const res = await adminFetch(`/mosques/${mosqueId}/polls`)
      return res.json()
    },
  })

  const polls: Poll[] = data?.data?.items ?? []

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await adminFetch(`/mosques/${mosqueId}/polls`, {
        method: 'POST',
        body: JSON.stringify({
          question: question.trim(),
          options: options.filter((o) => o.trim()).map((o) => o.trim()),
          endsAt: endsAt || undefined,
        }),
      })
      if (!res.ok) throw new Error('Failed to create poll')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-polls', mosqueId] })
      setShowCreate(false)
      setQuestion('')
      setOptions(['', ''])
      setEndsAt('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (pollId: string) => {
      const res = await adminFetch(`/polls/${pollId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete poll')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-polls', mosqueId] }),
  })

  const validOptions = options.filter((o) => o.trim()).length
  const canCreate = question.trim().length >= 5 && validOptions >= 2

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Polls</h1>
          <p className="text-gray-500 text-sm mt-1">Create and manage community polls</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-forest-800 hover:bg-forest-900 text-white px-4 py-2 rounded-xl font-semibold text-sm"
          style={{ background: '#0F4423' }}
        >
          + New Poll
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <h2 className="text-lg font-bold text-gray-900 mb-4">New Poll</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What do you want to ask the community?"
                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                rows={2}
                maxLength={300}
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Options</label>
              <div className="space-y-2">
                {options.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const next = [...options]
                        next[i] = e.target.value
                        setOptions(next)
                      }}
                      placeholder={`Option ${i + 1}`}
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      maxLength={200}
                    />
                    {options.length > 2 && (
                      <button
                        onClick={() => setOptions(options.filter((_, j) => j !== i))}
                        className="text-red-400 hover:text-red-600 text-sm px-2"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                {options.length < 6 && (
                  <button
                    onClick={() => setOptions([...options, ''])}
                    className="text-green-700 text-sm font-medium hover:underline"
                  >
                    + Add option
                  </button>
                )}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">End date (optional)</label>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowCreate(false); setQuestion(''); setOptions(['', '']); setEndsAt('') }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={!canCreate || createMutation.isPending}
                className="px-4 py-2 text-sm text-white rounded-xl font-semibold disabled:opacity-50"
                style={{ background: '#0F4423' }}
              >
                {createMutation.isPending ? 'Publishing…' : 'Publish Poll'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Loading polls…</div>
      ) : polls.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <p className="text-4xl mb-3">📊</p>
          <p className="text-gray-600 font-semibold">No polls yet</p>
          <p className="text-gray-400 text-sm mt-1">Create your first poll to engage the community</p>
        </div>
      ) : (
        <div className="space-y-4">
          {polls.map((poll) => {
            const ended = poll.endsAt && new Date(poll.endsAt) < new Date()
            return (
              <div key={poll.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {ended ? (
                        <span className="bg-gray-100 text-gray-500 text-xs font-medium px-2 py-0.5 rounded-full">Ended</span>
                      ) : (
                        <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">Active</span>
                      )}
                      <span className="text-xs text-gray-400">{format(new Date(poll.createdAt), 'MMM d, yyyy')}</span>
                    </div>
                    <p className="font-semibold text-gray-900">{poll.question}</p>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm('Delete this poll? This cannot be undone.')) {
                        deleteMutation.mutate(poll.id)
                      }
                    }}
                    className="text-red-400 hover:text-red-600 text-sm shrink-0"
                  >
                    Delete
                  </button>
                </div>

                <div className="space-y-2">
                  {poll.options.map((opt) => {
                    const pct = poll.totalVotes > 0 ? Math.round((opt.voteCount / poll.totalVotes) * 100) : 0
                    return (
                      <div key={opt.id}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-700">{opt.text}</span>
                          <span className="text-gray-400 font-medium">{opt.voteCount} ({pct}%)</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div className="bg-green-600 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>

                <p className="text-xs text-gray-400 mt-3">
                  {poll.totalVotes} vote{poll.totalVotes !== 1 ? 's' : ''}
                  {poll.endsAt && ` · Ends ${format(new Date(poll.endsAt), 'MMM d, yyyy h:mm a')}`}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
