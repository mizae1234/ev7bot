import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET — ดึงรายการกลุ่มทั้งหมด
export async function GET() {
  try {
    const groups = await prisma.lineGroup.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(groups)
  } catch (error) {
    console.error('[Groups API Error]', error)
    return NextResponse.json({ error: 'Failed to fetch groups' }, { status: 500 })
  }
}

// PATCH — อัปเดตการตั้งค่าของกลุ่ม (enableReport หรือ enableClaimLog)
export async function PATCH(req: NextRequest) {
  try {
    const { id, enableReport, enableClaimLog } = await req.json()

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const data: any = {}
    if (typeof enableReport === 'boolean') {
      data.enableReport = enableReport
    }
    if (typeof enableClaimLog === 'boolean') {
      data.enableClaimLog = enableClaimLog
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Missing setting value' }, { status: 400 })
    }

    const updated = await prisma.lineGroup.update({
      where: { id },
      data,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[Groups API Error]', error)
    return NextResponse.json({ error: 'Failed to update group' }, { status: 500 })
  }
}
