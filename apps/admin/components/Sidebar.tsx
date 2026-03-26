'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { useState } from 'react'
import { useClerk } from '@clerk/nextjs'

interface Mosque {
  id: string
  name: string
  slug: string
  isVerified: boolean
  role: string
}

interface SidebarProps {
  user: { name: string | null; email: string; isSuperAdmin: boolean }
  mosques: Mosque[]
}

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { href: '',           label: 'Dashboard',     icon: HomeIcon },
      { href: '/analytics', label: 'Analytics',     icon: ChartIcon },
    ],
  },
  {
    label: 'Mosque',
    items: [
      { href: '/prayer',          label: 'Prayer Times',    icon: PrayerIcon },
      { href: '/prayer/schedule', label: 'Prayer Schedule', icon: PrayerIcon },
      { href: '/events',          label: 'Events',          icon: CalendarIcon },
      { href: '/calendar',        label: 'Calendar',        icon: MonthIcon },
      { href: '/announcements',   label: 'Announcements',   icon: MegaphoneIcon },
      { href: '/videos',          label: 'Videos',          icon: VideoIcon },
      { href: '/services',        label: 'Services',        icon: ServicesIcon },
    ],
  },
  {
    label: 'Community',
    items: [
      { href: '/followers', label: 'Followers', icon: PeopleIcon },
      { href: '/messages',  label: 'Messages',  icon: MessageIcon },
      { href: '/polls',     label: 'Polls',     icon: ChartIcon },
      { href: '/forms',     label: 'Forms',     icon: FormIcon },
    ],
  },
  {
    label: 'Config',
    items: [
      { href: '/settings', label: 'Settings', icon: GearIcon },
      { href: '/admins',   label: 'Admins',   icon: ShieldIcon },
    ],
  },
]

