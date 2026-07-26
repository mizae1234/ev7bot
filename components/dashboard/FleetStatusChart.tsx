'use client'

import React from 'react'
import useSWR from 'swr'
import StatusHierarchyChart from '@/components/audit/StatusHierarchyChart'

const fetcher = (url: string) => fetch(url).then(r => r.json())

/**
 * FleetStatusChart — Self-contained component
 * Fetches all active vehicles from /api/vehicles/status-summary
 * and renders the StatusHierarchyChart tree.
 */
export default function FleetStatusChart() {
  const { data, error, isLoading } = useSWR('/api/vehicles/status-summary', fetcher, {
    refreshInterval: 120_000, // refresh every 2 min
  })

  if (isLoading) {
    return (
      <div className="bg-slate-800/40 border border-slate-800/80 rounded-2xl p-6 shadow-lg backdrop-blur-sm animate-pulse">
        <div className="h-4 w-48 bg-slate-700/50 rounded mb-4" />
        <div className="h-40 bg-slate-700/30 rounded-xl" />
      </div>
    )
  }

  if (error || !data?.items) return null

  return <StatusHierarchyChart items={data.items} />
}
