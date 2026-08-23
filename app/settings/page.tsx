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
  enableGateLog: boolean
  enableChat: boolean
  createdAt: string
  updatedAt: string
}

function SettingsContent() {
  const { data: groups, error, isLoading } = useSWR<LineGroup[]>('/api/groups', fetcher)
  const [togglingId, setTogglingId] = useState<number | null>(null)

  const toggleField = async (id: number, field: string, currentValue: boolean) => {
    setTogglingId(id)
    try {
      await fetch('/api/groups', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, [field]: !currentValue }),
      })
      mutate('/api/groups')
    } catch (err) {
      console.error(`Failed to toggle ${field}:`, err)
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
              <p className="text-xs text-slate-400 mt-0.5">จัดการกลุ่ม LINE & ตั้งค่าระบบ</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Loading / Error */}
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

        {/* Group List */}
        {groups && groups.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-yellow-600/20 border border-amber-500/30 flex items-center justify-center text-lg">
                📋
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">ตั้งค่ากลุ่ม LINE</h2>
                <p className="text-sm text-slate-400">เปิด/ปิดฟีเจอร์ต่างๆ ในแต่ละกลุ่ม</p>
              </div>
            </div>

            <div className="space-y-3">
              {groups.map((group) => {
                const hasAnyFeature = group.enableReport || group.enableClaimLog || group.enableGateLog
                return (
                  <div
                    key={group.id}
                    className={`
                      rounded-2xl border transition-all duration-300
                      ${hasAnyFeature
                        ? 'bg-gradient-to-r from-slate-900 to-slate-850 border-slate-700/60 shadow-lg shadow-black/10'
                        : 'bg-slate-800/30 border-white/5 hover:border-white/10'
                      }
                    `}
                  >
                    <div className="p-5">
                      {/* Group Info Row */}
                      <div className="flex items-center gap-4 mb-4">
                        <div className={`
                          w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0
                          ${group.isActive
                            ? 'bg-green-500/10 border border-green-500/20'
                            : 'bg-slate-700/30 border border-slate-600/20'
                          }
                        `}>
                          {group.groupType === 'group' ? '👥' : '💬'}
                        </div>
                        <div className="min-w-0 flex-1">
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

                      {/* Toggles Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {/* Toggle: Butter Chat */}
                        <ToggleCard
                          label="Butter Chat"
                          description="ตอบคำถาม"
                          enabled={group.enableChat}
                          color="blue"
                          icon="💬"
                          loading={togglingId === group.id}
                          onToggle={() => toggleField(group.id, 'enableChat', group.enableChat)}
                        />

                        {/* Toggle: Morning Report */}
                        <ToggleCard
                          label="Morning Report"
                          description="รายงานเช้า"
                          enabled={group.enableReport}
                          color="amber"
                          icon="📊"
                          loading={togglingId === group.id}
                          onToggle={() => toggleField(group.id, 'enableReport', group.enableReport)}
                        />

                        {/* Toggle: Auto Claim */}
                        <ToggleCard
                          label="Auto Claim"
                          description="ตรวจจับเคลม"
                          enabled={group.enableClaimLog}
                          color="emerald"
                          icon="🛠️"
                          loading={togglingId === group.id}
                          onToggle={() => toggleField(group.id, 'enableClaimLog', group.enableClaimLog)}
                        />

                        {/* Toggle: Gate Log */}
                        <ToggleCard
                          label="Gate Log"
                          description="บันทึกเข้า-ออก"
                          enabled={group.enableGateLog}
                          color="purple"
                          icon="🚗"
                          loading={togglingId === group.id}
                          onToggle={() => toggleField(group.id, 'enableGateLog', group.enableGateLog)}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Summary */}
              <div className="mt-4 p-4 rounded-xl bg-slate-800/30 border border-white/5">
                <p className="text-sm text-slate-400">
                  📊 รวม {groups.length} กลุ่ม —{' '}
                  <span className="text-blue-400 font-medium">{groups.filter(g => g.enableChat).length}</span> เปิดแชท |{' '}
                  <span className="text-amber-400 font-medium">{groups.filter(g => g.enableReport).length}</span> รายงานเช้า |{' '}
                  <span className="text-emerald-400 font-medium">{groups.filter(g => g.enableClaimLog).length}</span> ตรวจจับเคลม |{' '}
                  <span className="text-purple-400 font-medium">{groups.filter(g => g.enableGateLog).length}</span> บันทึกเข้า-ออก
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Info Card */}
        <section className="rounded-2xl bg-indigo-500/10 border border-indigo-500/20 p-6">
          <h3 className="font-semibold text-indigo-300 mb-3">💡 คำอธิบายแต่ละฟีเจอร์</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-400">
            <div className="flex gap-2">
              <span className="text-blue-400">💬</span>
              <div>
                <span className="text-blue-300 font-medium">Butter Chat</span> — ให้ Butter ตอบคำถามในกลุ่ม (ต้องเรียก &quot;butter&quot; ก่อน)
              </div>
            </div>
            <div className="flex gap-2">
              <span className="text-amber-400">📊</span>
              <div>
                <span className="text-amber-300 font-medium">Morning Report</span> — ส่งรายงานสรุปเมื่อวานทุกเช้า 08:30 น.
              </div>
            </div>
            <div className="flex gap-2">
              <span className="text-emerald-400">🛠️</span>
              <div>
                <span className="text-emerald-300 font-medium">Auto Claim</span> — ตรวจจับข้อความแจ้งซ่อมแล้วบันทึกลง Claim Log อัตโนมัติ
              </div>
            </div>
            <div className="flex gap-2">
              <span className="text-purple-400">🚗</span>
              <div>
                <span className="text-purple-300 font-medium">Gate Log</span> — ตรวจจับข้อความรถเข้า-ออกลานแล้วบันทึกอัตโนมัติ
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

// ─── Toggle Card Component ───────────────────────────────────
const colorMap: Record<string, { on: string; text: string; shadow: string; border: string }> = {
  blue:    { on: 'from-blue-500 to-cyan-500',     text: 'text-blue-400',    shadow: 'shadow-blue-500/20',    border: 'border-blue-500/20' },
  amber:   { on: 'from-amber-500 to-yellow-500',  text: 'text-amber-400',   shadow: 'shadow-amber-500/20',   border: 'border-amber-500/20' },
  emerald: { on: 'from-emerald-500 to-teal-500',  text: 'text-emerald-400', shadow: 'shadow-emerald-500/20', border: 'border-emerald-500/20' },
  purple:  { on: 'from-purple-500 to-violet-500', text: 'text-purple-400',  shadow: 'shadow-purple-500/20',  border: 'border-purple-500/20' },
}

function ToggleCard({ label, description, enabled, color, icon, loading, onToggle }: {
  label: string
  description: string
  enabled: boolean
  color: string
  icon: string
  loading: boolean
  onToggle: () => void
}) {
  const c = colorMap[color] || colorMap.blue
  return (
    <div className={`
      rounded-xl p-3 border transition-all duration-300
      ${enabled
        ? `bg-slate-800/60 ${c.border}`
        : 'bg-slate-800/20 border-white/5'
      }
    `}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-lg">{icon}</span>
        <button
          onClick={onToggle}
          disabled={loading}
          className="focus:outline-none"
        >
          <div className={`
            relative w-10 h-5.5 rounded-full transition-all duration-300 cursor-pointer
            ${enabled
              ? `bg-gradient-to-r ${c.on} shadow-md ${c.shadow}`
              : 'bg-slate-700'
            }
            ${loading ? 'opacity-50' : ''}
          `}
          style={{ height: '22px' }}
          >
            <div className={`
              absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-md transition-all duration-300
              ${enabled ? 'translate-x-[18px]' : 'translate-x-0'}
            `} />
          </div>
        </button>
      </div>
      <div className="text-[11px] font-bold text-slate-300 leading-tight">{label}</div>
      <div className={`text-[10px] mt-0.5 font-medium ${enabled ? c.text : 'text-slate-500'}`}>
        {enabled ? 'เปิด' : 'ปิด'} · {description}
      </div>
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
