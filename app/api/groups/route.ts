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

// PATCH — อัปเดต enableReport ของกลุ่ม
export async function PATCH(req: NextRequest) {
  try {
    const { id, enableReport } = await req.json()

    if (!id || typeof enableReport !== 'boolean') {
      return NextResponse.json({ error: 'Missing id or enableReport' }, { status: 400 })
    }

    const updated = await prisma.lineGroup.update({
      where: { id },
      data: { enableReport },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[Groups API Error]', error)
    return NextResponse.json({ error: 'Failed to update group' }, { status: 500 })
  }
}
