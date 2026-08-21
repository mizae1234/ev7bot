'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const isCheckingRef = useRef(false)

  useEffect(() => {
    if (isCheckingRef.current) return
    isCheckingRef.current = true

    let active = true

    const checkAuth = async () => {
      try {
        if (typeof window === 'undefined') return

        const hostname = window.location.hostname
        const isLocalOrDev =
          hostname === 'localhost' ||
          hostname === '127.0.0.1' ||
          hostname.endsWith('.local') ||
          hostname.startsWith('192.168.') ||
          hostname.startsWith('10.') ||
          hostname.startsWith('172.') ||
          hostname.includes('ngrok') ||
          hostname.includes('trycloudflare.com')

        // 1. In local / dev mode, seed mock profile if not present and auto-login
        if (isLocalOrDev) {
          const cached = localStorage.getItem('liff_profile')
          if (!cached) {
            localStorage.setItem(
              'liff_profile',
              JSON.stringify({
                userId: 'usr_mock_dev',
                displayName: 'คุณ เนย (Dev Mode)',
                pictureUrl: '',
                statusMessage: 'Developer Local Testing',
              })
            )
          }
          if (active) {
            setAuthenticated(true)
            setLoading(false)
          }
          return
        }

        // 2. Check cached profile in localStorage (instant authorization)
        const cached = localStorage.getItem('liff_profile')
        if (cached) {
          try {
            const parsed = JSON.parse(cached)
            if (parsed && parsed.userId) {
              if (active) {
                setAuthenticated(true)
                setLoading(false)
              }
              return
            }
          } catch {
            // Invalid cache, continue with LIFF check
          }
        }

        // 3. Initialize LIFF with 5-second timeout to prevent infinite hanging
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('การเชื่อมต่อกับ LINE หมดเวลา (Timeout)')), 5000)
        )

        const liffAuthPromise = (async () => {
          const configRes = await fetch('/api/config')
          if (!configRes.ok) {
            throw new Error('ไม่สามารถดึงการตั้งค่า LINE LIFF ได้')
          }
          const { liffId } = await configRes.json()
          if (!liffId) {
            throw new Error('ไม่พบการตั้งค่า LIFF ID')
          }

          const liffModule = await import('@line/liff')
          const liff = liffModule.default

          if (!liff.id) {
            await liff.init({ liffId })
          }

          if (!active) return

          if (liff.isLoggedIn()) {
            // Check friendship status
            try {
              const friendship = await liff.getFriendship()
              if (!friendship.friendFlag) {
                console.log('[AuthGuard] User logged in but not a friend. Redirecting to LIFF page...')
                const currentPath = window.location.pathname + window.location.search
                router.replace(`/liff?path=${encodeURIComponent(currentPath)}`)
                return
              }
            } catch (friendErr) {
              console.warn('[AuthGuard] Friendship check warning:', friendErr)
            }

            const profile = await liff.getProfile()
            localStorage.setItem(
              'liff_profile',
              JSON.stringify({
                userId: profile.userId,
                displayName: profile.displayName,
                pictureUrl: profile.pictureUrl,
                statusMessage: profile.statusMessage,
              })
            )
            if (active) {
              setAuthenticated(true)
              setLoading(false)
            }
          } else {
            // Redirect to /liff login flow
            const currentPath = window.location.pathname + window.location.search
            router.replace(`/liff?path=${encodeURIComponent(currentPath)}`)
          }
        })()

        await Promise.race([liffAuthPromise, timeoutPromise])
      } catch (err: any) {
        console.error('[AuthGuard Error]', err)
        if (active) {
          // If we have cached profile, let user in despite network/liff error
          const fallbackCached = localStorage.getItem('liff_profile')
          if (fallbackCached) {
            try {
              const parsed = JSON.parse(fallbackCached)
              if (parsed && parsed.userId) {
                setAuthenticated(true)
                setLoading(false)
                return
              }
            } catch {}
          }

          setAuthError(err.message || 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์')
          setLoading(false)
        }
      }
    }

    checkAuth()

    return () => {
      active = false
    }
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-emerald-50/30 flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-zinc-600 font-medium animate-pulse">กำลังตรวจสอบสิทธิ์เข้าใช้งาน...</p>
        </div>
      </div>
    )
  }

  if (!authenticated) {
    const currentPath = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/'
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-emerald-50/30 flex items-center justify-center p-4">
        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-200 text-center max-w-md w-full space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center text-2xl mx-auto">
            🔒
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800">จำเป็นต้องเข้าสู่ระบบ</h3>
            <p className="text-xs text-slate-500">
              {authError || 'กรุณาเข้าสู่ระบบผ่าน LINE เพื่อยืนยันสิทธิ์การเข้าใช้งานหน้านี้'}
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={() => router.replace(`/liff?path=${encodeURIComponent(currentPath)}`)}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>🔑 เข้าสู่ระบบผ่าน LINE</span>
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium transition cursor-pointer"
            >
              🔄 ลองใหม่อีกครั้ง
            </button>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
