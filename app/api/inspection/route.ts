import { NextRequest, NextResponse } from 'next/server'
import {
  createInspection,
  updateInspection,
  listInspections,
  resolveEv7User,
} from '@/lib/inspection/inspection-service'
import { saveErrorLog } from '@/lib/logger'

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
    const location = searchParams.get('location') || undefined
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined

    const inspections = await listInspections({
      vinNo,
      inspectionType,
      inspectionSessionId,
      status,
      location,
      startDate,
      endDate,
      limit,
    })

    return NextResponse.json({ inspections })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const stack = error instanceof Error ? error.stack : null
    console.error('[Inspection GET Error]', message)

    await saveErrorLog({
      functionName: 'API_INSPECTION_GET',
      errorMessage: message,
      stackTrace: stack,
      pageUrl: '/api/inspection',
    })

    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST: สร้าง inspection ใหม่ หรืออัปเดต inspection ที่มีอยู่
export async function POST(request: NextRequest) {
  let ev7User: any = null
  let body: any = null
  try {
    body = await request.json()
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
      returnDate,
      parkLocation, // maps to location in DB
      inspectorName,
      inspectorUserId,
      returnReason,
      carStatus,
      carStatusType,
      assessmentResult,
      customerName,
      customerContact,
      contractCancellationDate,
      isPendingChecklist,
    } = body

    console.log('[API POST /api/inspection] Payload parsed:', {
      inspectionId,
      vinNo,
      returnReason,
      assessmentResult,
      customerName,
      customerContact,
      contractCancellationDate,
      isPendingChecklist,
    })

    // Resolve LINE user → EV_User
    ev7User = await resolveEv7User(lineUserId)

    if (inspectionId) {
      // ---- UPDATE existing ----
      await updateInspection({
        inspectionId,
        mileage,
        remark,
        status,
        items,
        ev7UserId: ev7User.userId,
        returnDate,
        location: parkLocation,
        inspectorName,
        inspectorUserId: inspectorUserId ? parseInt(inspectorUserId) : undefined,
        returnReason,
        carStatus,
        carStatusType,
        assessmentResult,
        customerName,
        customerContact,
        contractCancellationDate,
        isPendingChecklist,
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
      returnDate,
      location: parkLocation,
      inspectorName,
      inspectorUserId: inspectorUserId ? parseInt(inspectorUserId) : undefined,
      returnReason,
      carStatus,
      carStatusType,
      assessmentResult,
      customerName,
      customerContact,
      contractCancellationDate,
      isPendingChecklist,
    })

    return NextResponse.json({ success: true, inspectionId: newId })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const stack = error instanceof Error ? error.stack : null
    console.error('[Inspection POST Error]', message)

    await saveErrorLog({
      functionName: 'API_INSPECTION_POST',
      errorMessage: message,
      stackTrace: stack,
      pageUrl: '/api/inspection',
      payload: body,
      userId: ev7User?.userId,
    })

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
