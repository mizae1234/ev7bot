'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function LiffContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFriend, setIsFriend] = useState<boolean>(true)

  useEffect(() => {
    let active = true

    const initLiff = async () => {
      try {
        const liffModule = await import('@line/liff')
        const liff = liffModule.default
        const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID

        if (!liffId) {
          throw new Error('NEXT_PUBLIC_LINE_LIFF_ID is not configured in .env')
        }

        console.log('[LIFF] Initializing with ID:', liffId)
        await liff.init({ liffId })

        if (!active) return

        // Authenticate
        if (!liff.isLoggedIn()) {
          console.log('[LIFF] User not logged in, redirecting to login...')
          liff.login({ redirectUri: window.location.href })
          return
        }

        // Check Friendship Status
        console.log('[LIFF] Checking friendship status...')
        const friendship = await liff.getFriendship()
        if (!friendship.friendFlag) {
          console.log('[LIFF] User has not added OA as friend')
          setIsFriend(false)
          setLoading(false)
          return
        }

        // Get Profile details
        console.log('[LIFF] Fetching profile...')
        const profile = await liff.getProfile()

        // Register in PostgreSQL
        console.log('[LIFF] Registering profile in DB...')
        const res = await fetch('/api/liff/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: profile.userId,
            displayName: profile.displayName,
            pictureUrl: profile.pictureUrl,
            statusMessage: profile.statusMessage,
          }),
        })

        if (!res.ok) {
          console.warn('[LIFF] Registration in PostgreSQL failed, but proceeding...')
        }

        // Redirect to target path
        const redirectPath = searchParams.get('path') || '/dashboard'
        console.log('[LIFF] Registration complete. Redirecting to:', redirectPath)
        router.replace(redirectPath)
      } catch (err) {
        console.error('[LIFF Error]', err)
        if (active) {
          setError(err instanceof Error ? err.message : String(err))
          setLoading(false)
        }
      }
    }

    initLiff()

    return () => {
      active = false
    }
  }, [router, searchParams])

  const handleClose = async () => {
    try {
      const liffModule = await import('@line/liff')
      const liff = liffModule.default
      if (liff.isInClient()) {
        liff.closeWindow()
      } else {
        window.close()
      }
    } catch (err) {
      console.error('Failed to close window:', err)
    }
  }

  if (loading) {
    return (
      <div className="text-center space-y-4">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-zinc-500 font-medium animate-pulse">กำลังตรวจสอบสิทธิ์ผ่าน LINE...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center space-y-4 max-w-sm px-4">
        <div className="text-5xl">⚠️</div>
        <h2 className="text-lg font-bold text-zinc-800">เกิดข้อผิดพลาดในการเชื่อมต่อ</h2>
        <p className="text-sm text-zinc-500 bg-red-50 p-3 rounded-xl border border-red-100 font-mono text-left break-all text-xs">
          {error}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm shadow-sm"
        >
          ลองใหม่อีกครั้ง
        </button>
      </div>
    )
  }

  if (!isFriend) {
    return (
      <div className="text-center space-y-4 max-w-sm px-6">
        <div className="text-5xl">🧈🤖</div>
        <h2 className="text-lg font-bold text-zinc-800">กรุณาเพิ่มเพื่อนก่อนใช้งาน</h2>
        <p className="text-sm text-zinc-500">
          เพื่อเข้าถึงข้อมูลรายละเอียดรถกรุณาแอดไลน์และเพิ่มเพื่อนบอท **Butter** ใน LINE ก่อนนะคะ 💛
        </p>
        <div className="pt-2">
          <button
            onClick={handleClose}
            className="w-full bg-zinc-800 hover:bg-zinc-900 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm shadow-sm"
          >
            ตกลง (ปิดหน้าจอนี้)
          </button>
        </div>
      </div>
    )
  }

  return null
}

export default function LiffPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-emerald-50/30 flex items-center justify-center">
      <Suspense fallback={
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-zinc-500 font-medium">กำลังเตรียมโหลดข้อมูล...</p>
        </div>
      }>
        <LiffContent />
      </Suspense>
    </div>
  )
}
