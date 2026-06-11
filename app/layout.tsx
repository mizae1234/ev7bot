import type { Metadata } from 'next'
import { Prompt } from 'next/font/google'
import './globals.css'

const prompt = Prompt({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin', 'thai'],
  variable: '--font-prompt',
})

export const metadata: Metadata = {
  title: 'EV7 Operations Tracking Dashboard',
  description: 'ระบบติดตามการส่งมอบและการซ่อมบำรุงรถยนต์ไฟฟ้าแบบเรียลไทม์ (AION, HYPTEC, GAC)',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th" className={`${prompt.variable}`}>
      <body className="antialiased min-h-screen bg-zinc-55 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50 transition-colors duration-200">
        {children}
      </body>
    </html>
  )
}
