'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function RegisterContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [activeTab, setActiveTab] = useState<'link' | 'create'>('link')
  const [lineProfile, setLineProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fields for Linking
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Fields for Registration
  const [regFirstName, setRegFirstName] = useState('')
  const [regLastName, setRegLastName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')

  useEffect(() => {
    // Get profile from localStorage
    const cachedProfile = localStorage.getItem('liff_profile')
    if (cachedProfile) {
      try {
        setLineProfile(JSON.parse(cachedProfile))
      } catch (e) {
        console.error('Failed to parse cached profile', e)
      }
    }
    setLoading(false)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lineProfile?.userId) {
      alert('ไม่พบ LINE User ID กรุณาเปิดใช้งานผ่าน LINE Application')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const payload: any = {
        action: activeTab,
        userId: lineProfile.userId,
        displayName: lineProfile.displayName,
      }

      if (activeTab === 'link') {
        payload.email = email
        payload.password = password
      } else {
        payload.firstName = regFirstName
        payload.lastName = regLastName
        payload.email = regEmail
        payload.password = regPassword
      }

      const res = await fetch('/api/liff/associate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'เกิดข้อผิดพลาดในการลงทะเบียน')
      }

      alert(data.message)
      
      // Update local profile cache with registered state
      localStorage.setItem('liff_profile', JSON.stringify({
        ...lineProfile,
        ev7UserId: data.registration.ev7UserId
      }))

      // Redirect to original page
      const redirectPath = searchParams.get('path') || '/dashboard'
      router.replace(redirectPath)

    } catch (err: any) {
      setError(err.message || 'บันทึกข้อมูลล้มเหลว')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-slate-500 font-medium">กำลังเตรียมโหลดข้อมูล...</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md px-4 py-8 animate-fade-in">
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 border border-slate-200/50 shadow-xl space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="text-4xl">🔧🤖</div>
          <h1 className="text-xl font-black text-slate-800">ตั้งค่าสิทธิ์เข้าใช้งานระบบ</h1>
          <p className="text-xs text-slate-500">
            สวัสดีค่ะคุณ <strong>{lineProfile?.displayName || 'ผู้ใช้งาน LINE'}</strong> เพื่อสิทธิ์การอ้างอิงข้อมูลลงระบบอย่างถูกต้อง กรุณาลงทะเบียนหรือผูกบัญชีเดิมของระบบ EV7Tracking ก่อนเข้าใช้งานนะคะ
          </p>
        </div>

        {/* LINE Profile Preview */}
        {lineProfile && (
          <div className="flex items-center gap-3 bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
            {lineProfile.pictureUrl && (
              <img
                src={lineProfile.pictureUrl}
                alt="LINE Profile"
                className="w-10 h-10 rounded-full border border-slate-200"
              />
            )}
            <div className="text-left">
              <p className="text-xs text-slate-400 font-medium">โปรไฟล์ LINE</p>
              <p className="text-sm font-bold text-slate-700">{lineProfile.displayName}</p>
            </div>
          </div>
        )}

        {/* Navigation Tabs (Commented out - only Link Account is allowed) */}
        {/* 
        <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl border border-slate-200/40">
          <button
            type="button"
            onClick={() => {
              setActiveTab('link')
              setError(null)
            }}
            className={`py-2.5 text-xs font-bold rounded-xl transition-all duration-150 ${activeTab === 'link' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            🔗 ผูกบัญชีเดิมที่มีอยู่
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('create')
              setError(null)
            }}
            className={`py-2.5 text-xs font-bold rounded-xl transition-all duration-150 ${activeTab === 'create' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            👤 ลงทะเบียนพนักงานใหม่
          </button>
        </div>
        */}

        {/* Warning Banner for Contacting Admin */}
        <div className="bg-amber-50/80 border border-amber-200/60 rounded-2xl p-4 text-left space-y-1">
          <div className="flex items-center gap-2 text-amber-800 font-bold text-xs">
            <span>⚠️</span>
            <span>ประกาศสำคัญ</span>
          </div>
          <p className="text-xs text-amber-800 leading-relaxed font-medium">
            ระบบได้ปิดฟังก์ชันลงทะเบียนผู้ใช้ใหม่ หากท่านยังไม่มีบัญชีในระบบ <strong>EV7Tracking</strong> กรุณาติดต่อผู้ดูแลระบบ (Admin) เพื่อทำการเพิ่มผู้ใช้งานให้นะคะ
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold p-3 rounded-2xl animate-shake">
            ⚠️ {error}
          </div>
        )}

        {/* Forms */}
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          {activeTab === 'link' ? (
            // --- LINK EXISTING ACCOUNT FORM ---
            <div className="space-y-3.5">
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">อีเมลผู้ใช้งานระบบ (User Email)</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="เช่น employee@company.com"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3 text-sm text-slate-800 focus:outline-none transition"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">รหัสผ่าน (User Password)</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="รหัสผ่านในระบบ EV7"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3 text-sm text-slate-800 focus:outline-none transition"
                />
              </div>
            </div>
          ) : (
            // --- NEW REGISTRATION FORM ---
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">ชื่อจริง</label>
                  <input
                    type="text"
                    required
                    value={regFirstName}
                    onChange={(e) => setRegFirstName(e.target.value)}
                    placeholder="ภาษาไทย/อังกฤษ"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3 text-xs text-slate-800 focus:outline-none transition"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">นามสกุล</label>
                  <input
                    type="text"
                    required
                    value={regLastName}
                    onChange={(e) => setRegLastName(e.target.value)}
                    placeholder="ภาษาไทย/อังกฤษ"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3 text-xs text-slate-800 focus:outline-none transition"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">อีเมลพนักงาน (เพื่อล็อกอินและแจ้งเตือน)</label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="เช่น name@company.com"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3 text-xs text-slate-800 focus:outline-none transition"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">กำหนดรหัสผ่านใหม่</label>
                <input
                  type="password"
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3 text-xs text-slate-800 focus:outline-none transition"
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:from-slate-450 disabled:to-slate-500 text-white font-bold py-4 rounded-2xl shadow-lg transition active:scale-[0.98]"
          >
            {submitting ? '⏳ กำลังบันทึกข้อมูล...' : activeTab === 'link' ? '🔗 ยืนยันการผูกบัญชีเดิม' : '✅ ลงทะเบียนและเริ่มใช้งาน'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function LiffRegisterPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-slate-100 flex items-center justify-center p-4">
      <Suspense fallback={
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500 font-medium">กำลังเตรียมโหลดข้อมูล...</p>
        </div>
      }>
        <RegisterContent />
      </Suspense>
    </div>
  )
}
