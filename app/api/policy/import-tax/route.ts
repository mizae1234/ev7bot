import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { importTaxRecords } from '@/lib/policy/policy-service'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { rows, lineUserId } = body

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'ไม่พบรายการข้อมูลสำหรับนำเข้า' }, { status: 400 })
    }

    let ev7UserId = 1
    if (lineUserId) {
      try {
        const reg = await prisma.lineRegistration.findUnique({ where: { lineUserId } })
        if (reg?.ev7UserId) ev7UserId = reg.ev7UserId
      } catch (e) {
        // fallback
      }
    }

    const result = await importTaxRecords(rows, ev7UserId)
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[POST /api/policy/import-tax Error]', err)
    return NextResponse.json({ error: err.message || 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล' }, { status: 500 })
  }
}
