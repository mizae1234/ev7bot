'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LoginProfile } from '@/components/ui/LoginProfile'

interface NavItem {
  name: string
  href: string
  desc: string
  icon: string
  badge?: string
}

interface NavGroup {
  id: string
  label: string
  icon: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    id: 'maintenance',
    label: 'งานซ่อม',
    icon: '🔧',
    items: [
      {
        name: 'แจ้งเหตุ (Quick Report)',
        href: '/liff/quick-report',
        desc: 'แบบฟอร์มแจ้งเหตุ แจ้งซ่อมด่วน และตรวจเช็คตัวรถ',
        icon: '🚨'
      },
      {
        name: 'ศูนย์จัดการงานซ่อม',
        href: '/maintenance',
        desc: 'ติดตามงานซ่อมตามศูนย์บริการ/อู่ และสถานะเคส',
        icon: '📋'
      },
      {
        name: 'บอร์ดงานซ่อม & การถือครองรถ',
        href: '/custody',
        desc: 'กระดานติดตามงานซ่อมและการถือครองรถยนต์ในแต่ละฝ่าย',
        icon: '📋'
      }
    ]
  },
  {
    id: 'delivery',
    label: 'ส่งมอบ & รับคืน',
    icon: '🚚',
    items: [
      {
        name: 'งานส่งมอบรถยนต์',
        href: '/case-delivery',
        desc: 'จัดการเคสและการส่งมอบรถให้ลูกค้า',
        icon: '🚚'
      },
      {
        name: 'มอนิเตอร์การรับคืนรถ (Returns)',
        href: '/dashboard/returns-monitor',
        desc: 'ติดตามและตรวจสอบรายการรับคืนรถ',
        icon: '🔄'
      }
    ]
  },
  {
    id: 'others',
    label: 'อื่นๆ',
    icon: '📂',
    items: [
      {
        name: 'ประกันภัย & ภาษีรถยนต์',
        href: '/policies',
        desc: 'จัดการประกัน พ.ร.บ. ภาษี และเอกสาร PDF',
        icon: '🛡️'
      },
      {
        name: 'ประวัติการเคลื่อนย้ายรถ',
        href: '/vehicle-movement',
        desc: 'ติดตามการเปลี่ยนสถานที่ พิกัดจอด และการย้ายรถ',
        icon: '📍'
      },
      {
        name: 'ประวัติการยึดรถ',
        href: '/vehicle-repossess',
        desc: 'ตรวจสอบและติดตามประวัติการยึดคืนรถยนต์',
        icon: '🚨'
      },
      {
        name: 'บันทึกหมายเหตุรถ',
        href: '/vehicle-notes',
        desc: 'บันทึกประวัติและโน้ตสำคัญประจำคันรถ',
        icon: '📝'
      },
      {
        name: 'บันทึกรถเข้า-ออก (Gate Log)',
        href: '/gate-monitor',
        desc: 'ติดตามรายงานรถเข้า-ออกจาก รปภ ผ่านกลุ่ม LINE',
        icon: '🚧'
      },
      {
        name: 'งานสัญญา (EV Core)',
        href: '/case-contract',
        desc: 'ตรวจสอบสัญญาและสถานะทางสัญญา',
        icon: '📄'
      }
    ]
  }
]

