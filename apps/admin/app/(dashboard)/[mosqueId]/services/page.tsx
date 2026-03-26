'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAdminFetch } from '../../../../lib/adminFetch'

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-50 text-yellow-700',
  APPROVED: 'bg-green-50 text-green-700',
  REJECTED: 'bg-red-50 text-red-600',
}

const SERVICE_TYPES = [
  'QURAN_CLASSES', 'WOMENS_HALAQA', 'ISLAMIC_SCHOOL', 'SPECIAL_NEEDS',
  'MARRIAGE_SERVICES', 'JANAZAH_SERVICES', 'FACILITY_RENTAL',
  'YOUTH_PROGRAMS', 'OTHER',
]

const TYPE_LABELS: Record<string, string> = {
  QURAN_CLASSES: 'Quran Classes',
  WOMENS_HALAQA: "Women's Halaqa",
  ISLAMIC_SCHOOL: 'Islamic School',
  SPECIAL_NEEDS: 'Special Needs',
  MARRIAGE_SERVICES: 'Marriage Services',
  JANAZAH_SERVICES: 'Janazah Services',
  FACILITY_RENTAL: 'Facility Rental',
  YOUTH_PROGRAMS: 'Youth Programs',
  OTHER: 'Other',
}

const DEFAULT_FORM = {
  type: 'QURAN_CLASSES', name: '', description: '',
  schedule: '', contact: '', registration: '', notes: '', pricing: '', capacity: '',
}

