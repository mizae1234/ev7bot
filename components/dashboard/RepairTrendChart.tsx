'use client'
import React, { useState, useEffect } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts'
import type { TrendDataPoint } from '@/types'

interface RepairTrendChartProps {
  data: TrendDataPoint[]
}

interface CustomTooltipPayloadItem {
  name: string
  value: number
  dataKey: string
  fill: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: CustomTooltipPayloadItem[]
  label?: string
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white/95 p-3 shadow-md backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95">
        <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mb-1.5">{label}</p>
        {payload.map((p) => {
          const color = p.dataKey === 'repairsReported' ? '#f97316' : '#10b981'
          return (
            <div key={p.name} className="flex items-center gap-2 text-xs py-0.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-zinc-500 dark:text-zinc-400">{p.name}:</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100 ml-auto">{p.value} รายการ</span>
            </div>
          )
        })}
      </div>
    )
  }
  return null
}

export function RepairTrendChart({ data }: RepairTrendChartProps) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return (
      <div className="h-96 w-full rounded-2xl border border-zinc-200/80 bg-white/50 dark:border-zinc-800/80 dark:bg-zinc-900/40 animate-pulse" />
    )
  }

  // Format dates for friendly display (monthly view, e.g., "มิ.ย.")
  const formattedData = data.map((item) => {
    try {
      const date = new Date(item.date)
      const options: Intl.DateTimeFormatOptions = { month: 'short' }
      return {
        ...item,
        formattedDate: date.toLocaleDateString('th-TH', options),
      }
    } catch {
      return {
        ...item,
        formattedDate: item.date,
      }
    }
  })

  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-900/60">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">รายเดือน แจ้งซ่อม / ปิดงาน</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">เปรียบเทียบการแจ้งซ่อมและซ่อมเสร็จในแต่ละเดือน</p>
        </div>
        <div className="text-xs text-zinc-400 dark:text-zinc-500 italic bg-zinc-100 dark:bg-zinc-800/50 px-2.5 py-1 rounded-lg border border-zinc-200/50 dark:border-zinc-800/30">
          * นับตามจำนวนรายการสั่งซ่อมที่บันทึกเข้ามาในระบบ
        </div>
      </div>

      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={formattedData}
            margin={{ top: 10, right: 5, left: -25, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorReported" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#f97316" stopOpacity={0.15}/>
              </linearGradient>
              <linearGradient id="colorClosed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.15}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" className="dark:stroke-zinc-850" />
            <XAxis
              dataKey="formattedDate"
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#888888', fontSize: 11, fontWeight: 500 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#888888', fontSize: 11, fontWeight: 500 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              height={36}
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, paddingBottom: 15, color: '#888888' }}
            />
            <Bar
              name="แจ้งซ่อม"
              dataKey="repairsReported"
              fill="url(#colorReported)"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              name="ซ่อมเสร็จ"
              dataKey="repairsClosed"
              fill="url(#colorClosed)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
