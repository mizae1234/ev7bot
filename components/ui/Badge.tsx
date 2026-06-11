import React from 'react'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'success' | 'warning' | 'info' | 'danger' | 'default'
  className?: string
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  const baseStyles = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wider transition-all duration-200'
  
  const variants = {
    default: 'bg-zinc-100 text-zinc-800 border border-zinc-200 dark:bg-zinc-800/50 dark:text-zinc-300 dark:border-zinc-700',
    success: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30',
    warning: 'bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30',
    info: 'bg-sky-500/10 text-sky-600 border border-sky-500/20 dark:bg-sky-500/20 dark:text-sky-400 dark:border-sky-500/30',
    danger: 'bg-rose-500/10 text-rose-600 border border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/30',
  }

  return (
    <span className={`${baseStyles} ${variants[variant]} ${className}`}>
      {children}
    </span>
  )
}
