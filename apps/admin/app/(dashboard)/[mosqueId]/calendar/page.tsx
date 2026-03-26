'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isToday, isSameDay, addMonths, subMonths,
} from 'date-fns'
import { useAdminFetch } from '../../../../lib/adminFetch'

export default function CalendarPage() {
  const { mosqueId } = useParams<{ mosqueId: string }>()
  const router = useRouter()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const adminFetch = useAdminFetch()

  const { data: eventsData } = useQuery({
    queryKey: ['admin-events-cal', mosqueId],
    queryFn: () => adminFetch(`/mosques/${mosqueId}/events?upcoming=false&limit=100`).then((r) => r.json()),
  })

  const { data: announcementsData } = useQuery({
    queryKey: ['admin-announcements-cal', mosqueId],
    queryFn: () => adminFetch(`/mosques/${mosqueId}/announcements?limit=100`).then((r) => r.json()),
  })

  const events = eventsData?.data?.items ?? []
  const announcements = announcementsData?.data?.items ?? []

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })

  function getItemsForDay(day: Date) {
    const evs = events.filter((e: any) => isSameDay(new Date(e.startTime), day))
    const anns = announcements.filter((a: any) => isSameDay(new Date(a.publishAt ?? a.createdAt), day))
    return { events: evs, announcements: anns }
  }

  function getSelectedItems() {
    if (!selectedDay) return { events: [], announcements: [] }
    return getItemsForDay(selectedDay)
  }

  const selectedItems = getSelectedItems()

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-gray-500 text-sm mt-1">Events and announcements overview</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600">‹</button>
          <span className="text-base font-semibold text-gray-900 w-36 text-center">{format(currentMonth, 'MMMM yyyy')}</span>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600">›</button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Calendar grid */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-100">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="text-center text-xs font-semibold text-gray-400 py-3">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: days[0].getDay() }).map((_, i) => (
              <div key={`empty-${i}`} className="border-t border-r border-gray-50 h-24" />
            ))}
            {days.map((day) => {
              const { events: dayEvents, announcements: dayAnns } = getItemsForDay(day)
              const hasItems = dayEvents.length > 0 || dayAnns.length > 0
              const isSelected = selectedDay && isSameDay(day, selectedDay)
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDay(isSameDay(day, selectedDay ?? new Date(0)) ? null : day)}
                  className={`border-t border-r border-gray-50 h-24 p-2 text-left transition-colors hover:bg-gray-50 ${
                    isSelected ? 'bg-green-50' : ''
                  } ${!isSameMonth(day, currentMonth) ? 'opacity-30' : ''}`}
                >
                  <span className={`text-sm font-medium inline-flex w-7 h-7 items-center justify-center rounded-full ${
                    isToday(day) ? 'bg-green-800 text-white' : 'text-gray-700'
                  }`}>
                    {format(day, 'd')}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {dayEvents.slice(0, 2).map((e: any) => (
                      <div key={e.id} className="text-xs bg-green-100 text-green-800 rounded px-1 truncate">{e.title}</div>
                    ))}
                    {dayAnns.slice(0, 1).map((a: any) => (
                      <div key={a.id} className="text-xs bg-amber-100 text-amber-700 rounded px-1 truncate">📢 {a.title}</div>
                    ))}
                    {dayEvents.length + dayAnns.length > 3 && (
                      <div className="text-xs text-gray-400">+{dayEvents.length + dayAnns.length - 3} more</div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Day detail panel */}
        <div className="w-72 flex-shrink-0">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 sticky top-4">
            <h3 className="font-semibold text-gray-900 mb-3">
              {selectedDay ? format(selectedDay, 'EEEE, MMMM d') : 'Select a day'}
            </h3>
            {!selectedDay && <p className="text-gray-400 text-sm">Click a day to see what's on</p>}
            {selectedDay && selectedItems.events.length === 0 && selectedItems.announcements.length === 0 && (
              <p className="text-gray-400 text-sm">Nothing scheduled</p>
            )}
            {selectedItems.events.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Events</p>
                <div className="space-y-2">
                  {selectedItems.events.map((e: any) => (
                    <button
                      key={e.id}
                      onClick={() => router.push(`/${mosqueId}/events`)}
                      className="w-full text-left bg-green-50 hover:bg-green-100 rounded-xl px-3 py-2 transition-colors"
                    >
                      <p className="text-sm font-medium text-gray-900">{e.title}</p>
                      <p className="text-xs text-gray-500">{format(new Date(e.startTime), 'h:mm a')}{e.location ? ` · ${e.location}` : ''}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{e.rsvpCount ?? 0} RSVPs · <span className="text-green-700">Edit →</span></p>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {selectedItems.announcements.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Announcements</p>
                <div className="space-y-2">
                  {selectedItems.announcements.map((a: any) => (
                    <button
                      key={a.id}
                      onClick={() => router.push(`/${mosqueId}/announcements`)}
                      className="w-full text-left bg-amber-50 hover:bg-amber-100 rounded-xl px-3 py-2 transition-colors"
                    >
                      <p className="text-sm font-medium text-gray-900">{a.title}</p>
                      <p className="text-xs text-gray-400">{a.isPublished ? 'Published' : '⏰ Scheduled'} · <span className="text-amber-700">Edit →</span></p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mt-3">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Legend</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-green-200" /><span className="text-xs text-gray-600">Event</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-amber-200" /><span className="text-xs text-gray-600">Announcement</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
