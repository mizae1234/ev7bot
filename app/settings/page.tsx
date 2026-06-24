'use client'
import React, { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { AuthGuard } from '@/components/ui/AuthGuard'

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface LineGroup {
  id: number
  groupId: string
  groupName: string | null
  groupType: string
  isActive: boolean
  enableReport: boolean
  enableClaimLog: boolean
  createdAt: string
  updatedAt: string
}

function SettingsContent() {
  const { data: groups, error, isLoading } = useSWR<LineGroup[]>('/api/groups', fetcher)
  const [togglingId, setTogglingId] = useState<number | null>(null)

  const toggleReport = async (id: number, currentValue: boolean) => {
    setTogglingId(id)
    try {
      await fetch('/api/groups', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enableReport: !currentValue }),
      })
      mutate('/api/groups')
    } catch (err) {
      console.error('Failed to toggle report:', err)
    } finally {
      setTogglingId(null)
    }
  }

  const toggleClaim = async (id: number, currentValue: boolean) => {
    setTogglingId(id)
    try {
      await fetch('/api/groups', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enableClaimLog: !currentValue }),
      })
      mutate('/api/groups')
    } catch (err) {
      console.error('Failed to toggle claim log:', err)
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-slate-900/70 border-b border-white/10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/dashboard" className="text-slate-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </a>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-amber-300 to-yellow-500 bg-clip-text text-transparent">
                ⚙️ ตั้งค่า Butter
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">จัดการกลุ่ม LINE & รายงานประจำวัน</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Morning Report Section */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-yellow-600/20 border border-amber-500/30 flex items-center justify-center text-lg">
              📋
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">รายงานประจำวัน (Morning Report)</h2>
              <p className="text-sm text-slate-400">เลือกกลุ่มที่จะได้รับรายงานสรุปเมื่อวาน ทุกเช้า 08:30 น.</p>
            </div>
          </div>

          {isLoading && (
            <div className="rounded-2xl bg-slate-800/50 border border-white/10 p-12 text-center">
              <div className="animate-spin inline-block w-8 h-8 border-4 border-slate-600 border-t-amber-400 rounded-full" />
              <p className="text-slate-400 mt-3 text-sm">กำลังโหลดข้อมูลกลุ่ม...</p>
            </div>
          )}

          {error && (
            <div className="rounded-2xl bg-red-900/20 border border-red-500/30 p-6 text-center">
              <p className="text-red-400">❌ ไม่สามารถโหลดข้อมูลกลุ่มได้</p>
            </div>
          )}

          {groups && groups.length === 0 && (
            <div className="rounded-2xl bg-slate-800/50 border border-white/10 p-12 text-center">
              <div className="text-5xl mb-3">🤖</div>
              <h3 className="text-lg font-semibold text-slate-300">ยังไม่มีกลุ่ม LINE</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                เพิ่ม Butter เข้ากลุ่ม LINE แล้วส่งข้อความสักข้อ<br/>
                ระบบจะบันทึกกลุ่มให้อัตโนมัติ แล้วมาตั้งค่าได้ที่นี่ครับ
              </p>
            </div>
          )}

          {groups && groups.length > 0 && (
            <div className="space-y-3">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className={`
                    rounded-2xl border transition-all duration-300
                    ${(group.enableReport || group.enableClaimLog)
                      ? 'bg-gradient-to-r from-slate-900 to-slate-850 border-slate-700/60 shadow-lg shadow-black/10'
                      : 'bg-slate-800/30 border-white/5 hover:border-white/10'
                    }
                  `}
                >
                  <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      {/* Icon */}
                      <div className={`
                        w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0
                        ${group.isActive
                          ? 'bg-green-500/10 border border-green-500/20'
                          : 'bg-slate-700/30 border border-slate-600/20'
                        }
                      `}>
                        {group.groupType === 'group' ? '👥' : '💬'}
                      </div>

                      {/* Info */}
                      <div className="min-w-0">
                        <h3 className="font-semibold text-white truncate text-sm sm:text-base">
                          {group.groupName || 'ไม่ทราบชื่อกลุ่ม'}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-mono text-slate-500 truncate max-w-[150px] sm:max-w-[200px]">
                            {group.groupId}
                          </span>
                          <span className={`
                            inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-md font-semibold
                            ${group.isActive
                              ? 'bg-green-500/10 text-green-400 border border-green-500/10'
                              : 'bg-slate-650/20 text-slate-500 border border-slate-600/10'
                            }
                          `}>
                            {group.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Toggles Container */}
                    <div className="flex items-center gap-6 flex-shrink-0 self-end sm:self-center">
                      {/* Toggle 1: Morning Report */}
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] text-slate-400 mb-1.5 font-bold uppercase tracking-wider">Morning Report</span>
                        <button
                          onClick={() => toggleReport(group.id, group.enableReport)}
                          disabled={togglingId === group.id}
                          className="focus:outline-none"
                        >
                          <div className={`
                            relative w-12 h-6.5 rounded-full transition-all duration-300 cursor-pointer
                            ${group.enableReport
                              ? 'bg-gradient-to-r from-amber-500 to-yellow-500 shadow-md shadow-amber-500/20'
                              : 'bg-slate-700'
                            }
                            ${togglingId === group.id ? 'opacity-50' : ''}
                          `}>
                            <div className={`
                              absolute top-0.5 w-5.5 h-5.5 rounded-full bg-white shadow-md transition-all duration-300
                              ${group.enableReport ? 'left-6' : 'left-0.5'}
                            `} />
                          </div>
                        </button>
                        <span className={`
                          text-[10px] mt-1 font-semibold
                          ${group.enableReport ? 'text-amber-400' : 'text-slate-500'}
                        `}>
                          {group.enableReport ? 'เปิด' : 'ปิด'}
                        </span>
                      </div>

                      {/* Toggle 2: Auto Claim */}
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] text-slate-400 mb-1.5 font-bold uppercase tracking-wider">Auto Claim</span>
                        <button
                          onClick={() => toggleClaim(group.id, group.enableClaimLog)}
                          disabled={togglingId === group.id}
                          className="focus:outline-none"
                        >
                          <div className={`
                            relative w-12 h-6.5 rounded-full transition-all duration-300 cursor-pointer
                            ${group.enableClaimLog
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-md shadow-emerald-500/20'
                              : 'bg-slate-700'
                            }
                            ${togglingId === group.id ? 'opacity-50' : ''}
                          `}>
                            <div className={`
                              absolute top-0.5 w-5.5 h-5.5 rounded-full bg-white shadow-md transition-all duration-300
                              ${group.enableClaimLog ? 'left-6' : 'left-0.5'}
                            `} />
                          </div>
                        </button>
                        <span className={`
                          text-[10px] mt-1 font-semibold
                          ${group.enableClaimLog ? 'text-emerald-400' : 'text-slate-500'}
                        `}>
                          {group.enableClaimLog ? 'เปิด' : 'ปิด'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Summary */}
              <div className="mt-4 p-4 rounded-xl bg-slate-800/30 border border-white/5">
                <p className="text-sm text-slate-400">
                  📊 รวม {groups.length} กลุ่ม —
                  <span className="text-amber-400 font-medium"> {groups.filter(g => g.enableReport).length} กลุ่ม</span> ได้รับรายงานประจำวัน | 
                  <span className="text-emerald-400 font-medium"> {groups.filter(g => g.enableClaimLog).length} กลุ่ม</span> เปิดตรวจจับเคลม
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Info Card */}
        <section className="rounded-2xl bg-indigo-500/10 border border-indigo-500/20 p-6">
          <h3 className="font-semibold text-indigo-300 mb-2">💡 วิธีใช้งาน</h3>
          <ul className="text-sm text-slate-400 space-y-1.5">
            <li>1️⃣ เพิ่ม <span className="text-amber-300 font-medium">Butter</span> เข้ากลุ่ม LINE ที่ต้องการ</li>
            <li>2️⃣ พิมพ์ข้อความอะไรก็ได้ในกลุ่ม (เช่น "butter สวัสดี") — กลุ่มจะถูกบันทึกอัตโนมัติ</li>
            <li>3️⃣ กลับมาหน้านี้แล้ว <span className="text-amber-300 font-medium">เปิดสวิตช์</span> ให้กลุ่มที่ต้องการรับรายงาน</li>
            <li>4️⃣ Butter จะส่ง <span className="text-amber-300 font-medium">รายงานสรุปเมื่อวาน</span> ไปทุกเช้า 08:30 น. 🧈</li>
          </ul>
        </section>
      </main>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <AuthGuard>
      <SettingsContent />
    </AuthGuard>
  )
}
