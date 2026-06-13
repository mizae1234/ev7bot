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

  if (!profile) return null

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
        <div className="w-6 h-6 rounded-full bg-emerald-550/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center justify-center text-[10px] font-bold">
          {profile.displayName.slice(0, 2).toUpperCase()}
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
