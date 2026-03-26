'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, addDays, startOfToday, isFriday, parseISO } from 'date-fns'
import Link from 'next/link'
import { useAdminFetch } from '../../../../../lib/adminFetch'

// ─── Types ──────────────────────────────────────────────────────────────────

type TimeField =
  | 'fajrAdhan' | 'fajrIqamah'
  | 'dhuhrAdhan' | 'dhuhrIqamah'
  | 'asrAdhan'   | 'asrIqamah'
  | 'maghribAdhan' | 'maghribIqamah'
  | 'ishaAdhan'  | 'ishaIqamah'

interface DayRow {
  date: string            // YYYY-MM-DD
  fajrAdhan: string
  fajrIqamah: string
  dhuhrAdhan: string
  dhuhrIqamah: string
  asrAdhan: string
  asrIqamah: string
  maghribAdhan: string
  maghribIqamah: string
  ishaAdhan: string
  ishaIqamah: string
  jumuahKhutbah: string   // Friday only — stored locally, submitted to jumuah endpoint
  jumuahIqamah: string    // Friday only
  notes: string
}

// ─── Columns ────────────────────────────────────────────────────────────────

const PRAYER_COLS: { field: TimeField; label: string; prayer: string; type: 'adhan' | 'iqamah' }[] = [
  { field: 'fajrAdhan',    label: 'Adhan',  prayer: 'Fajr',    type: 'adhan'  },
  { field: 'fajrIqamah',   label: 'Iqamah', prayer: 'Fajr',    type: 'iqamah' },
  { field: 'dhuhrAdhan',   label: 'Adhan',  prayer: 'Dhuhr',   type: 'adhan'  },
  { field: 'dhuhrIqamah',  label: 'Iqamah', prayer: 'Dhuhr',   type: 'iqamah' },
  { field: 'asrAdhan',     label: 'Adhan',  prayer: 'Asr',     type: 'adhan'  },
  { field: 'asrIqamah',    label: 'Iqamah', prayer: 'Asr',     type: 'iqamah' },
  { field: 'maghribAdhan', label: 'Adhan',  prayer: 'Maghrib', type: 'adhan'  },
  { field: 'maghribIqamah',label: 'Iqamah', prayer: 'Maghrib', type: 'iqamah' },
  { field: 'ishaAdhan',    label: 'Adhan',  prayer: 'Isha',    type: 'adhan'  },
  { field: 'ishaIqamah',   label: 'Iqamah', prayer: 'Isha',    type: 'iqamah' },
]