export default function ServicesPage() {
  const { mosqueId } = useParams<{ mosqueId: string }>()
  const queryClient = useQueryClient()
  const adminFetch = useAdminFetch()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...DEFAULT_FORM })
  const [activeTab, setActiveTab] = useState<'services' | 'requests'>('services')

  const { data } = useQuery({
    queryKey: ['admin-services', mosqueId],
    queryFn: () => adminFetch(`/mosques/${mosqueId}/services`).then(r => r.json()),
  })
  const services: any[] = data?.data?.items ?? data?.data ?? []

  const createMutation = useMutation({
    mutationFn: () => adminFetch(`/mosques/${mosqueId}/services`, {
      method: 'POST',
      body: JSON.stringify({ ...form, capacity: form.capacity ? parseInt(form.capacity) : undefined }),
    }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-services', mosqueId] })
      setShowForm(false)
      setForm({ ...DEFAULT_FORM })
    },
  })

  const updateMutation = useMutation({
    mutationFn: (id: string) => adminFetch(`/mosques/${mosqueId}/services/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...form, capacity: form.capacity ? parseInt(form.capacity) : undefined }),
    }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-services', mosqueId] })
      setEditingId(null)
      setForm({ ...DEFAULT_FORM })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminFetch(`/mosques/${mosqueId}/services/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-services', mosqueId] }),
  })

  const [requestFilter, setRequestFilter] = useState<'all' | 'PENDING' | 'APPROVED' | 'REJECTED'>('all')

  const { data: requestsData } = useQuery({
    queryKey: ['service-requests', mosqueId],
    queryFn: () => adminFetch(`/mosques/${mosqueId}/service-requests`).then(r => r.json()),
  })
  const allRequests: any[] = requestsData?.data?.items ?? []
  const requests = requestFilter === 'all' ? allRequests : allRequests.filter(r => r.status === requestFilter)
  const pendingCount = allRequests.filter(r => r.status === 'PENDING').length

  const updateRequestMutation = useMutation({
    mutationFn: ({ id, status, adminNote }: { id: string; status: string; adminNote?: string }) =>
      adminFetch(`/mosques/${mosqueId}/service-requests/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status, adminNote }),
      }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['service-requests', mosqueId] }),
  })

  const deleteRequestMutation = useMutation({
    mutationFn: (id: string) =>
      adminFetch(`/mosques/${mosqueId}/service-requests/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['service-requests', mosqueId] }),
  })

  function startEdit(svc: any) {
    setEditingId(svc.id)
    setForm({
      type: svc.type, name: svc.name, description: svc.description ?? '',
      schedule: svc.schedule ?? '', contact: svc.contact ?? '',
      registration: svc.registration ?? '', notes: svc.notes ?? '',
      pricing: svc.pricing ?? '', capacity: svc.capacity ? String(svc.capacity) : '',
    })
    setShowForm(false)
  }

  function cancelEdit() {
    setEditingId(null)
    setForm({ ...DEFAULT_FORM })
  }

  const isEditing = !!editingId
  const formVisible = showForm || isEditing

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Services</h1>
          <p className="text-gray-500 text-sm mt-1">Manage the services your mosque offers</p>
        </div>
        {activeTab === 'services' && !formVisible && (
          <button
            onClick={() => { setShowForm(true); setEditingId(null); setForm({ ...DEFAULT_FORM }) }}
            className="bg-green-800 text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-green-900"
          >
            + Add Service
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {(['services', 'requests'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize flex items-center gap-2 ${
              activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'requests' ? 'Requests' : 'Services'}
            {tab === 'requests' && pendingCount > 0 && (
              <span className="bg-amber-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'requests' && (
        <div>
          {/* Filter bar */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {(['all', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(f => (
              <button
                key={f}
                onClick={() => setRequestFilter(f)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  requestFilter === f
                    ? 'bg-green-800 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f === 'all' ? `All (${allRequests.length})` : f === 'PENDING' ? `Pending (${allRequests.filter(r => r.status === 'PENDING').length})` : f === 'APPROVED' ? `Approved (${allRequests.filter(r => r.status === 'APPROVED').length})` : `Rejected (${allRequests.filter(r => r.status === 'REJECTED').length})`}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {requests.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <p className="text-4xl mb-3">📋</p>
                <p>No {requestFilter === 'all' ? '' : requestFilter.toLowerCase() + ' '}requests.</p>
              </div>
            )}
            {requests.map((req: any) => (
              <div key={req.id} className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-500">{req.service?.name}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[req.status]}`}>
                        {req.status}
                      </span>
                    </div>
                    <p className="font-semibold text-gray-900">{req.name}</p>
                    {req.phone && <p className="text-sm text-gray-500 mt-0.5">📞 {req.phone}</p>}
                    <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{req.message}</p>
                    {req.adminNote && (
                      <p className="text-xs text-gray-400 mt-2 italic">Note: {req.adminNote}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">{new Date(req.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0 items-end">
                    {req.status === 'PENDING' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateRequestMutation.mutate({ id: req.id, status: 'APPROVED' })}
                          disabled={updateRequestMutation.isPending}
                          className="bg-green-800 text-white rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-green-900 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => updateRequestMutation.mutate({ id: req.id, status: 'REJECTED' })}
                          disabled={updateRequestMutation.isPending}
                          className="border border-red-100 text-red-500 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-red-50 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                    <button
                      onClick={() => { if (confirm('Delete this request?')) deleteRequestMutation.mutate(req.id) }}
                      disabled={deleteRequestMutation.isPending}
                      className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'services' && formVisible && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-5">
            {isEditing ? 'Edit Service' : 'New Service'}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Service Type</label>
              <select
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900"
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              >
                {SERVICE_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display Name *</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Weekend Quran School"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 h-20 resize-none"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Brief description of this service..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Schedule</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900"
                value={form.schedule}
                onChange={e => setForm(f => ({ ...f, schedule: e.target.value }))}
                placeholder="e.g. Saturdays 10am–12pm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact / Phone</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900"
                value={form.contact}
                onChange={e => setForm(f => ({ ...f, contact: e.target.value }))}
                placeholder="e.g. +1 (555) 000-0000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pricing</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900"
                value={form.pricing}
                onChange={e => setForm(f => ({ ...f, pricing: e.target.value }))}
                placeholder="e.g. Free, $50/month"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
              <input
                type="number"
                min="1"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900"
                value={form.capacity}
                onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))}
                placeholder="Max participants"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Registration Info</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900"
                value={form.registration}
                onChange={e => setForm(f => ({ ...f, registration: e.target.value }))}
                placeholder="e.g. Register at the front desk or call ahead"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            {isEditing ? (
              <button
                onClick={() => updateMutation.mutate(editingId!)}
                disabled={updateMutation.isPending || !form.name}
                className="bg-green-800 text-white rounded-xl px-5 py-2 text-sm font-medium hover:bg-green-900 disabled:opacity-50"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            ) : (
              <button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !form.name}
                className="bg-green-800 text-white rounded-xl px-5 py-2 text-sm font-medium hover:bg-green-900 disabled:opacity-50"
              >
                {createMutation.isPending ? 'Adding...' : 'Add Service'}
              </button>
            )}
            <button
              onClick={isEditing ? cancelEdit : () => setShowForm(false)}
              className="border border-gray-200 text-gray-600 rounded-xl px-5 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {activeTab === 'services' && <div className="space-y-3">
        {services.length === 0 && !formVisible && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🕌</p>
            <p>No services yet. Add your first service above.</p>
          </div>
        )}
        {services.map((svc: any) => (
          <div key={svc.id} className="bg-white rounded-2xl border border-gray-100 p-5 flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-green-50 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">
                  {TYPE_LABELS[svc.type] ?? svc.type}
                </span>
                {svc.pricing && (
                  <span className="text-gray-500 text-xs">{svc.pricing}</span>
                )}
              </div>
              <p className="text-gray-900 font-semibold">{svc.name}</p>
              {svc.description && <p className="text-gray-500 text-sm mt-1 line-clamp-2">{svc.description}</p>}
              <div className="flex gap-4 mt-2 text-xs text-gray-400">
                {svc.schedule && <span>📅 {svc.schedule}</span>}
                {svc.capacity && <span>👥 {svc.capacity} max</span>}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => startEdit(svc)}
                className="border border-gray-200 text-gray-600 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
              >
                Edit
              </button>
              <button
                onClick={() => { if (confirm('Delete this service?')) deleteMutation.mutate(svc.id) }}
                className="border border-red-100 text-red-500 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>}
    </div>
  )
}
