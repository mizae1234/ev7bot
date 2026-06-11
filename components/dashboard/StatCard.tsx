import React from 'react'

interface StatCardProps {
  title: string
  value: number
  subValue?: { label: string; count: number | string; color: string }[]
  icon?: React.ReactNode
}

export function StatCard({ title, value, subValue, icon }: StatCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-md dark:border-zinc-800/80 dark:bg-zinc-900/60">
      {/* Background gradient blob for dynamic look */}
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-indigo-500/5 blur-2xl transition-all duration-500 group-hover:scale-150 dark:bg-indigo-500/10" />
      
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold tracking-wide text-zinc-500 dark:text-zinc-400 uppercase">{title}</p>
          <p className="mt-2 text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 transition-colors duration-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
            {value}
          </p>
        </div>
        {icon && (
          <div className="rounded-xl bg-zinc-50 p-2.5 text-zinc-600 shadow-inner dark:bg-zinc-850 dark:text-zinc-400">
            {icon}
          </div>
        )}
      </div>

      {subValue && subValue.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {subValue.map((s) => (
            <span
              key={s.label}
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-sm transition-all duration-200 hover:scale-105 ${s.color}`}
            >
              {s.label}: {s.count}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