export function Sidebar({ user, mosques }: SidebarProps) {
  const { mosqueId } = useParams<{ mosqueId: string }>()
  const pathname = usePathname()
  const { signOut } = useClerk()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut({ redirectUrl: '/sign-in' })
    } catch {
      setSigningOut(false)
    }
  }

  const currentMosque = mosques.find((m) => m.id === mosqueId) ?? mosques[0]

  return (
    <aside
      className="sidebar-pattern w-64 flex flex-col h-screen shrink-0 relative overflow-hidden"
      style={{ background: 'linear-gradient(175deg, #0F4423 0%, #0A2E17 55%, #061A0D 100%)' }}
    >
      {/* Radial glow top-right */}
      <div
        className="absolute top-0 right-0 w-48 h-48 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(201,150,58,0.07) 0%, transparent 70%)' }}
      />

      {/* ── Brand ── */}
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-lg font-bold"
            style={{
              background: 'linear-gradient(135deg, #C9963A 0%, #A07820 100%)',
              boxShadow: '0 2px 10px rgba(201,150,58,0.4)',
              fontFamily: 'Georgia, serif',
              color: '#fff',
            }}
          >
            م
          </div>
          <div>
            <p className="text-white text-sm font-bold leading-tight" style={{ fontFamily: 'Fraunces, Georgia, serif', letterSpacing: '-0.02em' }}>
              Masjid Admin
            </p>
            <p className="text-[11px] leading-tight font-medium tracking-wide mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>
              Management Portal
            </p>
          </div>
        </div>
      </div>

      {/* ── Mosque switcher ── */}
      <div className="px-3 pb-4">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all duration-150"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.09)' }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0 font-bold"
            style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}
          >
            {currentMosque?.name?.[0]?.toUpperCase() ?? '٥'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate leading-tight" style={{ color: 'rgba(255,255,255,0.9)' }}>
              {currentMosque?.name ?? (mosques.length === 0 ? 'Super Admin' : 'Select Mosque')}
            </p>
            <p className="text-[11px] truncate capitalize leading-tight mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>
              {currentMosque?.role?.toLowerCase() ?? (user.isSuperAdmin ? 'Platform admin' : '')}
            </p>
          </div>
          {currentMosque?.isVerified && (
            <span className="text-xs font-bold shrink-0" style={{ color: '#C9963A' }}>✓</span>
          )}
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="shrink-0" style={{ color: 'rgba(255,255,255,0.28)', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
            <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {open && mosques.length > 1 && (
          <div
            className="mt-1.5 rounded-xl overflow-hidden animate-slide-down"
            style={{ background: 'rgba(4,16,8,0.96)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)' }}
          >
            {mosques.map((m) => (
              <Link
                key={m.id}
                href={`/${m.id}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors"
                style={{ color: m.id === mosqueId ? '#fff' : 'rgba(255,255,255,0.55)', background: m.id === mosqueId ? 'rgba(255,255,255,0.08)' : 'transparent' }}
              >
                <div
                  className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: m.id === mosqueId ? '#C9963A' : 'rgba(255,255,255,0.1)', color: '#fff' }}
                >
                  {m.name[0].toUpperCase()}
                </div>
                <span className="flex-1 truncate font-medium">{m.name}</span>
                {m.isVerified && <span className="text-[10px] font-bold" style={{ color: '#C9963A' }}>✓</span>}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Gold rule */}
      <div className="mx-4 mb-4" style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(201,150,58,0.22), transparent)' }} />

      {/* ── Nav ── */}
      <nav className="flex-1 px-3 space-y-5 overflow-y-auto pb-4" style={{ scrollbarWidth: 'none' }}>
        {NAV_SECTIONS.map((section) => {
          if (!mosqueId && section.label !== 'Overview') return null
          return (
            <div key={section.label}>
              <p className="px-3 mb-1.5 text-[10px] font-bold tracking-[0.14em] uppercase" style={{ color: 'rgba(201,150,58,0.55)' }}>
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map(({ href, label, icon: Icon }) => {
                  const to = `/${mosqueId}${href}`
                  const active = href === ''
                    ? pathname === `/${mosqueId}`
                    : pathname.startsWith(`/${mosqueId}${href}`)
                  return (
                    <Link
                      key={href}
                      href={to}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 relative group"
                      style={
                        active
                          ? {
                              background: 'linear-gradient(135deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.07) 100%)',
                              color: '#fff',
                              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)',
                            }
                          : { color: 'rgba(255,255,255,0.5)' }
                      }
                    >
                      {active && (
                        <span
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-r-full"
                          style={{ height: '26px', background: '#C9963A' }}
                        />
                      )}
                      <span
                        className="w-4 h-4 flex items-center justify-center shrink-0 transition-colors"
                        style={{ color: active ? '#C9963A' : 'rgba(255,255,255,0.3)' }}
                      >
                        <Icon />
                      </span>
                      <span>{label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}

        {user.isSuperAdmin && (
          <div>
            <p className="px-3 mb-1.5 text-[10px] font-bold tracking-[0.14em] uppercase" style={{ color: 'rgba(201,150,58,0.55)' }}>
              Platform
            </p>
            <div className="space-y-0.5">
              {[
                { href: '/admin/verifications', label: 'Verifications',  icon: VerifyIcon },
                { href: '/admin/reports',        label: 'Reports',        icon: FlagIcon },
                { href: '/admin/mosque-import',  label: 'Import Mosques', icon: ImportIcon },
              ].map(({ href, label, icon: Icon }) => {
                const active = pathname.startsWith(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 relative group"
                    style={
                      active
                        ? {
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.07) 100%)',
                            color: '#fff',
                          }
                        : { color: 'rgba(255,255,255,0.5)' }
                    }
                  >
                    {active && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-r-full"
                        style={{ height: '26px', background: '#C9963A' }}
                      />
                    )}
                    <span
                      className="w-4 h-4 flex items-center justify-center shrink-0"
                      style={{ color: active ? '#C9963A' : 'rgba(255,255,255,0.3)' }}
                    >
                      <Icon />
                    </span>
                    <span>{label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Hairline rule */}
      <div className="mx-4" style={{ height: '1px', background: 'rgba(255,255,255,0.07)' }} />

      {/* ── User footer ── */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-2.5 mb-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 uppercase"
            style={{ background: 'linear-gradient(135deg, #C9963A 0%, #A07820 100%)', color: '#fff' }}
          >
            {user.name?.charAt(0)?.toUpperCase() ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate leading-tight" style={{ color: 'rgba(255,255,255,0.88)' }}>
              {user.name}
            </p>
            <p className="text-[11px] truncate leading-tight mt-0.5" style={{ color: 'rgba(255,255,255,0.32)' }}>
              {user.email}
            </p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full flex items-center gap-2 text-left text-xs font-semibold px-2 py-1.5 rounded-lg transition-all duration-150 disabled:opacity-50 hover:bg-red-500/10"
          style={{ color: 'rgba(255,110,110,0.65)' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </aside>
  )
}

// ── Icon set ──────────────────────────────────────────────────────────────────

function HomeIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
}
function ChartIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
}
function PrayerIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
}
function CalendarIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
}
function MonthIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg>
}
function MegaphoneIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 19-7z"/></svg>
}
function VideoIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
}
function ServicesIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 19.07l1.41-1.41M12 2v2M12 20v2M4.93 4.93l1.41 1.41M19.07 19.07l-1.41-1.41M2 12h2M20 12h2"/></svg>
}
function PeopleIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
}
function MessageIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
}
function FormIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
}
function GearIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 19.07l1.41-1.41M12 2v2M12 20v2M4.93 4.93l1.41 1.41M19.07 19.07l-1.41-1.41M2 12h2M20 12h2"/></svg>
}
function ShieldIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
}
function VerifyIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>
}
function FlagIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
}
function ImportIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
}