export function Navbar() {
  const pathname = usePathname()
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [logoError, setLogoError] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close mobile menu on page change
  useEffect(() => {
    setMobileMenuOpen(false)
    setOpenDropdown(null)
  }, [pathname])

  // Don't render navbar on LIFF mobile views or Audit pages (must be called AFTER all hooks)
  if (pathname && (pathname.startsWith('/liff') || pathname.startsWith('/audit'))) {
    return null
  }

  const isDashboardActive = pathname === '/dashboard' || pathname === '/'
  const isMonitorActive = pathname.startsWith('/monitor')
  const isReplacementsActive = pathname.startsWith('/replacements')

  const isGroupActive = (group: NavGroup) => {
    return group.items.some((item) => pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href)))
  }

  return (
    <header className="sticky top-0 z-50 w-full bg-gradient-to-r from-emerald-100/90 via-teal-50/95 to-sky-100/90 backdrop-blur-md border-b border-emerald-200/90 shadow-sm transition-all">
      {/* Top Brand Accent Stripe (EV7 Green to Blue) */}
      <div className="h-[3px] w-full bg-gradient-to-r from-[#009639] via-[#00A859] via-sky-500 to-[#0066CC]" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* 1. Brand Logo */}
          <div className="flex items-center gap-3 lg:gap-5 shrink-0">
            <Link
              href="/dashboard"
              className="flex items-center gap-2.5 group transition-transform active:scale-98 shrink-0"
            >
              <div className="relative h-9 flex items-center bg-white px-2.5 py-1 rounded-xl border border-emerald-200 shadow-xs group-hover:border-emerald-500/60 group-hover:shadow-sm transition-all shrink-0">
                {logoError ? (
                  <span className="font-black text-sm text-emerald-600 tracking-wider">
                    ⚡ EV7
                  </span>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src="/images/ev7-logo.png"
                    alt="EV7 Logo"
                    className="object-contain h-6 sm:h-7 w-auto block shrink-0"
                    onError={() => setLogoError(true)}
                  />
                )}
              </div>
              <div className="hidden xl:flex flex-col shrink-0">
                <span className="font-bold text-xs tracking-tight text-slate-900">
                  Operations
                </span>
                <span className="text-[10px] text-slate-500 font-medium tracking-tight -mt-0.5">
                  Fleet & Maintenance
                </span>
              </div>
            </Link>

            {/* Subtle Divider between brand and nav on large screens */}
            <div className="hidden xl:block h-6 w-px bg-emerald-200/80" />

            {/* 2. Desktop Navigation */}
            <nav ref={dropdownRef} className="hidden md:flex items-center gap-1 lg:gap-1.5">
              {/* Menu 1: Direct Link to Dashboard (Home) */}
              <Link
                href="/dashboard"
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm transition-all cursor-pointer ${
                  isDashboardActive
                    ? 'bg-white text-emerald-800 font-bold border border-emerald-300/80 shadow-xs ring-1 ring-emerald-500/10'
                    : 'text-slate-700 font-medium hover:bg-white/60 hover:text-slate-950'
                }`}
              >
                <span>📊</span>
                <span>แดชบอร์ด</span>
              </Link>

              {/* Menu 2: Direct Link to Monitor (ประกัน/ภาษี) */}
              <Link
                href="/monitor"
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm transition-all cursor-pointer ${
                  isMonitorActive
                    ? 'bg-white text-emerald-800 font-bold border border-emerald-300/80 shadow-xs ring-1 ring-emerald-500/10'
                    : 'text-slate-700 font-medium hover:bg-white/60 hover:text-slate-950'
                }`}
              >
                <span>🛡️</span>
                <span>มอนิเตอร์</span>
              </Link>

              {/* Menu 3: Direct Link to รถทดแทน (Replacements) */}
              <Link
                href="/replacements"
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm transition-all cursor-pointer ${
                  isReplacementsActive
                    ? 'bg-white text-emerald-800 font-bold border border-emerald-300/80 shadow-xs ring-1 ring-emerald-500/10'
                    : 'text-slate-700 font-medium hover:bg-white/60 hover:text-slate-950'
                }`}
              >
                <span>🚗🔄</span>
                <span>รถทดแทน</span>
              </Link>

              {/* Grouped Dropdown Menus: งานซ่อม, ส่งมอบ & รับคืน, อื่นๆ */}
              {navGroups.map((group) => {
                const active = isGroupActive(group)
                const isOpen = openDropdown === group.id

                return (
                  <div key={group.id} className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(isOpen ? null : group.id)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm transition-all cursor-pointer ${
                        active
                          ? 'bg-white text-emerald-800 font-bold border border-emerald-300/80 shadow-xs ring-1 ring-emerald-500/10'
                          : 'text-slate-700 font-medium hover:bg-white/60 hover:text-slate-950'
                      }`}
                    >
                      <span>{group.icon}</span>
                      <span>{group.label}</span>
                      <svg
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${
                          active ? 'text-emerald-700' : 'text-slate-500'
                        } ${isOpen ? 'rotate-180 text-emerald-700' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Dropdown Menu */}
                    {isOpen && (
                      <div className="absolute left-0 mt-2 w-80 rounded-2xl bg-white shadow-xl shadow-emerald-950/10 border border-emerald-100 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 ring-1 ring-black/5">
                        <div className="px-3 py-1.5 mb-1 text-[11px] font-bold text-emerald-800/70 uppercase tracking-wider">
                          {group.label}
                        </div>
                        <div className="space-y-1">
                          {group.items.map((item) => {
                            const isItemActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))

                            return (
                              <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setOpenDropdown(null)}
                                className={`flex items-start gap-3 p-2.5 rounded-xl transition-all ${
                                  isItemActive
                                    ? 'bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200'
                                    : 'hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                <span className="text-xl shrink-0 mt-0.5">{item.icon}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-semibold text-slate-900">
                                      {item.name}
                                    </span>
                                    {item.badge && (
                                      <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                                        {item.badge}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10.5px] text-slate-500 line-clamp-1 mt-0.5">
                                    {item.desc}
                                  </p>
                                </div>
                              </Link>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </nav>
          </div>

          {/* 3. Right Side Actions & Profile */}
          <div className="flex items-center gap-3">
            {/* Divider on desktop */}
            <div className="hidden md:block h-6 w-px bg-emerald-200/80" />
            <LoginProfile />

            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 4. Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200/80 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl px-4 py-4 max-h-[85vh] overflow-y-auto space-y-4 shadow-xl">
          {/* Direct Link: Dashboard */}
          <div className="space-y-1">
            <Link
              href="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 p-2.5 rounded-xl transition-all ${
                isDashboardActive
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/20'
                  : 'hover:bg-slate-50 dark:hover:bg-zinc-800/60 text-slate-700 dark:text-zinc-300'
              }`}
            >
              <span className="text-xl shrink-0">📊</span>
              <div>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  แดชบอร์ด (Dashboard)
                </span>
                <p className="text-xs text-slate-400 dark:text-zinc-500">
                  ภาพรวมการส่งมอบ งานซ่อม และสถิติ
                </p>
              </div>
            </Link>

            {/* Direct Link: Monitor */}
            <Link
              href="/monitor"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 p-2.5 rounded-xl transition-all ${
                isMonitorActive
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/20'
                  : 'hover:bg-slate-50 dark:hover:bg-zinc-800/60 text-slate-700 dark:text-zinc-300'
              }`}
            >
              <span className="text-xl shrink-0">🛡️</span>
              <div>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  มอนิเตอร์ (ประกัน/ภาษี)
                </span>
                <p className="text-xs text-slate-400 dark:text-zinc-500">
                  ติดตามสถานะประกัน พ.ร.บ. ภาษีรถ แบบ read-only
                </p>
              </div>
            </Link>

            {/* Direct Link: Replacements */}
            <Link
              href="/replacements"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 p-2.5 rounded-xl transition-all ${
                isReplacementsActive
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/20'
                  : 'hover:bg-slate-50 dark:hover:bg-zinc-800/60 text-slate-700 dark:text-zinc-300'
              }`}
            >
              <span className="text-xl shrink-0">🚗🔄</span>
              <div>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  รถทดแทน (Replacements)
                </span>
                <p className="text-xs text-slate-400 dark:text-zinc-500">
                  ติดตามรถทดแทนใช้งาน คลังรถพร้อมใช้ และโควตาจอง
                </p>
              </div>
            </Link>
          </div>

          {/* Grouped Menus: งานซ่อม, งานประกัน, ส่งมอบ & รับคืน, อื่นๆ */}
          {navGroups.map((group) => (
            <div key={group.id} className="space-y-1.5">
              <div className="flex items-center gap-1.5 px-2 text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                <span>{group.icon}</span>
                <span>{group.label}</span>
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isItemActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-start gap-3 p-2.5 rounded-xl transition-all ${
                        isItemActive
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/20'
                          : 'hover:bg-slate-50 dark:hover:bg-zinc-800/60 text-slate-700 dark:text-zinc-300'
                      }`}
                    >
                      <span className="text-xl shrink-0 mt-0.5">{item.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-slate-900 dark:text-white">
                            {item.name}
                          </span>
                          {item.badge && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[10.5px] text-slate-400 dark:text-zinc-500 line-clamp-1 mt-0.5">
                          {item.desc}
                        </p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </header>
  )
}
