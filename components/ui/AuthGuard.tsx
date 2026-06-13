'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    let active = true

    const checkAuth = async () => {
      try {
        if (typeof window === 'undefined') return

        const isLocalhost = 
          window.location.hostname === 'localhost' || 
          window.location.hostname === '127.0.0.1'

        if (isLocalhost) {
          // In localhost dev mode, seed a mock profile if not present and auto-login
          const cached = localStorage.getItem('liff_profile')
          if (!cached) {
            localStorage.setItem('liff_profile', JSON.stringify({
              userId: 'usr_mock_dev',
              displayName: 'คุณ เนย (Dev Mode)',
              pictureUrl: '',
              statusMessage: 'Developer Local Testing'
            }))
          }
          if (active) {
            setAuthenticated(true)
            setLoading(false)
          }
          return
        }

        // On production, fetch LIFF config and initialize
        const configRes = await fetch('/api/config')
        if (!configRes.ok) {
          throw new Error('Failed to fetch LIFF config')
        }
        const { liffId } = await configRes.json()
        if (!liffId) {
          throw new Error('LIFF ID is missing')
        }

        const liffModule = await import('@line/liff')
        const liff = liffModule.default

        if (!liff.id) {
          await liff.init({ liffId })
        }

        if (!active) return

        if (liff.isLoggedIn()) {
          // Check friendship status (must add friend first)
          const friendship = await liff.getFriendship()
          if (!friendship.friendFlag) {
            console.log('[AuthGuard] User logged in but not a friend. Redirecting to LIFF page...')
            const currentPath = window.location.pathname + window.location.search
            router.replace(`/liff?path=${encodeURIComponent(currentPath)}`)
            return
          }

          const profile = await liff.getProfile()
          // Update profile cache
          localStorage.setItem('liff_profile', JSON.stringify({
            userId: profile.userId,
            displayName: profile.displayName,
            pictureUrl: profile.pictureUrl,
            statusMessage: profile.statusMessage
          }))
          setAuthenticated(true)
          setLoading(false)
        } else {
          // Redirect to /liff login flow with current path as redirect parameter
          const currentPath = window.location.pathname + window.location.search
          router.replace(`/liff?path=${encodeURIComponent(currentPath)}`)
        }
      } catch (err) {
        console.error('[AuthGuard Error]', err)
        if (active) {
          const currentPath = window.location.pathname + window.location.search
          router.replace(`/liff?path=${encodeURIComponent(currentPath)}`)
        }
      }
    }

    checkAuth()

    return () => {
      active = false
    }
  }, [router])

  if (loading || !authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-emerald-50/30 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-zinc-500 font-medium animate-pulse">กำลังตรวจสอบสิทธิ์เข้าใช้งาน...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
