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
  isLive?: boolean
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    id: 'dashboards',
    label: 'แดชบอร์ด',
    icon: '📊',
    items: [
      {
        name: 'ภาพรวมการดำเนินงาน',
        href: '/dashboard',
        desc: 'แดชบอร์ดสรุปยอดส่งมอบ งานซ่อม และสถิติประจำวัน',
        icon: '📈'
      },
      {
        name: 'ศูนย์จัดการงานซ่อม (Kanban)',
        href: '/maintenance',
        desc: 'ติดตามงานซ่อมตามศูนย์บริการ/อู่ และสถานะเคส',
        icon: '📋'
      }
    ]
  },
  {
    id: 'monitors',
    label: 'ระบบมอนิเตอร์',
    icon: '📡',
    isLive: true,
    items: [
      {
        name: 'มอนิเตอร์รถทดแทน (Replacements)',
        href: '/replacements',
        desc: 'ติดตามรถทดแทนใช้งาน คลังรถพร้อมใช้ โควตาจอง และรถเข้าซ่อม',
        icon: '🚗🔄',
        badge: 'Live'
      },
      {
        name: 'มอนิเตอร์ประกันภัย & ภาษี (Policies)',
        href: '/policies',
        desc: 'ตรวจสอบความคุ้มครอง วันหมดอายุประกัน/พ.ร.บ./ภาษี และเอกสาร PDF',
        icon: '📑',
        badge: 'Live'
      },
      {
        name: 'มอนิเตอร์รับมอบ & อายัดรถ (Custody)',
        href: '/custody',
        desc: 'ติดตามสถานะอายัดรถและการส่งมอบทรัพย์สิน',
        icon: '🔑'
      },
      {
        name: 'มอนิเตอร์ตรวจสภาพรถ (Audit)',
        href: '/audit',
        desc: 'ระบบตรวจนับและ Audit สภาพรถยนต์',
        icon: '🔍'
      },
      {
        name: 'ประวัติการเคลมประกัน (Claim Logs)',
        href: '/claim-logs',
        desc: 'บันทึกประวัติการเปิดเคลมและสถานะเคลมประกัน',
        icon: '🛡️'
      }
    ]
  },
  {
    id: 'fleet',
    label: 'กองรถ & อะไหล่',
    icon: '🚘',
    items: [
      {
        name: 'ข้อมูลยานพาหนะ (Vehicles)',
        href: '/vehicle',
        desc: 'ค้นหาและตรวจสอบข้อมูลรถยนต์ ทะเบียน และสถานะ',
        icon: '🚘'
      },
      {
        name: 'บันทึกหมายเหตุรถ (Vehicle Notes)',
        href: '/vehicle-notes',
        desc: 'บันทึกประวัติและโน้ตสำคัญประจำคันรถ',
        icon: '📝'
      },
      {
        name: 'ระบบเบิกจ่ายอะไหล่ (Spare Parts)',
        href: '/spare-parts',
        desc: 'คลังอะไหล่และการเบิกจ่ายอะไหล่ซ่อมบำรุง',
        icon: '📦'
      },
      {
        name: 'งานส่งมอบรถยนต์ (Delivery Cases)',
        href: '/case-delivery',
        desc: 'จัดการเคสและการส่งมอบรถให้ลูกค้า',
        icon: '🚚'
      }
    ]
  }
]

export function Navbar() {
  const pathname = usePathname()
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Don't render navbar on LIFF mobile views
  if (pathname && pathname.startsWith('/liff')) {
    return null
  }

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

  const isGroupActive = (group: NavGroup) => {
    return group.items.some((item) => pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href)))
  }

  return (
    <header className="sticky top-0 z-50 w-full bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800 shadow-xs transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* 1. Brand Logo */}
          <div className="flex items-center gap-8">
            <Link
              href="/dashboard"
              className="flex items-center gap-2.5 group transition-transform active:scale-98"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:shadow-indigo-500/30 transition-all">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base sm:text-lg tracking-tight bg-gradient-to-r from-zinc-900 via-indigo-950 to-zinc-900 dark:from-white dark:via-zinc-100 dark:to-zinc-300 bg-clip-text text-transparent">
                    EV7 Operations
                  </span>
                </div>
                <span className="text-[10px] text-zinc-400 font-medium tracking-tight">
                  Fleet & Maintenance Tracking
                </span>
              </div>
            </Link>

            {/* 2. Desktop Navigation Groups */}
            <nav ref={dropdownRef} className="hidden md:flex items-center gap-1.5">
              {navGroups.map((group) => {
                const active = isGroupActive(group)
                const isOpen = openDropdown === group.id

                return (
                  <div key={group.id} className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(isOpen ? null : group.id)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        active
                          ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/80'
                          : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                    >
                      <span>{group.icon}</span>
                      <span>{group.label}</span>
                      {group.isLive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      )}
                      <svg
                        className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${
                          isOpen ? 'rotate-180 text-indigo-500' : ''
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Dropdown Menu */}
                    {isOpen && (
                      <div className="absolute left-0 mt-2 w-80 rounded-2xl bg-white dark:bg-zinc-900 shadow-xl border border-zinc-200/80 dark:border-zinc-800 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                        <div className="px-3 py-1.5 mb-1 text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
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
                                    ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold'
                                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300'
                                }`}
                              >
                                <span className="text-xl shrink-0 mt-0.5">{item.icon}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-semibold truncate text-zinc-900 dark:text-white">
                                      {item.name}
                                    </span>
                                    {item.badge && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                        {item.badge}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10.5px] text-zinc-400 dark:text-zinc-500 line-clamp-1 mt-0.5">
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

              {/* Direct Link: Log Chats */}
              <Link
                href="/logchats"
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  pathname.startsWith('/logchats') || pathname.startsWith('/chat')
                    ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/80'
                    : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                <span>💬</span>
                <span>แชต & Log</span>
              </Link>
            </nav>
          </div>

          {/* 3. Right Side Actions & Profile */}
          <div className="flex items-center gap-3">
            <LoginProfile />

            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors"
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
        <div className="md:hidden border-t border-zinc-200/80 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl px-4 py-4 max-h-[85vh] overflow-y-auto space-y-4 shadow-xl">
          {navGroups.map((group) => (
            <div key={group.id} className="space-y-1.5">
              <div className="flex items-center gap-1.5 px-2 text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                <span>{group.icon}</span>
                <span>{group.label}</span>
                {group.isLive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-1" />
                )}
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
                          ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-500/20'
                          : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      <span className="text-xl shrink-0 mt-0.5">{item.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-zinc-900 dark:text-white">
                            {item.name}
                          </span>
                          {item.badge && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[10.5px] text-zinc-400 dark:text-zinc-500 line-clamp-1 mt-0.5">
                          {item.desc}
                        </p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Direct Link: Log Chats in Mobile */}
          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <Link
              href="/logchats"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 p-2.5 rounded-xl transition-all ${
                pathname.startsWith('/logchats') || pathname.startsWith('/chat')
                  ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-500/20'
                  : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              <span className="text-xl shrink-0">💬</span>
              <div>
                <span className="text-xs font-semibold text-zinc-900 dark:text-white">
                  บันทึกการสื่อสาร & LINE Logs
                </span>
                <p className="text-[10.5px] text-zinc-400 dark:text-zinc-500">
                  ประวัติการสนทนาและการแจ้งเตือนระบบ
                </p>
              </div>
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
