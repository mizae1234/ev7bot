'use client'

import { useEffect, useState } from 'react'

interface LiffProfile {
  userId: string
  displayName: string
  pictureUrl?: string
  statusMessage?: string
}

export function LoginProfile() {
  const [profile, setProfile] = useState<LiffProfile | null>(null)

  useEffect(() => {
    // 1. Try reading from localStorage first for instant display
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('liff_profile')
      if (cached) {
        try {
          setProfile(JSON.parse(cached))
        } catch (e) {
          console.error('Failed to parse cached profile', e)
        }
      }
    }

    // 2. Async LIFF initialization to verify/refresh profile
    let active = true
    const initAndFetch = async () => {
      try {
        const configRes = await fetch('/api/config')
        if (!configRes.ok) return
        const { liffId } = await configRes.json()
        if (!liffId) return

        const liffModule = await import('@line/liff')
        const liff = liffModule.default

        // Only init if not already initialized
        if (!liff.id) {
          await liff.init({ liffId })
        }

        if (!active) return

        if (liff.isLoggedIn()) {
          const freshProfile = await liff.getProfile()
          const profileData: LiffProfile = {
            userId: freshProfile.userId,
            displayName: freshProfile.displayName,
            pictureUrl: freshProfile.pictureUrl,
            statusMessage: freshProfile.statusMessage,
          }
          setProfile(profileData)
          if (typeof window !== 'undefined') {
            localStorage.setItem('liff_profile', JSON.stringify(profileData))
          }
        }
      } catch (err) {
        console.error('[LIFF LoginProfile Error]', err)
      }
    }

    initAndFetch()

    return () => {
      active = false
    }
  }, [])

  if (!profile) {
    const isLocalhost = typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1'
    )

    if (isLocalhost) {
      return (
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20 shadow-sm backdrop-blur-sm">
          <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-600 dark:bg-amber-500/30 dark:text-amber-400 flex items-center justify-center text-xs font-bold">
            🧈
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[11px] font-bold text-zinc-850 dark:text-zinc-200 leading-tight">
              คุณ เนย (Dev Mode)
            </span>
            <span className="text-[9px] text-amber-600 dark:text-amber-500 font-bold leading-none mt-0.5">
              Local Test
            </span>
          </div>
        </div>
      )
    }

    return (
      <a
        href={`/liff?path=${typeof window !== 'undefined' ? encodeURIComponent(window.location.pathname) : '/dashboard'}`}
        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold py-1.5 px-3 rounded-xl shadow-sm transition-all duration-200"
      >
        🟢 เข้าสู่ระบบ LINE
      </a>
    )
  }

  return (
    <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-white/85 dark:bg-zinc-900/95 border border-zinc-200/50 dark:border-zinc-800 shadow-sm backdrop-blur-sm">
      {profile.pictureUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.pictureUrl}
          alt={profile.displayName}
          className="w-6 h-6 rounded-full border border-emerald-500/30 object-cover"
        />
      ) : (
        <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center justify-center text-[10px] font-bold">
          {(() => {
            const clean = profile.displayName.trim().replace(/^คุณ\s+/, '')
            return clean.slice(0, 2).toUpperCase()
          })()}
        </div>
      )}
      <div className="flex flex-col text-left">
        <span className="text-[11px] font-bold text-zinc-850 dark:text-zinc-200 leading-tight">
          {profile.displayName}
        </span>
        <span className="text-[9px] text-zinc-400 dark:text-zinc-500 leading-none">
          LINE User
        </span>
      </div>
    </div>
  )
}
