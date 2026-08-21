import { NextRequest, NextResponse } from 'next/server'
import { updateInspectionItemResolution } from '@/lib/inspection/inspection-service'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const inspectionId = parseInt(params.id, 10)
    if (!inspectionId || isNaN(inspectionId)) {
      return NextResponse.json({ error: 'รหัส Inspection ไม่ถูกต้อง' }, { status: 400 })
    }

    const body = await req.json()
    const { inspectionItemId, category, itemCode, resolveStatus, resolveRemark, ev7UserId } = body

    if (!category || !itemCode || !resolveStatus) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบถ้วน (category, itemCode, resolveStatus)' }, { status: 400 })
    }

    const validStatuses = ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'NO_ACTION_NEEDED']
    if (!validStatuses.includes(resolveStatus)) {
      return NextResponse.json({ error: 'สถานะ resolveStatus ไม่ถูกต้อง' }, { status: 400 })
    }

    const result = await updateInspectionItemResolution({
      inspectionId,
      inspectionItemId: inspectionItemId ? Number(inspectionItemId) : null,
      category,
      itemCode,
      resolveStatus,
      resolveRemark: resolveRemark || null,
      ev7UserId: ev7UserId ? Number(ev7UserId) : null,
    })

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[POST /api/inspection/[id]/resolve Error]', err)
    return NextResponse.json({ error: err.message || 'เกิดข้อผิดพลาดในการบันทึกสถานะ' }, { status: 500 })
  }
}
