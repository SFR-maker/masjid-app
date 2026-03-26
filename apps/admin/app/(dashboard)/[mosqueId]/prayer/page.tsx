'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useAdminFetch } from '../../../../lib/adminFetch'

const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const
const LABELS: Record<string, string> = { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' }
type Prayer = (typeof PRAYERS)[number]
type PrayerForm = Record<Prayer, { adhan: string; iqamah: string }>

const DEFAULT_FORM: PrayerForm = {
  fajr: { adhan: '', iqamah: '' },
  dhuhr: { adhan: '', iqamah: '' },
  asr: { adhan: '', iqamah: '' },
  maghrib: { adhan: '', iqamah: '' },
  isha: { adhan: '', iqamah: '' },
}

const KHUTBAH_LANGUAGES = [
  'English', 'Arabic', 'Indonesian', 'Urdu', 'Bengali',
  'Turkish', 'Persian', 'Punjabi', 'Hindi', 'French',
  'Somali', 'Swahili', 'Hausa', 'Other',
]

const JUMUAH_DEFAULT = { khutbahTime: '', iqamahTime: '', language: 'English', imam: '', notes: '' }

export default function PrayerManagementPage() {
  const { mosqueId } = useParams<{ mosqueId: string }>()
  const queryClient = useQueryClient()
  const [date, setDate] = useState(() => {
    // Use LOCAL date — toISOString() returns UTC which can be "tomorrow" for US timezones
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [form, setForm] = useState<PrayerForm>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [bulkDays, setBulkDays] = useState(30)
  const [activeTab, setActiveTab] = useState<'times' | 'jumuah' | 'taraweeh'>('times')
  const [jumuahForms, setJumuahForms] = useState([{ ...JUMUAH_DEFAULT }])

  const TARAWEEH_DEFAULT = { date: '', startTime: '', endTime: '', rakaat: '', imam: '', notes: '' }
  const [taraweehForms, setTaraweehForms] = useState([{ ...TARAWEEH_DEFAULT }])

  const adminFetch = useAdminFetch()

  const { data: existingData } = useQuery({
    queryKey: ['prayer-times', mosqueId, date],
    queryFn: () => adminFetch(`/mosques/${mosqueId}/prayer-times?date=${date}`).then(r => r.json()),
  })

  const { data: jumuahData } = useQuery({
    queryKey: ['jumuah-schedules', mosqueId],
    queryFn: () => adminFetch(`/mosques/${mosqueId}/jumuah`).then(r => r.json()),
  })

  const { data: taraweehData } = useQuery({
    queryKey: ['taraweeh-schedules', mosqueId],
    queryFn: () => adminFetch(`/mosques/${mosqueId}/taraweeh`).then(r => r.json()),
  })

  useEffect(() => {
    const schedules = jumuahData?.data?.items
    if (schedules?.length) {
      setJumuahForms(schedules.map((s: any) => ({
        id: s.id,
        khutbahTime: s.khutbahTime ?? '',
        iqamahTime: s.iqamahTime ?? '',
        language: s.language ?? 'English',
        imam: s.imam ?? '',
        notes: s.notes ?? '',
      })))
    }
  }, [jumuahData])

  useEffect(() => {
    const schedules = taraweehData?.data?.items
    if (schedules?.length) {
      setTaraweehForms(schedules.map((s: any) => ({
        id: s.id,
        date: s.date ?? '',
        startTime: s.startTime ?? '',
        endTime: s.endTime ?? '',
        rakaat: s.rakaat != null ? String(s.rakaat) : '',
        imam: s.imam ?? '',
        notes: s.notes ?? '',
      })))
    }
  }, [taraweehData])

  const saveTaraweehMutation = useMutation({
    mutationFn: () => adminFetch(`/mosques/${mosqueId}/taraweeh`, {
      method: 'PUT',
      body: JSON.stringify({
        schedules: taraweehForms.map(t => ({
          date: t.date || undefined,
          startTime: t.startTime,
          endTime: t.endTime || undefined,
          rakaat: t.rakaat ? parseInt(t.rakaat) : undefined,
          imam: t.imam || undefined,
          notes: t.notes || undefined,
        })),
      }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taraweeh-schedules', mosqueId] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const saveJumuahMutation = useMutation({
    mutationFn: () => adminFetch(`/mosques/${mosqueId}/jumuah`, {
      method: 'PUT',
      body: JSON.stringify({ schedules: jumuahForms }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jumuah-schedules', mosqueId] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const deleteJumuahMutation = useMutation({
    mutationFn: () => adminFetch(`/mosques/${mosqueId}/jumuah`, {
      method: 'PUT',
      body: JSON.stringify({ schedules: [] }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jumuah-schedules', mosqueId] })
      setJumuahForms([{ ...JUMUAH_DEFAULT }])
    },
  })

  const deleteTaraweehMutation = useMutation({
    mutationFn: () => adminFetch(`/mosques/${mosqueId}/taraweeh`, {
      method: 'PUT',
      body: JSON.stringify({ schedules: [] }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taraweeh-schedules', mosqueId] })
      setTaraweehForms([{ ...TARAWEEH_DEFAULT }])
    },
  })

  useEffect(() => {
    const d = existingData?.data
    if (!d) return
    setForm({
      fajr: { adhan: d.fajrAdhan ?? '', iqamah: d.fajrIqamah ?? '' },
      dhuhr: { adhan: d.dhuhrAdhan ?? '', iqamah: d.dhuhrIqamah ?? '' },
      asr: { adhan: d.asrAdhan ?? '', iqamah: d.asrIqamah ?? '' },
      maghrib: { adhan: d.maghribAdhan ?? '', iqamah: d.maghribIqamah ?? '' },
      isha: { adhan: d.ishaAdhan ?? '', iqamah: d.ishaIqamah ?? '' },
    })
  }, [existingData])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await adminFetch(`/mosques/${mosqueId}/prayer-times`, {
        method: 'POST',
        body: JSON.stringify({
          date,
          fajrAdhan: form.fajr.adhan || undefined, fajrIqamah: form.fajr.iqamah || null,
          dhuhrAdhan: form.dhuhr.adhan || undefined, dhuhrIqamah: form.dhuhr.iqamah || null,
          asrAdhan: form.asr.adhan || undefined, asrIqamah: form.asr.iqamah || null,
          maghribAdhan: form.maghrib.adhan || undefined, maghribIqamah: form.maghrib.iqamah || null,
          ishaAdhan: form.isha.adhan || undefined, ishaIqamah: form.isha.iqamah || null,
        }),
      })
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000) }
    } finally {
      setSaving(false)
    }
  }

  async function handleBulkSave() {
    setSaving(true)
    try {
      const schedules = Array.from({ length: bulkDays }, (_, i) => {
        // Parse the date string as local midnight to avoid UTC offset shifting the day
        const [y, m, day] = date.split('-').map(Number)
        const d = new Date(y, m - 1, day + i)
        return {
          date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
          fajrAdhan: form.fajr.adhan || undefined, fajrIqamah: form.fajr.iqamah || null,
          dhuhrAdhan: form.dhuhr.adhan || undefined, dhuhrIqamah: form.dhuhr.iqamah || null,
          asrAdhan: form.asr.adhan || undefined, asrIqamah: form.asr.iqamah || null,
          maghribAdhan: form.maghrib.adhan || undefined, maghribIqamah: form.maghrib.iqamah || null,
          ishaAdhan: form.isha.adhan || undefined, ishaIqamah: form.isha.iqamah || null,
        }
      })
      await adminFetch(`/mosques/${mosqueId}/prayer-times/bulk`, {
        method: 'POST',
        body: JSON.stringify(schedules),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-start justify-between mb-1">
        <h1 className="text-2xl font-bold text-gray-900">Prayer Times</h1>
        <Link
          href={`/${mosqueId}/prayer/schedule`}
          className="bg-green-800 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-green-900 flex items-center gap-1.5"
        >
          📊 Schedule Grid (30-day)
        </Link>
      </div>
      <p className="text-gray-500 text-sm mb-6">Set adhan and iqamah times for your mosque</p>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-8 w-fit">
        {(['times', 'jumuah', 'taraweeh'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {tab === 'times' ? 'Daily Times' : tab === 'jumuah' ? "Jumu'ah" : 'Taraweeh'}
          </button>
        ))}
      </div>

      {activeTab === 'jumuah' && (
        <div>
          <div className="space-y-4 mb-6">
            {jumuahForms.map((j, idx) => (
              <div key={idx} className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-semibold text-gray-900">Jumu&apos;ah {jumuahForms.length > 1 ? idx + 1 : ''}</span>
                  {jumuahForms.length > 1 && (
                    <button onClick={() => setJumuahForms(f => f.filter((_, i) => i !== idx))} className="text-red-400 text-sm hover:text-red-600">Remove</button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'khutbahTime', label: 'Khutbah Time', type: 'time', placeholder: undefined },
                    { key: 'iqamahTime', label: 'Prayer (Iqamah) Time', type: 'time', placeholder: undefined },
                    { key: 'imam', label: 'Imam', type: 'text', placeholder: 'Imam name (optional)' },
                  ].map(({ key, label, type, placeholder }) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                      <input
                        type={type}
                        value={(j as any)[key]}
                        onChange={e => setJumuahForms(f => f.map((item, i) => i === idx ? { ...item, [key]: e.target.value } : item))}
                        placeholder={placeholder}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-800"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Khutbah Language</label>
                    <select
                      value={j.language}
                      onChange={e => setJumuahForms(f => f.map((item, i) => i === idx ? { ...item, language: e.target.value } : item))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-800 bg-white"
                    >
                      {KHUTBAH_LANGUAGES.map(lang => (
                        <option key={lang} value={lang}>{lang}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                    <input
                      type="text"
                      value={j.notes}
                      onChange={e => setJumuahForms(f => f.map((item, i) => i === idx ? { ...item, notes: e.target.value } : item))}
                      placeholder="Any additional info..."
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-800"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-3 flex-wrap items-center">
            <button
              onClick={() => setJumuahForms(f => [...f, { ...JUMUAH_DEFAULT }])}
              className="border border-gray-200 text-gray-600 rounded-xl px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              + Add Another Jumu&apos;ah
            </button>
            <button
              onClick={() => saveJumuahMutation.mutate()}
              disabled={saveJumuahMutation.isPending}
              className="bg-green-800 text-white rounded-xl px-5 py-2 text-sm font-medium hover:bg-green-900 disabled:opacity-50"
            >
              {saveJumuahMutation.isPending ? 'Saving...' : saved ? '✓ Saved' : 'Save Jumu\'ah Times'}
            </button>
            <button
              onClick={() => { if (confirm('Delete all Jumu\'ah times?')) deleteJumuahMutation.mutate() }}
              disabled={deleteJumuahMutation.isPending}
              className="border border-red-200 text-red-500 rounded-xl px-4 py-2 text-sm font-medium hover:bg-red-50 disabled:opacity-50 ml-auto"
            >
              {deleteJumuahMutation.isPending ? 'Deleting...' : 'Delete All'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'taraweeh' && (
        <div>
          <p className="text-sm text-gray-500 mb-4">Set Taraweeh prayer times for Ramadan. Add a date to schedule per-night entries. These appear in the prayer screen.</p>
          <div className="space-y-4 mb-6">
            {taraweehForms.map((t, idx) => (
              <div key={idx} className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-semibold text-gray-900">
                    Taraweeh {taraweehForms.length > 1 ? idx + 1 : ''}{(t as any).date ? ` · ${(t as any).date}` : ''}
                  </span>
                  {taraweehForms.length > 1 && (
                    <button onClick={() => setTaraweehForms(f => f.filter((_, i) => i !== idx))} className="text-red-400 text-sm hover:text-red-600">Remove</button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Date <span className="font-normal text-gray-400">(optional — e.g. a specific Ramadan night)</span></label>
                    <input
                      type="date"
                      value={(t as any).date ?? ''}
                      onChange={e => setTaraweehForms(f => f.map((item, i) => i === idx ? { ...item, date: e.target.value } : item))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-800"
                    />
                  </div>
                  {[
                    { key: 'startTime', label: 'Start Time', type: 'time' },
                    { key: 'endTime', label: 'End Time (optional)', type: 'time' },
                    { key: 'imam', label: 'Imam', type: 'text', placeholder: 'Imam name (optional)' },
                    { key: 'rakaat', label: 'Rakaat', type: 'number', placeholder: 'e.g. 20' },
                  ].map(({ key, label, type, placeholder }) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                      <input
                        type={type}
                        value={(t as any)[key]}
                        onChange={e => setTaraweehForms(f => f.map((item, i) => i === idx ? { ...item, [key]: e.target.value } : item))}
                        placeholder={placeholder}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-800"
                      />
                    </div>
                  ))}
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                    <input
                      type="text"
                      value={t.notes}
                      onChange={e => setTaraweehForms(f => f.map((item, i) => i === idx ? { ...item, notes: e.target.value } : item))}
                      placeholder="Any additional info..."
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-800"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-3 flex-wrap items-center">
            <button
              onClick={() => setTaraweehForms(f => [...f, { ...TARAWEEH_DEFAULT }])}
              className="border border-gray-200 text-gray-600 rounded-xl px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              + Add Another Taraweeh
            </button>
            <button
              onClick={() => saveTaraweehMutation.mutate()}
              disabled={saveTaraweehMutation.isPending}
              className="bg-green-800 text-white rounded-xl px-5 py-2 text-sm font-medium hover:bg-green-900 disabled:opacity-50"
            >
              {saveTaraweehMutation.isPending ? 'Saving...' : saved ? '✓ Saved' : 'Save Taraweeh Times'}
            </button>
            <button
              onClick={() => { if (confirm('Delete all Taraweeh times?')) deleteTaraweehMutation.mutate() }}
              disabled={deleteTaraweehMutation.isPending}
              className="border border-red-200 text-red-500 rounded-xl px-4 py-2 text-sm font-medium hover:bg-red-50 disabled:opacity-50 ml-auto"
            >
              {deleteTaraweehMutation.isPending ? 'Deleting...' : 'Delete All'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'times' && (
      <div>
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Starting Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-800"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-4">
        <div className="grid grid-cols-3 bg-gray-50 px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <span>Prayer</span>
          <span>Adhan Time <span className="normal-case font-normal text-gray-400">(optional)</span></span>
          <span>Iqamah Time <span className="normal-case font-normal text-gray-400">(optional)</span></span>
        </div>
        {PRAYERS.map((prayer) => (
          <div key={prayer} className="grid grid-cols-3 items-center px-5 py-4 border-t border-gray-50">
            <span className="text-gray-900 font-semibold">{LABELS[prayer]}</span>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={form[prayer].adhan}
                onChange={(e) => setForm((f) => ({ ...f, [prayer]: { ...f[prayer], adhan: e.target.value } }))}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-green-800"
              />
              {form[prayer].adhan && (
                <button onClick={() => setForm((f) => ({ ...f, [prayer]: { ...f[prayer], adhan: '' } }))} className="text-gray-300 hover:text-gray-500 text-xs">✕</button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={form[prayer].iqamah}
                onChange={(e) => setForm((f) => ({ ...f, [prayer]: { ...f[prayer], iqamah: e.target.value } }))}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-green-800"
              />
              {form[prayer].iqamah && (
                <button onClick={() => setForm((f) => ({ ...f, [prayer]: { ...f[prayer], iqamah: '' } }))} className="text-gray-300 hover:text-gray-500 text-xs">✕</button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 flex-wrap">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-green-800 text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-green-900 disabled:opacity-50"
        >
          {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save This Day'}
        </button>

        <div className="flex items-center gap-2">
          <select
            value={bulkDays}
            onChange={(e) => setBulkDays(Number(e.target.value))}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
          >
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
          <button
            onClick={handleBulkSave}
            disabled={saving}
            className="border border-green-800 text-green-800 rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-green-50 disabled:opacity-50"
          >
            Apply to {bulkDays} Days
          </button>
        </div>
      </div>

      <p className="text-gray-400 text-xs mt-3">
        💡 <strong>Adhan</strong> is optional — leave blank and the app will calculate it from your mosque&apos;s location.
        Set <strong>Iqamah</strong> independently; it will always appear on the user side even when adhan is calculated.
      </p>
      <p className="text-gray-400 text-xs mt-1">
        Use &quot;Apply to N Days&quot; to quickly set the same times across multiple days.
      </p>
      </div>
      )}
    </div>
  )
}
