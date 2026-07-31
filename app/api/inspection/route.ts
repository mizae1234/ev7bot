import { NextRequest, NextResponse } from 'next/server'
import {
  createInspection,
  updateInspection,
  listInspections,
  resolveEv7User,
} from '@/lib/inspection/inspection-service'

export const dynamic = 'force-dynamic'

// GET: ดึงรายการ inspections
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const vinNo = searchParams.get('vinNo') || undefined
    const inspectionType = searchParams.get('type') || undefined
    const inspectionSessionId = searchParams.get('sessionId')
      ? parseInt(searchParams.get('sessionId')!)
      : undefined
    const status = searchParams.get('status') || undefined

    const inspections = await listInspections({
      vinNo,
      inspectionType,
      inspectionSessionId,
      status,
    })

    return NextResponse.json({ inspections })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Inspection GET Error]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST: สร้าง inspection ใหม่ หรืออัปเดต inspection ที่มีอยู่
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      inspectionId,   // ถ้ามี = อัปเดต, ไม่มี = สร้างใหม่
      vinNo,
      registerNo,
      inspectionType,
      returnItemId,
      inspectionSessionId,
      mileage,
      inspectionDate,
      remark,
      status,
      items = [],
      lineUserId,
    } = body

    // Resolve LINE user → EV_User
    const ev7User = await resolveEv7User(lineUserId)

    if (inspectionId) {
      // ---- UPDATE existing ----
      await updateInspection({
        inspectionId,
        mileage,
        remark,
        status,
        items,
        ev7UserId: ev7User.userId,
      })

      return NextResponse.json({ success: true, inspectionId })
    }

    // ---- CREATE new ----
    if (!vinNo || !inspectionType || !inspectionDate) {
      return NextResponse.json(
        { error: 'กรุณาระบุ vinNo, inspectionType, inspectionDate' },
        { status: 400 }
      )
    }

    const newId = await createInspection({
      vinNo,
      registerNo,
      inspectionType,
      returnItemId,
      inspectionSessionId,
      mileage,
      inspectionDate,
      remark,
      items,
      ev7UserId: ev7User.userId,
      ev7UserName: ev7User.name,
    })

    return NextResponse.json({ success: true, inspectionId: newId })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Inspection POST Error]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