const PRAYER_GROUPS = [
  { name: 'Fajr',    fields: ['fajrAdhan', 'fajrIqamah']       },
  { name: 'Dhuhr',   fields: ['dhuhrAdhan', 'dhuhrIqamah']     },
  { name: 'Asr',     fields: ['asrAdhan', 'asrIqamah']         },
  { name: 'Maghrib', fields: ['maghribAdhan', 'maghribIqamah'] },
  { name: 'Isha',    fields: ['ishaAdhan', 'ishaIqamah']       },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildEmpty(date: string): DayRow {
  return {
    date,
    fajrAdhan: '', fajrIqamah: '',
    dhuhrAdhan: '', dhuhrIqamah: '',
    asrAdhan: '', asrIqamah: '',
    maghribAdhan: '', maghribIqamah: '',
    ishaAdhan: '', ishaIqamah: '',
    jumuahKhutbah: '', jumuahIqamah: '',
    notes: '',
  }
}

function mergeExisting(empty: DayRow, existing: any): DayRow {
  if (!existing) return empty
  return {
    ...empty,
    fajrAdhan:     existing.fajrAdhan     ?? '',
    fajrIqamah:    existing.fajrIqamah    ?? '',
    dhuhrAdhan:    existing.dhuhrAdhan    ?? '',
    dhuhrIqamah:   existing.dhuhrIqamah   ?? '',
    asrAdhan:      existing.asrAdhan      ?? '',
    asrIqamah:     existing.asrIqamah     ?? '',
    maghribAdhan:  existing.maghribAdhan  ?? '',
    maghribIqamah: existing.maghribIqamah ?? '',
    ishaAdhan:     existing.ishaAdhan     ?? '',
    ishaIqamah:    existing.ishaIqamah    ?? '',
  }
}

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ─── Cell Component ──────────────────────────────────────────────────────────

function TimeCell({
  value,
  onChange,
  filled,
}: {
  value: string
  onChange: (v: string) => void
  filled?: boolean
}) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    let v = e.target.value.replace(/[^0-9:]/g, '')
    // Auto-insert colon after 2 digits
    if (v.length === 2 && !v.includes(':')) v = v + ':'
    if (v.length > 5) v = v.slice(0, 5)
    onChange(v)
  }

  return (
    <input
      type="text"
      value={value}
      onChange={handleChange}
      placeholder="--:--"
      maxLength={5}
      className={[
        'w-16 text-center text-xs font-mono border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-green-600',
        filled ? 'bg-green-50 border-green-200 text-green-900' : 'bg-white border-gray-200 text-gray-700',
      ].join(' ')}
    />
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PrayerSchedulePage() {
  const { mosqueId } = useParams<{ mosqueId: string }>()
  const adminFetch = useAdminFetch()
  const queryClient = useQueryClient()

  const today = startOfToday()
  const [numDays, setNumDays] = useState(30)
  const [rows, setRows] = useState<DayRow[]>([])
  const [initialised, setInitialised] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [copySourceRow, setCopySourceRow] = useState<number | null>(null)

  // Fetch existing schedules
  const { data: existingData, isLoading } = useQuery({
    queryKey: ['prayer-schedule-bulk', mosqueId, numDays],
    queryFn: () =>
      adminFetch(`/mosques/${mosqueId}/prayer-times?days=${numDays}`).then(r => r.json()),
  })

  useEffect(() => {
    if (!existingData || initialised) return
    const existingMap: Record<string, any> = {}
    for (const s of (existingData as any)?.data?.items ?? []) {
      existingMap[localDateStr(new Date(s.date))] = s
    }
    const generated: DayRow[] = Array.from({ length: numDays }, (_, i) => {
      const d = addDays(today, i)
      const dateStr = localDateStr(d)
      return mergeExisting(buildEmpty(dateStr), existingMap[dateStr])
    })
    setRows(generated)
    setInitialised(true)
  }, [existingData, initialised, numDays])

  // Fetch Jumu'ah schedules for reference
  const { data: jumuahData } = useQuery({
    queryKey: ['jumuah-schedules-ref', mosqueId],
    queryFn: () => adminFetch(`/mosques/${mosqueId}/jumuah`).then(r => r.json()),
  })

  // Bulk save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Dates that were previously saved in the DB
      const previouslySavedDates = new Set(
        ((existingData as any)?.data?.items ?? []).map((s: any) => localDateStr(new Date(s.date)))
      )

      const nonEmptyRows = rows.filter(r =>
        PRAYER_COLS.some(c => r[c.field] !== '')
      )
      const emptyRows = rows.filter(r =>
        PRAYER_COLS.every(c => r[c.field] === '')
      )

      // Delete rows that were previously saved but are now fully cleared
      const datesToDelete = emptyRows
        .filter(r => previouslySavedDates.has(r.date))
        .map(r => r.date)

      if (datesToDelete.length > 0) {
        const res = await adminFetch(`/mosques/${mosqueId}/prayer-times/bulk-delete`, {
          method: 'DELETE',
          body: JSON.stringify({ dates: datesToDelete }),
        })
        if (!res.ok) throw new Error('Delete failed')
      }

      // Send null for cleared fields so Prisma writes NULL — undefined is silently skipped by Prisma upsert
      const prayerSchedules = nonEmptyRows.map(r => ({
        date: r.date,
        fajrAdhan:     r.fajrAdhan     || null,
        fajrIqamah:    r.fajrIqamah    || null,
        dhuhrAdhan:    r.dhuhrAdhan    || null,
        dhuhrIqamah:   r.dhuhrIqamah   || null,
        asrAdhan:      r.asrAdhan      || null,
        asrIqamah:     r.asrIqamah     || null,
        maghribAdhan:  r.maghribAdhan  || null,
        maghribIqamah: r.maghribIqamah || null,
        ishaAdhan:     r.ishaAdhan     || null,
        ishaIqamah:    r.ishaIqamah    || null,
      }))

      if (prayerSchedules.length > 0) {
        const res = await adminFetch(`/mosques/${mosqueId}/prayer-times/bulk`, {
          method: 'POST',
          body: JSON.stringify(prayerSchedules),
        })
        if (!res.ok) throw new Error('Save failed')
      }

      // Also save Friday Jumu'ah overrides
      const fridayRows = rows.filter(r => {
        const d = parseISO(r.date)
        return isFriday(d) && (r.jumuahKhutbah || r.jumuahIqamah)
      })
      if (fridayRows.length > 0) {
        const schedules = fridayRows.map(r => ({
          khutbahTime: r.jumuahKhutbah,
          iqamahTime: r.jumuahIqamah,
          language: 'English',
        }))
        await adminFetch(`/mosques/${mosqueId}/jumuah`, {
          method: 'PUT',
          body: JSON.stringify({ schedules }),
        })
      }
    },
    onSuccess: () => {
      setStatus('saved')
      setInitialised(false) // allow grid to re-sync from fresh DB data after invalidation
      queryClient.invalidateQueries({ queryKey: ['prayer-schedule-bulk', mosqueId] })
      queryClient.invalidateQueries({ queryKey: ['prayer-times', mosqueId] })
      queryClient.invalidateQueries({ queryKey: ['jumuah-schedules', mosqueId] })
      setTimeout(() => setStatus('idle'), 2000)
    },
    onError: () => setStatus('error'),
  })

  // Cell update
  function updateCell(rowIdx: number, field: keyof DayRow, value: string) {
    setRows(prev => prev.map((r, i) => i === rowIdx ? { ...r, [field]: value } : r))
  }

  // Fill-down: copy row to all rows below (or selected rows)
  function fillDown(fromIdx: number) {
    const source = rows[fromIdx]
    if (!source) return
    setRows(prev => prev.map((r, i) => {
      if (i <= fromIdx) return r
      if (selectedRows.size > 0 && !selectedRows.has(i)) return r
      return { ...r, ...Object.fromEntries(
        PRAYER_COLS.map(c => [c.field, source[c.field]])
      )}
    }))
    setCopySourceRow(null)
    setSelectedRows(new Set())
  }

  // Copy an entire row's times to selected rows
  function applyToSelected(fromIdx: number) {
    const source = rows[fromIdx]
    if (!source || selectedRows.size === 0) return
    setRows(prev => prev.map((r, i) =>
      selectedRows.has(i) && i !== fromIdx
        ? { ...r, ...Object.fromEntries(PRAYER_COLS.map(c => [c.field, source[c.field]])) }
        : r
    ))
    setCopySourceRow(null)
    setSelectedRows(new Set())
  }

  function toggleRowSelect(idx: number) {
    setSelectedRows(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded-lg" />)}
        </div>
      </div>
    )
  }

  const filledCount = rows.filter(r =>
    PRAYER_COLS.some(c => r[c.field] !== '')
  ).length

  return (
    <div className="p-6 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href={`/${mosqueId}/prayer`} className="text-gray-400 hover:text-gray-600 text-sm">
              ← Prayer Times
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Prayer Schedule Grid</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {filledCount} of {rows.length} days filled
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={numDays}
            onChange={e => { setInitialised(false); setNumDays(Number(e.target.value)) }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white"
          >
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>

          <button
            onClick={() => {
              if (!confirm('Clear all times in the grid? This does not delete saved data until you Save.')) return
              setRows(prev => prev.map(r => buildEmpty(r.date)))
            }}
            className="border border-gray-200 text-gray-600 rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-gray-50 hover:border-gray-300"
          >
            🗑 Clear All
          </button>

          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="bg-green-800 text-white rounded-xl px-6 py-2.5 text-sm font-semibold hover:bg-green-900 disabled:opacity-60 flex items-center gap-2"
          >
            {saveMutation.isPending ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving…
              </>
            ) : status === 'saved' ? '✓ Saved' : status === 'error' ? '✗ Error' : '💾 Save Schedule'}
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-amber-100 border border-amber-200" />
          <span>Friday / Jumu'ah</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-blue-50 border border-blue-200" />
          <span>Selected row</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-50 border border-green-200" />
          <span>Has value</span>
        </div>
        <span className="ml-2 text-gray-400">Tip: Click a row checkbox to select, then use Fill Down or Apply to Selected</span>
      </div>

      {/* Selection toolbar */}
      {selectedRows.size > 0 && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-4">
          <span className="text-sm font-medium text-blue-800">{selectedRows.size} rows selected</span>
          {copySourceRow !== null && (
            <button
              onClick={() => applyToSelected(copySourceRow)}
              className="bg-blue-700 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-blue-800"
            >
              Apply row {copySourceRow + 1} times to selected
            </button>
          )}
          <button
            onClick={() => { setSelectedRows(new Set()); setCopySourceRow(null) }}
            className="text-blue-600 text-sm hover:underline ml-auto"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Grid */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
        <table className="w-full text-xs border-collapse min-w-max">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="sticky left-0 z-10 bg-gray-50 px-2 py-2 w-6 border-r border-gray-200" />
              <th className="sticky left-6 z-10 bg-gray-50 px-3 py-2 text-left text-gray-600 font-semibold w-28 border-r border-gray-200">Date</th>
              {PRAYER_GROUPS.map(g => (
                <th key={g.name} colSpan={2} className="px-2 py-2 text-center text-gray-600 font-semibold border-r border-gray-100 bg-gray-50">
                  {g.name}
                </th>
              ))}
              <th className="px-2 py-2 text-center text-amber-700 font-semibold border-r border-gray-100 bg-amber-50 w-36">
                Jumu'ah (Fri)
              </th>
              <th className="px-2 py-2 text-left text-gray-500 font-normal w-36">Actions</th>
            </tr>
            <tr className="bg-gray-50 border-b-2 border-gray-200 text-gray-400">
              <th className="sticky left-0 z-10 bg-gray-50 border-r border-gray-200" />
              <th className="sticky left-6 z-10 bg-gray-50 border-r border-gray-200" />
              {PRAYER_COLS.map((c, i) => (
                <th key={c.field} className={[
                  'px-1 py-1 font-normal text-center',
                  i % 2 === 1 ? 'border-r border-gray-100' : '',
                ].join(' ')}>
                  <div className="flex flex-col items-center gap-0.5">
                    <span>{c.label}</span>
                    <button
                      onClick={() => setRows(prev => prev.map(r => ({ ...r, [c.field]: '' })))}
                      title={`Clear all ${c.prayer} ${c.label}`}
                      className="text-red-300 hover:text-red-500 text-xs leading-none"
                    >✕</button>
                  </div>
                </th>
              ))}
              <th className="px-1 py-1 font-normal text-center border-r border-gray-100">Khutbah</th>
              <th className="px-1 py-1 font-normal text-center border-r border-gray-100">Iqamah</th>
              <th />
            </tr>
          </thead>

          <tbody>
            {rows.map((row, idx) => {
              const d = parseISO(row.date)
              const isFri = isFriday(d)
              const isSelected = selectedRows.has(idx)
              const isToday = row.date === localDateStr(today)

              const rowBg = isSelected
                ? 'bg-blue-50'
                : isFri
                ? 'bg-amber-50'
                : idx % 2 === 0
                ? 'bg-white'
                : 'bg-gray-50/40'

              return (
                <tr key={row.date} className={[rowBg, 'border-b border-gray-100 hover:bg-blue-50/30 group'].join(' ')}>
                  {/* Checkbox */}
                  <td className={`sticky left-0 z-10 px-2 border-r border-gray-100 ${isSelected ? 'bg-blue-50' : isFri ? 'bg-amber-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleRowSelect(idx)}
                      className="rounded border-gray-300 text-green-700"
                    />
                  </td>

                  {/* Date label */}
                  <td className={`sticky left-6 z-10 px-3 py-2 border-r border-gray-200 whitespace-nowrap ${isSelected ? 'bg-blue-50' : isFri ? 'bg-amber-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                    <div className="flex flex-col">
                      <span className={['font-semibold', isToday ? 'text-green-700' : isFri ? 'text-amber-700' : 'text-gray-800'].join(' ')}>
                        {format(d, 'EEE, MMM d')}
                        {isToday && <span className="ml-1 text-green-600 text-xs">(today)</span>}
                      </span>
                      {isFri && <span className="text-amber-600 text-xs font-medium">Jumu'ah</span>}
                    </div>
                  </td>

                  {/* Prayer time cells */}
                  {PRAYER_COLS.map((c, i) => (
                    <td key={c.field} className={['px-1 py-1.5 text-center', i % 2 === 1 ? 'border-r border-gray-100' : ''].join(' ')}>
                      <TimeCell
                        value={row[c.field]}
                        onChange={v => updateCell(idx, c.field, v)}
                        filled={row[c.field] !== ''}
                      />
                    </td>
                  ))}

                  {/* Friday Jumu'ah columns */}
                  <td className="px-1 py-1.5 text-center">
                    {isFri ? (
                      <TimeCell
                        value={row.jumuahKhutbah}
                        onChange={v => updateCell(idx, 'jumuahKhutbah', v)}
                        filled={row.jumuahKhutbah !== ''}
                      />
                    ) : <span className="text-gray-200">—</span>}
                  </td>
                  <td className="px-1 py-1.5 text-center border-r border-gray-100">
                    {isFri ? (
                      <TimeCell
                        value={row.jumuahIqamah}
                        onChange={v => updateCell(idx, 'jumuahIqamah', v)}
                        filled={row.jumuahIqamah !== ''}
                      />
                    ) : <span className="text-gray-200">—</span>}
                  </td>

                  {/* Row actions */}
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => fillDown(idx)}
                        title="Fill down from this row"
                        className="text-xs bg-green-700 text-white px-2 py-1 rounded hover:bg-green-800"
                      >
                        ↓ Fill
                      </button>
                      <button
                        onClick={() => {
                          setCopySourceRow(idx)
                          if (selectedRows.size === 0) {
                            // auto-select all rows below
                            const below = new Set(
                              Array.from({ length: rows.length - idx - 1 }, (_, i) => idx + 1 + i)
                            )
                            setSelectedRows(below)
                          }
                        }}
                        title="Copy row, then apply to selected"
                        className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                      >
                        Copy
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Bottom save bar */}
      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm text-gray-400">
          Rows with times filled will be saved. Fully cleared rows will be deleted from the schedule.
        </p>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="bg-green-800 text-white rounded-xl px-6 py-2.5 text-sm font-semibold hover:bg-green-900 disabled:opacity-60"
        >
          {saveMutation.isPending ? 'Saving…' : status === 'saved' ? '✓ Schedule Saved' : '💾 Save Schedule'}
        </button>
      </div>
    </div>
  )
}
