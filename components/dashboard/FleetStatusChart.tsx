'use client'

import React, { useState } from 'react'
import useSWR from 'swr'
import PortfolioStatusTree from '@/components/dashboard/PortfolioStatusTree'
import ViewHierarchyChart from '@/components/dashboard/ViewHierarchyChart'

const fetcher = (url: string) => fetch(url).then(r => r.json())

/**
 * FleetStatusChart — Self-contained container component
 * Fetches all active vehicles from /api/vehicles/status-summary (reusing existing API, no duplicate endpoints)
 * and renders either PortfolioStatusTree or ViewHierarchyChart based on selected view mode.
 */
export default function FleetStatusChart() {
  const [viewMode, setViewMode] = useState<'portfolio' | 'category'>('portfolio')

  const { data, error, isLoading } = useSWR('/api/vehicles/status-summary', fetcher, {
    refreshInterval: 120_000, // refresh every 2 min
  })

  if (isLoading) {
    return (
      <div className="bg-white/80 dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-zinc-800/80 rounded-3xl p-6 shadow-sm backdrop-blur-md animate-pulse">
        <div className="h-5 w-56 bg-zinc-200 dark:bg-zinc-800 rounded-lg mb-4" />
        <div className="h-44 bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl" />
      </div>
    )
  }

  if (error || !data?.items) return null

  return (
    <div className="space-y-3">
      {/* View Switcher Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">มุมมองโครงสร้างรถ:</span>
          <div className="bg-zinc-200/70 dark:bg-zinc-800 p-1 rounded-xl flex gap-1 shadow-inner">
            <button
              type="button"
              onClick={() => setViewMode('portfolio')}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all duration-150 flex items-center gap-1.5 ${
                viewMode === 'portfolio'
                  ? 'bg-white dark:bg-zinc-700 shadow-sm text-indigo-600 dark:text-white'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
              }`}
            >
              <span>🌳</span>
              <span>มุมมองสถานะหลัก (Portfolio)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('category')}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all duration-150 flex items-center gap-1.5 ${
                viewMode === 'category'
                  ? 'bg-white dark:bg-zinc-700 shadow-sm text-indigo-600 dark:text-white'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
              }`}
            >
              <span>📂</span>
              <span>มุมมองตามหมวดหมู่ (Category)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic View Rendering */}
      {viewMode === 'portfolio' ? (
        <PortfolioStatusTree items={data.items} />
      ) : (
        <ViewHierarchyChart items={data.items} />
      )}
    </div>
  )
}
