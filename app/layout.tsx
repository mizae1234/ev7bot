import type { Metadata } from 'next'
import { Prompt } from 'next/font/google'
import { Navbar } from '@/components/ui/Navbar'
import './globals.css'

const prompt = Prompt({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin', 'thai'],
  variable: '--font-prompt',
})

export const metadata: Metadata = {
  title: 'EV7 Operations Tracking Dashboard',
  description: 'ระบบติดตามการส่งมอบและการซ่อมบำรุงรถยนต์ไฟฟ้าแบบเรียลไทม์',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th" className={`${prompt.variable}`} style={{ colorScheme: 'light' }}>
      <head>
        <meta name="color-scheme" content="light" />
      </head>
      <body className="antialiased min-h-screen bg-slate-50 text-zinc-900 flex flex-col">
        <Navbar />
        <main className="flex-1">
          {children}
        </main>
      </body>
    </html>
  )
}
