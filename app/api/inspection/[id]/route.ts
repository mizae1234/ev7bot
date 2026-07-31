import { NextRequest, NextResponse } from 'next/server'
import { getInspectionDetail, updateInspection, resolveEv7User } from '@/lib/inspection/inspection-service'

export const dynamic = 'force-dynamic'

// GET: ดึง Inspection detail พร้อม items + photos
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const inspectionId = parseInt(id)
    if (isNaN(inspectionId)) {
      return NextResponse.json({ error: 'Invalid inspection ID' }, { status: 400 })
    }

    const inspection = await getInspectionDetail(inspectionId)
    if (!inspection) {
      return NextResponse.json({ error: 'Inspection not found' }, { status: 404 })
    }

    return NextResponse.json({ inspection })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Inspection Detail GET Error]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PUT: อัปเดต status (เช่น DRAFT → COMPLETED)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const inspectionId = parseInt(id)
    if (isNaN(inspectionId)) {
      return NextResponse.json({ error: 'Invalid inspection ID' }, { status: 400 })
    }

    const body = await request.json()
    const { status, mileage, remark, items = [], lineUserId } = body

    const ev7User = await resolveEv7User(lineUserId)

    await updateInspection({
      inspectionId,
      mileage,
      remark,
      status,
      items,
      ev7UserId: ev7User.userId,
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Inspection Detail PUT Error]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
